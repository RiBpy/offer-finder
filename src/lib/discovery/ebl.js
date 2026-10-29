// Eastern Bank (EBL) card discount partners. EBL's category pages list only the
// partners' names; each partner's offer comes from a JSON endpoint that needs
// the page's session cookie and CSRF token, so it is read here instead of as a
// plain page. One partner becomes one queued item, read by the AI like any page.

import { visibleText } from "../extract/html.js";
import { politeFetch } from "../sources/fetcher.js";

const BASE = "https://www.ebl.com.bd";
const DETAILS_URL = `${BASE}/partner/partners_details`;
const SESSION_TTL_MS = 10 * 60 * 1000;

export const EBL_CATEGORIES = [
  "restaurant",
  "hotel-resort",
  "lifestyle",
  "health-beauty-care",
  "travel-tourism",
  "vehicle-accessories",
  "entrepreneurship-development-services",
];

const categoryUrl = (slug) => `${BASE}/partner/discount-offers/${slug}`;

/** Partners on one category page: [{ id, name, imageUrl }]. */
export function parseEblPartners(html) {
  const out = [];
  for (const m of html.matchAll(/<a\b[^>]*class="fetch"[^>]*\bid="(\d+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const name = visibleText(m[2].match(/<h5\b[^>]*>([\s\S]*?)<\/h5>/i)?.[1] ?? "", 200);
    const img = m[2].match(/<img\b[^>]*\bsrc="([^"]+)"/i)?.[1];
    if (name) out.push({ id: m[1], name, imageUrl: img ? new URL(img, BASE).toString() : null });
  }
  return out;
}

/** Discovery candidates for every partner of every category. */
export async function eblCandidates(site) {
  const out = [];
  for (const slug of EBL_CATEGORIES) {
    const url = categoryUrl(slug);
    const res = await politeFetch(url, { retries: 1 });
    if (res.status >= 400) throw new Error(`HTTP ${res.status} for ${url}`);
    for (const p of parseEblPartners(res.body)) {
      out.push({
        url: `${url}?partner=${p.id}`,
        title: p.name,
        summary: null,
        publishedAt: null,
        sourceName: site.name,
        sourceType: "official_website",
        origin: url,
        adapter: "ebl",
        partnerId: p.id,
        imageUrl: p.imageUrl,
        recheckDays: site.recheckDays,
      });
    }
  }
  return out;
}

// Session cookie + CSRF token per category page, reused for a few minutes so a
// run does not reload the listing for every partner.
const sessions = new Map();

async function session(pageUrl) {
  const cached = sessions.get(pageUrl);
  if (cached && cached.expires > Date.now()) return cached;
  const res = await politeFetch(pageUrl, { retries: 1 });
  if (res.status >= 400) throw new Error(`HTTP ${res.status} for ${pageUrl}`);
  const token = res.body.match(/csrf_eblbdtoken_name['"]\s*:\s*['"]([0-9a-f]+)/i)?.[1];
  if (!token) throw new Error("EBL page has no CSRF token");
  const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const s = { token, cookie, expires: Date.now() + SESSION_TTL_MS };
  sessions.set(pageUrl, s);
  return s;
}

/**
 * Reads one partner's offer. Returns { status, title, text, imageUrl, publishedAt }
 * where `text` is what the AI reads, like a page's visible text.
 */
export async function fetchEblPartner(item) {
  const { token, cookie } = await session(item.origin);
  const res = await politeFetch(DETAILS_URL, {
    retries: 1,
    method: "POST",
    accept: "application/json, text/javascript, */*",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      Referer: item.origin,
      Cookie: cookie,
    },
    body: new URLSearchParams({ csrf_eblbdtoken_name: token, id: item.partnerId }).toString(),
  });
  if (res.status >= 400) {
    sessions.delete(item.origin);
    return { status: res.status };
  }
  let d;
  try {
    d = JSON.parse(res.body);
  } catch {
    sessions.delete(item.origin);
    throw new Error("EBL partner details were not JSON");
  }
  if (!d?.title) return { status: 404 };
  const text = (html) => visibleText(String(html ?? ""), 4000);
  const lines = [
    `EBL card discount partner: ${d.title}`,
    d.pid_url && `Category on the EBL website: ${d.pid_url.replace(/-/g, " ")}`,
    d.offerType && `Offer type: ${d.offerType}`,
    `Offer: ${text(d.offer || d.advantage || d.privilege)}`,
    d.applicability && `Applicable for: ${text(d.applicability)}`,
    d.details && `Address: ${text(d.details)}`,
    d.phone && `Phone: ${d.phone}`,
    d.Website && `Partner website: ${d.Website}`,
  ].filter(Boolean);
  const listed = /^\d{4}-\d{2}-\d{2}$/.test(d.date || "") ? new Date(`${d.date}T00:00:00Z`) : null;
  return {
    status: 200,
    title: `${d.title} – EBL card offer`,
    text: lines.join("\n"),
    imageUrl: item.imageUrl || (d.image ? new URL(`${d.path || "./assets/home/dprivileges/"}${d.image}`, `${BASE}/`).toString() : null),
    publishedAt: listed,
  };
}
