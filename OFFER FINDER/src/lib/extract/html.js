// Extracts offer-relevant metadata from an HTML page without a DOM library:
// <title>, meta description, Open Graph, canonical link, publish dates, and
// schema.org JSON-LD (Offer, Product, Event, SaleEvent, Article...).

import { cleanText } from "../text.js";

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s) {
  return String(s).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function attrs(tag) {
  const out = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m;
  while ((m = re.exec(tag))) out[m[1].toLowerCase()] = decodeEntities(m[3] ?? m[4] ?? m[5] ?? "");
  return out;
}

function metaTags(html) {
  const map = {};
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const key = (a.property || a.name || a.itemprop || "").toLowerCase();
    if (key && a.content != null && map[key] == null) map[key] = a.content;
  }
  return map;
}

function linkHref(html, rel, base) {
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    if ((a.rel || "").toLowerCase().split(/\s+/).includes(rel) && a.href) {
      try {
        return new URL(a.href, base).toString();
      } catch {
        return null;
      }
    }
  }
  return null;
}

function flattenJsonLd(node, out = []) {
  if (Array.isArray(node)) node.forEach((n) => flattenJsonLd(n, out));
  else if (node && typeof node === "object") {
    out.push(node);
    if (node["@graph"]) flattenJsonLd(node["@graph"], out);
    for (const k of ["offers", "makesOffer", "itemOffered", "mainEntity", "subjectOf"]) if (node[k]) flattenJsonLd(node[k], out);
  }
  return out;
}

function types(n) {
  const t = n["@type"];
  return (Array.isArray(t) ? t : [t]).filter(Boolean).map(String);
}

function jsonLdNodes(html) {
  const nodes = [];
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      flattenJsonLd(JSON.parse(m[1].trim()), nodes);
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  }
  return nodes;
}

function toDate(v) {
  if (!v || typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function nameOf(v) {
  if (!v) return null;
  if (typeof v === "string") return cleanText(v, 80);
  if (Array.isArray(v)) return nameOf(v[0]);
  return cleanText(v.name, 80);
}

function imageOf(v, base) {
  const raw = Array.isArray(v) ? v[0] : typeof v === "object" && v ? v.url : v;
  if (!raw || typeof raw !== "string") return null;
  try {
    return new URL(raw, base).toString();
  } catch {
    return null;
  }
}

export function visibleText(html, max = 20000) {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

const ENDED_PATTERNS = [
  /\b(this|the) (offer|promotion|promo|deal|sale|campaign) (has )?(ended|expired|is over|is no longer (available|valid))\b/i,
  /\boffer (has )?expired\b/i,
  /\bpromotion (has )?ended\b/i,
  /\bno longer available\b/i,
  /\bsale (has )?ended\b/i,
];

export function detectEndedLanguage(text) {
  for (const re of ENDED_PATTERNS) {
    const m = text.match(re);
    if (m) return m[0];
  }
  return null;
}

/**
 * @returns {object} extracted fields; every value is null when not found.
 * Nothing here is guessed: dates come only from explicit metadata.
 */
export function extractFromHtml(html, pageUrl) {
  const meta = metaTags(html);
  const nodes = jsonLdNodes(html);
  const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];

  const offerNode = nodes.find((n) => types(n).some((t) => /^(Offer|AggregateOffer)$/.test(t)));
  const eventNode = nodes.find((n) => types(n).some((t) => /(Event)$/.test(t)));
  const productNode = nodes.find((n) => types(n).some((t) => /^(Product|Service|IndividualProduct)$/.test(t)));
  const articleNode = nodes.find((n) => types(n).some((t) => /(Article|BlogPosting|WebPage)$/.test(t)));
  const orgNode = nodes.find((n) => types(n).some((t) => /(Organization|LocalBusiness|Store|Restaurant|Hotel)$/.test(t)));

  const validFrom = toDate(offerNode?.validFrom) || toDate(eventNode?.startDate);
  const validThrough = toDate(offerNode?.validThrough) || toDate(offerNode?.priceValidUntil) || toDate(eventNode?.endDate);
  const price = offerNode?.price ?? offerNode?.lowPrice;
  const priceNum = price == null ? null : Number(String(price).replace(/,/g, ""));

  const canonical = linkHref(html, "canonical", pageUrl) || cleanText(meta["og:url"]);
  const text = visibleText(html);

  return {
    title: cleanText(decodeEntities(meta["og:title"] || meta["twitter:title"] || titleTag || ""), 200),
    description: cleanText(meta["og:description"] || meta.description || meta["twitter:description"] || offerNode?.description || productNode?.description, 500),
    imageUrl: imageOf(meta["og:image"] || meta["twitter:image"] || productNode?.image || eventNode?.image, pageUrl),
    canonicalUrl: canonical,
    siteName: cleanText(meta["og:site_name"] || nameOf(orgNode), 120),
    brandName: nameOf(productNode?.brand) || nameOf(offerNode?.seller) || nameOf(orgNode),
    publishedAt: toDate(meta["article:published_time"]) || toDate(articleNode?.datePublished) || toDate(meta["date"]),
    validFrom,
    validThrough,
    price: Number.isFinite(priceNum) ? priceNum : null,
    currency: typeof offerNode?.priceCurrency === "string" ? offerNode.priceCurrency.toUpperCase() : null,
    structuredData: Boolean(offerNode || eventNode),
    endedLanguage: detectEndedLanguage(text),
    textSample: cleanText(text, 600),
  };
}
