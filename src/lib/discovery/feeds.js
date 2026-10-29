// Turns RSS feeds, news searches and listing pages into candidate URLs.
// Pure parsing helpers are exported for tests; network access goes through
// politeFetch so robots.txt, SSRF checks and retries apply.

import { decodeEntities } from "../extract/html.js";
import { politeFetch } from "../sources/fetcher.js";
import { canonicalizeUrl } from "../dedupe.js";
import { cleanText } from "../text.js";

const XML_ACCEPT = "application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.5";

// Words that suggest an item is about an offer, in English and Bangla.
const OFFER_HINT =
  /\b(offers?|discounts?|deals?|sale|cash ?back|promo(tion)?s?|coupons?|vouchers?|\d+\s?(%|pc|percent)\s?off|buy one get one|bogo|free delivery|price cut)\b|ছাড়|অফার|ক্যাশব্যাক|মূল্যছাড়|ডিসকাউন্ট|বিশেষ সুবিধা/i;

export function looksLikeOffer(...texts) {
  return OFFER_HINT.test(texts.filter(Boolean).join(" "));
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  if (!m) return null;
  const raw = m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1");
  return decodeEntities(raw.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim() || null;
}

function toDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Parses RSS 2.0 <item>s and Atom <entry>s. */
export function parseFeed(xml) {
  const items = [];
  for (const m of xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)) {
    const block = m[0];
    let link = tag(block, "link");
    if (!link) link = block.match(/<link\b[^>]*href=["']([^"']+)["']/i)?.[1] ?? null;
    if (!link) continue;
    items.push({
      title: cleanText(tag(block, "title"), 300),
      link: decodeEntities(link).trim(),
      summary: cleanText(tag(block, "description") || tag(block, "summary"), 1000),
      publishedAt: toDate(tag(block, "pubDate") || tag(block, "published") || tag(block, "updated") || tag(block, "dc:date")),
      sourceName: tag(block, "News:Source") || tag(block, "source"),
    });
  }
  return items;
}

/** Bing News links point at a click tracker; the publisher URL is in `url=`. */
export function unwrapBingLink(link) {
  try {
    const u = new URL(link);
    if (/(^|\.)bing\.com$/i.test(u.hostname) && u.searchParams.get("url")) return u.searchParams.get("url");
  } catch {
    // fall through
  }
  return link;
}

export function bingNewsUrl(query) {
  return `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss&mkt=en-US`;
}

/** Same-site links on a listing page whose path matches `pattern`. */
export function listingLinks(html, pageUrl, pattern) {
  const base = new URL(pageUrl);
  const out = new Set();
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["']/gi)) {
    try {
      const u = new URL(decodeEntities(m[1]), base);
      if (u.hostname !== base.hostname || !pattern.test(u.pathname)) continue;
      out.add(canonicalizeUrl(u.toString()));
    } catch {
      // ignore malformed hrefs
    }
  }
  return [...out];
}

function candidate(url, fields) {
  const canonical = canonicalizeUrl(url);
  return canonical ? { url: canonical, ...fields } : null;
}

export async function fetchFeedCandidates(feed) {
  const res = await politeFetch(feed.url, { accept: XML_ACCEPT, retries: 1 });
  if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
  return parseFeed(res.body)
    .filter((it) => looksLikeOffer(it.title, it.summary))
    .map((it) =>
      candidate(it.link, { title: it.title, summary: it.summary, publishedAt: it.publishedAt, sourceName: feed.name, sourceType: "news", origin: feed.url }),
    )
    .filter(Boolean);
}

export async function fetchSearchCandidates(query) {
  const url = bingNewsUrl(query);
  const res = await politeFetch(url, { accept: XML_ACCEPT, retries: 1 });
  if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
  return parseFeed(res.body)
    .filter((it) => looksLikeOffer(it.title, it.summary))
    .map((it) =>
      candidate(unwrapBingLink(it.link), {
        title: it.title,
        summary: it.summary,
        publishedAt: it.publishedAt,
        sourceName: it.sourceName,
        sourceType: "news",
        origin: `bing:${query}`,
      }),
    )
    .filter(Boolean);
}

const MAX_SITEMAP_URLS = 300;

/** <loc> URLs in a sitemap or sitemap index, with whether it is an index. */
export function parseSitemap(xml) {
  return {
    isIndex: /<sitemapindex\b/i.test(xml),
    urls: [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => decodeEntities(m[1])),
  };
}

function siteCandidate(url, site, origin) {
  return { url, title: null, summary: null, publishedAt: null, sourceName: site.name, sourceType: "official_website", origin };
}

// Offer pages from a listing page's links.
async function listingCandidates(site) {
  const res = await politeFetch(site.url, { retries: 1 });
  if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
  return listingLinks(res.body, res.url, site.linkPattern).map((url) => siteCandidate(url, site, site.url));
}

// Offer pages listed in a sitemap (following one level of sitemap index).
async function sitemapCandidates(site) {
  const queue = [site.sitemap];
  const found = new Set();
  for (let fetched = 0; queue.length && fetched < 6; fetched++) {
    const res = await politeFetch(queue.shift(), { accept: XML_ACCEPT, retries: 1 });
    if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
    const { isIndex, urls } = parseSitemap(res.body);
    if (isIndex) {
      queue.push(...urls.filter((u) => !site.sitemapIndexPattern || site.sitemapIndexPattern.test(u)));
      continue;
    }
    for (const u of urls) {
      try {
        if (site.sitemapPattern.test(new URL(u).pathname)) found.add(canonicalizeUrl(u));
      } catch {
        // ignore malformed entries
      }
    }
  }
  return [...found].filter(Boolean).slice(0, MAX_SITEMAP_URLS).map((url) => siteCandidate(url, site, site.sitemap));
}

/**
 * Candidates for one entry of SITES: a listing page (url + linkPattern), a
 * sitemap (sitemap + sitemapPattern), and/or fixed pages that themselves list
 * many offers (pages), which are re-read every few days.
 */
export async function fetchSiteCandidates(site) {
  const out = [];
  if (site.url && site.linkPattern) out.push(...(await listingCandidates(site)));
  if (site.sitemap && site.sitemapPattern) out.push(...(await sitemapCandidates(site)));
  if (site.recheckDays) out.forEach((c) => (c.recheckDays = site.recheckDays));
  for (const page of site.pages || []) {
    const url = canonicalizeUrl(page);
    if (url) out.push({ ...siteCandidate(url, site, url), recheckDays: site.recheckDays || 7 });
  }
  return out;
}
