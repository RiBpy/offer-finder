// Automatic offer discovery: collect candidate URLs from feeds, news searches
// and business listing pages, then read each page with Claude and publish the
// offers it finds. Work is split into short, resumable steps with a time
// budget so it fits serverless limits; state lives in MongoDB.

import { extractFromHtml, visibleText } from "../extract/html.js";
import { politeFetch } from "../sources/fetcher.js";
import { recordSourceResult } from "../sources/health.js";
import { canonicalizeUrl } from "../dedupe.js";
import { todayYmd, DAY_MS } from "../dates.js";
import { log } from "../log.js";
import { DISCOVERY_REGION, FEEDS, SEARCHES, SITES } from "./config.js";
import { fetchFeedCandidates, fetchSearchCandidates, fetchSiteCandidates, looksLikeOffer } from "./feeds.js";
import { aiEnabled, aiErrorMessage, aiModel, extractOffersWithAi, isAiServiceError } from "./ai-extract.js";
import { publishExtracted } from "./publish.js";

const COLLECT_EVERY_MS = 3 * 3600 * 1000;
// Hotel and dining pages are read first: they are the offers people look for most.
const HIGH_INTEREST = /hotel|resort|dine|dining|restaurant|buffet|cafe|coxs-bazar|spa\b/i;
const MAX_ARTICLE_AGE_DAYS = 45;
const MAX_ATTEMPTS = 3;
const STUCK_AFTER_MS = 10 * 60 * 1000;

function allSources() {
  return [
    ...SITES.map((s) => ({ key: `site:${s.url || s.sitemap || s.pages?.[0]}`, kind: "site", priority: 2, load: () => fetchSiteCandidates(s) })),
    ...FEEDS.map((f) => ({ key: `feed:${f.url}`, kind: "feed", priority: 1, load: () => fetchFeedCandidates(f) })),
    ...SEARCHES.map((q) => ({ key: `search:${q}`, kind: "search", priority: 1, load: () => fetchSearchCandidates(q) })),
  ];
}

async function queueCandidates(db, candidates, priority, now) {
  let added = 0;
  for (const { recheckDays, ...c } of candidates) {
    if (c.publishedAt && now - c.publishedAt > MAX_ARTICLE_AGE_DAYS * DAY_MS) continue;
    const r = await db.collection("discovery_items").updateOne(
      { _id: c.url },
      {
        $setOnInsert: { ...c, status: "queued", priority: priority + (HIGH_INTEREST.test(c.url) ? 1 : 0), attempts: 0, foundAt: now },
        $set: { lastSeenAt: now },
      },
      { upsert: true },
    );
    added += r.upsertedCount;
    // Pages that list many offers change over time, so they are read again.
    if (recheckDays && !r.upsertedCount) {
      const re = await db.collection("discovery_items").updateOne(
        { _id: c.url, status: { $in: ["done", "no_offer"] }, processedAt: { $lt: new Date(now.getTime() - recheckDays * DAY_MS) } },
        { $set: { status: "queued", attempts: 0 } },
      );
      added += re.modifiedCount;
    }
  }
  return added;
}

// A business still linking to an offer page is a fresh sighting of that offer.
async function refreshListedOffers(db, urls, now) {
  if (!urls.length) return 0;
  const r = await db.collection("offers").updateMany(
    {
      canonicalUrl: { $in: urls },
      reviewState: "approved",
      mergedInto: null,
      endDate: null,
      validationStatus: { $in: ["active", "unverified"] },
      "verificationEvidence.method": "auto_extract",
    },
    { $set: { validationStatus: "active", lastVerifiedAt: now, statusReason: null, updatedAt: now } },
  );
  return r.modifiedCount;
}

