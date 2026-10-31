// Daraz store-wide sales (11.11, Eid, Puja, payday "Mega Deals"…), read from
// the banners on its home page. Product, brand and category banners are
// skipped: only big campaigns become offers. The discount itself is only in
// the banner artwork, so the banner images go to the AI along with the text.
// Daraz's robots.txt blocks its campaign pages, so they are linked, not read.

import { politeFetch } from "../sources/fetcher.js";
import { slugify } from "../text.js";

const HOME = "https://www.daraz.com.bd/";
const PAGE_TTL_MS = 10 * 60 * 1000;
const MAX_IMAGES = 3;

// Daraz's site-wide campaigns live under /megascenario/; festival names catch
// any that are linked elsewhere.
const MEGA_CAMPAIGN = /\/megascenario\/bd\/([a-z0-9-]+)/i;
const FESTIVAL = /\b(\d{1,2}\.\d{1,2}|eid|puja|pujo|boishakh|ramadan|ramzan|black friday|new year|anniversary|birthday|mega sale|grand sale)\b/i;

/** Banner objects in the home page data: [{ title, url, image }]. */
export function parseDarazBanners(html) {
  const out = [];
  for (const m of html.matchAll(/\{[^{}]*"bannerTitle"\s*:\s*"[^"]*"[^{}]*\}/g)) {
    let b;
    try {
      b = JSON.parse(m[0]);
    } catch {
      continue;
    }
    const title = b.bannerTitle_en || b.bannerTitle;
    const image = b.bannerImg_en || b.bannerImg;
    if (title && b.bannerUrl) out.push({ title, url: b.bannerUrl, image: image || null });
  }
  return out;
}

/** Banners grouped by sale campaign: [{ key, banners }]; other banners are dropped. */
export function darazCampaigns(banners) {
  const groups = new Map();
  for (const b of banners) {
    const key = b.url.match(MEGA_CAMPAIGN)?.[1]?.toLowerCase() || (FESTIVAL.test(b.title) ? slugify(b.title) : null);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    const list = groups.get(key);
    if (!list.some((x) => x.image === b.image && x.title === b.title)) list.push(b);
  }
  return [...groups].map(([key, list]) => ({ key, banners: list }));
}

let cached = null; // { status, campaigns, expires }

async function loadHome() {
  if (cached && cached.expires > Date.now()) return cached;
  const res = await politeFetch(HOME, { retries: 1 });
  cached = {
    status: res.status,
    campaigns: res.status < 400 ? darazCampaigns(parseDarazBanners(res.body)) : [],
    expires: Date.now() + PAGE_TTL_MS,
  };
  return cached;
}

/** Discovery candidates, one per sale campaign on the home page. */
export async function darazCandidates(site) {
  const { status, campaigns } = await loadHome();
  if (status >= 400) throw new Error(`HTTP ${status} for ${HOME}`);
  return campaigns.map((c) => ({
    url: `${HOME}?campaign=${c.key}`,
    title: `Daraz ${c.key.replace(/-/g, " ")}`,
    summary: null,
    publishedAt: null,
    sourceName: site.name,
    sourceType: "official_website",
    origin: HOME,
    adapter: "daraz",
    rowKey: c.key,
    recheckDays: site.recheckDays,
    ...(site.note && { note: site.note }),
  }));
}

async function fetchImage(url) {
  try {
    const res = await politeFetch(url, { retries: 1, binary: true, accept: "image/jpeg,image/png,image/webp" });
    const mimeType = (res.headers.get("content-type") || "").split(";")[0].trim();
    if (res.status >= 400 || !/^image\/(jpeg|png|webp)$/.test(mimeType) || !res.body.length) return null;
    return { mimeType, data: res.body };
  } catch {
    return null;
  }
}

/** Reads one campaign: its banner titles and links as text, plus the banner images. */
export async function fetchDarazCampaign(item) {
  const { status, campaigns } = await loadHome();
  if (status >= 400) return { status };
  const c = campaigns.find((x) => x.key === item.rowKey);
  // The campaign is no longer on the home page.
  if (!c) return { status: 404 };
  const lines = [
    `Banners on the Daraz (daraz.com.bd) home page for the "${c.key}" sale campaign.`,
    ...c.banners.flatMap((b) => [`Banner: ${b.title}`, `Link: ${b.url}`, b.image && `Banner image: ${b.image}`]).filter(Boolean),
  ];
  const images = [];
  for (const b of c.banners) {
    if (images.length >= MAX_IMAGES || !b.image) continue;
    const img = await fetchImage(b.image);
    if (img) images.push(img);
  }
  return {
    status: 200,
    title: `Daraz ${c.banners[0].title}`,
    text: lines.join("\n"),
    imageUrl: c.banners.find((b) => b.image)?.image ?? null,
    images,
    publishedAt: null,
  };
}
