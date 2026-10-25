// Re-checks one stored offer against its source. The rules are deliberately
// conservative: a page that is still online is NOT evidence that the offer is
// still valid. Only explicit structured validity dates refresh lastVerifiedAt.

import { extractFromHtml } from "../extract/html.js";
import { politeFetch } from "../sources/fetcher.js";
import { recordSourceResult } from "../sources/health.js";
import { DAY_MS } from "../dates.js";
import { staleDays } from "../offers/status.js";

/**
 * Pure decision function, unit-tested separately from I/O.
 * @param offer  stored offer
 * @param check  { httpStatus, error, errorCode, extracted }
 * @returns {{ set: object, evidence: object|null, outcome: string, failed: boolean }}
 */
export function decideVerification(offer, check, now = new Date()) {
  const set = { lastCheckedAt: now };
  const ev = (note, method = "source_check") => ({ at: now, method, note });

  if (offer.endDate && new Date(offer.endDate) <= now) {
    return { set: { ...set, validationStatus: "expired", statusReason: "End date passed" }, evidence: null, outcome: "expired", failed: false };
  }

  if (check.error) {
    if (check.errorCode === "ROBOTS_DISALLOWED") {
      return { set: { ...set, statusReason: "robots.txt disallows automatic checks; verify manually" }, evidence: null, outcome: "robots_disallowed", failed: true };
    }
    return { set, evidence: null, outcome: "fetch_failed", failed: true };
  }

  if (check.httpStatus === 404 || check.httpStatus === 410) {
    return {
      set: { ...set, validationStatus: "unavailable", statusReason: `Source returned HTTP ${check.httpStatus}` },
      evidence: ev(`Source returned HTTP ${check.httpStatus}`),
      outcome: "unavailable",
      failed: false,
    };
  }
  if (check.httpStatus >= 400) {
    return { set, evidence: null, outcome: `http_${check.httpStatus}`, failed: true };
  }

  const x = check.extracted || {};
  if (x.validThrough && x.validThrough <= now) {
    return {
      set: { ...set, validationStatus: "expired", statusReason: "Source structured data shows the offer ended", endDate: offer.endDate ?? x.validThrough },
      evidence: ev(`Structured data validThrough ${x.validThrough.toISOString()}`, "structured_data"),
      outcome: "expired",
      failed: false,
    };
  }
  if (x.endedLanguage) {
    return {
      set: { ...set, validationStatus: "unverified", statusReason: `Source page says: "${x.endedLanguage}"` },
      evidence: ev(`Page text: "${x.endedLanguage}"`),
      outcome: "ended_language",
      failed: false,
    };
  }
  if (x.validThrough && x.validThrough > now && offer.validationStatus === "active") {
    return {
      set: { ...set, lastVerifiedAt: now, statusReason: null },
      evidence: ev(`Structured data validThrough ${x.validThrough.toISOString()}`, "structured_data"),
      outcome: "verified_structured",
      failed: false,
    };
  }

  // Page is reachable but carries no validity evidence.
  if (offer.validationStatus === "active" && !offer.endDate) {
    const last = offer.lastVerifiedAt ? new Date(offer.lastVerifiedAt).getTime() : 0;
    if (now.getTime() - last > staleDays() * DAY_MS) {
      return {
        set: { ...set, validationStatus: "unverified", statusReason: `No end date and not re-verified for ${staleDays()} days` },
        evidence: null,
        outcome: "stale",
        failed: false,
      };
    }
  }
  return { set, evidence: null, outcome: "reachable_no_evidence", failed: false };
}

export async function verifyOffer(db, offer, { now = new Date(), trigger = "cron" } = {}) {
  let check;
  if (offer.endDate && new Date(offer.endDate) <= now) {
    check = {};
  } else {
    try {
      const res = await politeFetch(offer.sourceUrl, { retries: 2 });
      const isHtml = /html|xml/i.test(res.headers.get("content-type") || "");
      check = { httpStatus: res.status, extracted: res.status < 400 && isHtml ? extractFromHtml(res.body, res.url) : null };
      await recordSourceResult(db, offer.sourceUrl, { ok: res.status < 400, status: res.status, error: res.status >= 400 ? `HTTP ${res.status}` : null, now });
    } catch (err) {
      check = { error: err.message, errorCode: err.code };
      await recordSourceResult(db, offer.sourceUrl, { ok: false, error: err.message, now });
    }
  }

  const decision = decideVerification(offer, check, now);
  const update = { $set: { ...decision.set, updatedAt: now } };
  if (decision.evidence) update.$push = { verificationEvidence: { $each: [decision.evidence], $slice: -50 } };
  await db.collection("offers").updateOne({ _id: offer._id }, update);

  await db.collection("jobs").insertOne({
    type: "verify",
    offerId: offer._id,
    offerTitle: offer.title,
    trigger,
    status: decision.failed ? "failed" : "succeeded",
    outcome: decision.outcome,
    error: check.error ?? (decision.failed ? decision.outcome : null),
    createdAt: now,
  });
  return decision;
}