/** Visits every source not checked in the last few hours, until the deadline. */
export async function collect(db, { deadline, now = new Date(), force = false } = {}) {
  const state = db.collection("discovery_state");
  const summary = { sources: 0, queued: 0, refreshed: 0, errors: [] };
  for (const src of allSources()) {
    if (Date.now() > deadline) break;
    const prev = await state.findOne({ _id: src.key });
    if (!force && prev?.lastCollectedAt && now - prev.lastCollectedAt < COLLECT_EVERY_MS) continue;
    try {
      const candidates = await src.load();
      summary.queued += await queueCandidates(db, candidates, src.priority, now);
      if (src.kind === "site") summary.refreshed += await refreshListedOffers(db, candidates.map((c) => c.url), now);
      await state.updateOne({ _id: src.key }, { $set: { lastCollectedAt: now, lastCount: candidates.length, lastError: null } }, { upsert: true });
    } catch (err) {
      summary.errors.push(`${src.key}: ${err.message}`);
      await state.updateOne({ _id: src.key }, { $set: { lastCollectedAt: now, lastError: err.message } }, { upsert: true });
    }
    summary.sources++;
  }
  return summary;
}

async function claimNext(db, now) {
  return db.collection("discovery_items").findOneAndUpdate(
    {
      $or: [{ status: "queued" }, { status: "processing", startedAt: { $lt: new Date(now.getTime() - STUCK_AFTER_MS) } }],
    },
    { $set: { status: "processing", startedAt: now }, $inc: { attempts: 1 } },
    { sort: { priority: -1, publishedAt: -1, foundAt: 1 }, returnDocument: "after" },
  );
}

/**
 * The page's own URL. A declared canonical is used only when it points to a
 * page on the same site that is not a parent of this one: some sites declare
 * their homepage as the canonical of every page.
 */
export function pageUrl(canonical, fetchedUrl) {
  const own = canonicalizeUrl(fetchedUrl);
  const c = canonicalizeUrl(canonical);
  if (!c || !own) return own;
  const a = new URL(c);
  const b = new URL(own);
  if (a.hostname.replace(/^www\./, "") !== b.hostname.replace(/^www\./, "")) return own;
  if (b.pathname.startsWith(a.pathname) && a.pathname.length < b.pathname.length) return own;
  return c;
}

async function processItem(db, item, now) {
  const res = await politeFetch(item.url, { retries: 1 });
  await recordSourceResult(db, item.url, { ok: res.status < 400, status: res.status, error: res.status >= 400 ? `HTTP ${res.status}` : null, adapter: "discovery", now });
  if (res.status >= 400) return { status: res.status === 404 || res.status === 410 ? "gone" : "failed", error: `HTTP ${res.status}` };
  if (!/html/i.test(res.headers.get("content-type") || "")) return { status: "no_offer", error: "not an HTML page" };

  const meta = extractFromHtml(res.body, res.url);
  const text = visibleText(res.body, 60000);
  if (item.sourceType === "news" && !looksLikeOffer(item.title, meta.title, text)) return { status: "no_offer" };

  const url = pageUrl(meta.canonicalUrl, res.url) || item.url;
  const publishedAt = item.publishedAt || meta.publishedAt || null;
  const { offers, usage, refused } = await extractOffersWithAi({
    url,
    title: meta.title || item.title,
    text,
    publishedAt,
    today: todayYmd(DISCOVERY_REGION.timezone, now),
    region: DISCOVERY_REGION,
  });

  const outcomes = [];
  for (const x of offers) {
    try {
      outcomes.push(
        await publishExtracted(db, x, {
          url,
          sourceName: item.sourceName || meta.siteName || new URL(url).hostname.replace(/^www\./, ""),
          sourceType: item.sourceType,
          publishedAt,
          imageUrl: meta.imageUrl,
          region: DISCOVERY_REGION,
          now,
        }),
      );
    } catch (err) {
      log.error("discovery publish failed", { url, title: x.title, error: err.message });
      outcomes.push({ outcome: "error", reason: err.message });
    }
  }
  return {
    status: refused ? "refused" : offers.length ? "done" : "no_offer",
    outcomes,
    tokens: usage ? { input: usage.input_tokens, output: usage.output_tokens } : null,
  };
}

