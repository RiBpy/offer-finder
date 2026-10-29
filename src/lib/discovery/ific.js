// IFIC Bank card discounts. One page lists every merchant (about 60) in tables,
// which is too many offers for one AI answer, so each table row is queued as
// its own item and read on its own, like a separate page.

import { decodeEntities, visibleText } from "../extract/html.js";
import { politeFetch } from "../sources/fetcher.js";
import { slugify } from "../text.js";

const PAGE_TTL_MS = 10 * 60 * 1000;

// Some cells are double-encoded ("&amp;ndash;"), so decode once more.
const cellText = (html) => decodeEntities(visibleText(html, 3000)).replace(/\s+/g, " ").trim();

/** Offer rows: [{ key, merchant, discount, validUntil, details, location, eligible, section }]. */
export function parseIficOffers(html) {
  const sections = new Map();
  for (const m of html.matchAll(/<a\b[^>]*href="#(collapse\d+)"[^>]*>([\s\S]*?)<\/a>/gi)) sections.set(m[1], cellText(m[2]));
  const starts = [...html.matchAll(/\bid="(collapse\d+)"/gi)].map((m) => ({ at: m.index, name: sections.get(m[1]) || null }));

  const out = [];
  const seen = new Set();
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => cellText(c[1]));
    // Logo, merchant, overall discount, duration, details, location, available for.
    if (cells.length < 7 || !cells[1]) continue;
    const [, merchant, discount, validUntil, details, location, eligible] = cells;
    let key = slugify(merchant).slice(0, 60);
    for (let n = 2; seen.has(key); n++) key = `${slugify(merchant).slice(0, 56)}-${n}`;
    seen.add(key);
    const section = starts.filter((s) => s.at < row.index).at(-1)?.name ?? null;
    out.push({ key, merchant, discount, validUntil, details, location, eligible, section });
  }
  return out;
}

const pages = new Map(); // url -> { offers, expires }

async function loadPage(url) {
  const cached = pages.get(url);
  if (cached && cached.expires > Date.now()) return cached;
  const res = await politeFetch(url, { retries: 1 });
  const entry = { status: res.status, offers: res.status < 400 ? parseIficOffers(res.body) : [], expires: Date.now() + PAGE_TTL_MS };
  pages.set(url, entry);
  return entry;
}

/** Discovery candidates, one per offer row. */
export async function ificCandidates(site) {
  const out = [];
  for (const url of site.pages) {
    const { status, offers } = await loadPage(url);
    if (status >= 400) throw new Error(`HTTP ${status} for ${url}`);
    for (const o of offers) {
      out.push({
        url: `${url}?merchant=${o.key}`,
        title: o.merchant,
        summary: null,
        publishedAt: null,
        sourceName: site.name,
        sourceType: "official_website",
        origin: url,
        adapter: "ific",
        rowKey: o.key,
        recheckDays: site.recheckDays,
      });
    }
  }
  return out;
}

/** Reads one offer row. Same result shape as fetchEblPartner. */
export async function fetchIficOffer(item) {
  const { status, offers } = await loadPage(item.origin);
  if (status >= 400) return { status };
  const o = offers.find((x) => x.key === item.rowKey);
  if (!o) return { status: 404 };
  const lines = [
    `IFIC Bank card discount partner: ${o.merchant}`,
    o.section && `Category on the IFIC website: ${o.section}`,
    o.discount && `Overall discount: ${o.discount}`,
    o.validUntil && `Valid until: ${o.validUntil}`,
    o.details && `Details: ${o.details}`,
    o.location && `Location: ${o.location}`,
    o.eligible && `Available for: ${o.eligible}`,
  ].filter(Boolean);
  return { status: 200, title: `${o.merchant} – IFIC Bank card offer`, text: lines.join("\n"), imageUrl: null, publishedAt: null };
}