/** Processes queued pages until the deadline or `maxItems`. */
export async function processQueue(db, { deadline, maxItems = 50 } = {}) {
  const summary = { processed: 0, published: 0, held: 0, duplicates: 0, failed: 0, inputTokens: 0, outputTokens: 0 };
  while (summary.processed < maxItems && Date.now() < deadline) {
    const now = new Date();
    const item = await claimNext(db, now);
    if (!item) break;
    let result;
    try {
      result = await processItem(db, item, now);
    } catch (err) {
      if (isAiServiceError(err)) {
        // Not this page's fault: put it back and stop until the service is usable.
        await db.collection("discovery_items").updateOne(
          { _id: item._id },
          { $set: { status: "queued" }, $inc: { attempts: -1 }, $unset: { startedAt: "" } },
        );
        summary.aiError = aiErrorMessage(err);
        log.error("discovery stopped: AI API rejected the request", { model: aiModel(), status: err.status, error: summary.aiError });
        break;
      }
      const retry = item.attempts < MAX_ATTEMPTS && err.code !== "ROBOTS_DISALLOWED" && err.status !== 400;
      result = { status: retry ? "queued" : "failed", error: err.message };
      log.warn("discovery item failed", { url: item.url, attempt: item.attempts, error: err.message });
    }
    await db.collection("discovery_items").updateOne(
      { _id: item._id },
      { $set: { ...result, processedAt: new Date(), model: aiModel() }, $unset: { startedAt: "" } },
    );
    summary.processed++;
    if (result.status === "failed") summary.failed++;
    for (const o of result.outcomes || []) {
      if (o.outcome === "published") summary.published++;
      else if (o.outcome === "held") summary.held++;
      else if (o.outcome === "duplicate") summary.duplicates++;
    }
    summary.inputTokens += result.tokens?.input || 0;
    summary.outputTokens += result.tokens?.output || 0;
  }
  summary.queued = await db.collection("discovery_items").countDocuments({ status: "queued" });
  return summary;
}

/**
 * Runs a small discovery step because someone opened the app, at most once
 * per cooldown across all visitors, so reloads cannot use up the AI quota.
 * @returns {{ ran: boolean, published?: number, nextAt?: Date, reason?: string }}
 */
export async function refreshOnVisit(db, { cooldownMs, budgetMs, maxItems }) {
  if (!aiEnabled()) return { ran: false, reason: "not_configured" };
  const now = new Date();
  try {
    // Atomic claim: only one request per cooldown gets past this.
    await db.collection("discovery_state").findOneAndUpdate(
      { _id: "visit-refresh", $or: [{ lastRunAt: { $lt: new Date(now.getTime() - cooldownMs) } }, { lastRunAt: { $exists: false } }] },
      { $set: { lastRunAt: now } },
      { upsert: true },
    );
  } catch (err) {
    // The upsert collides with the existing document while it is cooling down.
    if (err?.code !== 11000) throw err;
    const state = await db.collection("discovery_state").findOne({ _id: "visit-refresh" });
    return { ran: false, reason: "cooldown", nextAt: new Date(state.lastRunAt.getTime() + cooldownMs) };
  }
  const { processed } = await runDiscovery(db, { trigger: "visit", budgetMs, maxItems });
  return { ran: true, published: processed.published };
}

/** One discovery run: collect (when due) then process, within `budgetMs`. */
export async function runDiscovery(db, { trigger, budgetMs = 20000, maxItems = 50, forceCollect = false } = {}) {
  const startedAt = new Date();
  const deadline = Date.now() + budgetMs;
  if (!aiEnabled()) {
    const err = new Error("Neither GEMINI_API_KEY nor ANTHROPIC_API_KEY is set; discovery cannot read pages");
    err.code = "AI_NOT_CONFIGURED";
    throw err;
  }
  // Leave most of the budget for reading pages.
  const collected = await collect(db, { deadline: Date.now() + budgetMs * 0.4, force: forceCollect, now: startedAt });
  const processed = await processQueue(db, { deadline, maxItems });
  const result = { collected, processed };
  await db.collection("jobs").insertOne({ type: "discovery", trigger, status: "succeeded", result, createdAt: startedAt, finishedAt: new Date() });
  log.info("discovery run", { trigger, ...collected, ...processed, errors: collected.errors.length });
  return result;
}
