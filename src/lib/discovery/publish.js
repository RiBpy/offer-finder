// Decides what happens to each AI-extracted offer and stores it.
// Only high-confidence offers are published (approved + active); the rest are
// stored hidden (pending + unverified) so they are not re-extracted, and can
// be reviewed in /admin if anyone wants to.

import { AVAILABILITY_TYPES, CATEGORY_IDS, DISCOUNT_TYPES, SCOPES } from "../constants.js";
import { DAY_MS, endOfDayInZone, isYmd } from "../dates.js";
import { findDuplicateCandidates } from "../dedupe.js";
import { ValidationError } from "../offers/model.js";
import { createOffer } from "../offers/repository.js";
import { cleanText, normalizeKey, slugify } from "../text.js";
import { log } from "../log.js";
import { geocodeAddress } from "./geocode.js";

export const MIN_CONFIDENCE = 0.7;
// News without a stated end date is only trusted while the article is recent.
export const NEWS_FRESH_DAYS = 21;
const MAX_BRANCHES = 8;

const ymdOrNull = (s) => (typeof s === "string" && isYmd(s.trim()) ? s.trim() : null);

// Merchants that are hotels or resorts, so their dining offers also show under Hotels.
export const HOTEL_NAME =
  /\b(hotels?|resorts?|inn|lodge|westin|renaissance|m[eé]ridien|sheraton|radisson|intercontinental|sonargaon|six seasons|amari|marriott|hyatt|hilton|novotel|courtyard|four points|sayeman|royal tulip)\b/i;

function withHotelCategory(categories, x) {
  const text = [x.title, x.businessName, x.brandName].filter(Boolean).join(" ");
  return HOTEL_NAME.test(text) && !categories.includes("hotels") ? [...categories, "hotels"] : categories;
}

/**
 * Pure part of the decision, unit-tested without I/O.
 * @returns {{ action: "skip"|"publish"|"hold", reason: string }}
 */
export function decidePublication(x, { sourceType, publishedAt, now = new Date(), region }) {
  if (!x?.title || !x.evidenceQuote) return { action: "skip", reason: "missing title or evidence" };
  const endYmd = ymdOrNull(x.endDate);
  const end = endYmd ? endOfDayInZone(endYmd, region.timezone) : null;
  if (end && end <= now) return { action: "skip", reason: "already ended" };
  if (x.discountType === "none") return { action: "hold", reason: "no stated benefit" };
  if (!(x.confidence >= MIN_CONFIDENCE)) return { action: "hold", reason: `low confidence (${x.confidence})` };
  if (!end && sourceType === "news") {
    const ageDays = publishedAt ? (now.getTime() - publishedAt.getTime()) / DAY_MS : Infinity;
    if (ageDays > NEWS_FRESH_DAYS) return { action: "hold", reason: "news item without end date is not recent" };
  }
  return { action: "publish", reason: "high confidence" };
}

/** Maps an extracted offer to admin-form-shaped input for normalizeOfferInput. */
export function toOfferInput(x, ctx) {
  const country = /^[A-Za-z]{2}$/.test(x.country || "") ? x.country.toUpperCase() : ctx.region.country;
  let discountType = DISCOUNT_TYPES.includes(x.discountType) ? x.discountType : "other";
  let discountValue = typeof x.discountValue === "number" && x.discountValue >= 0 ? x.discountValue : null;
  if (["percent", "amount"].includes(discountType) && discountValue == null) discountType = "other";
  if (discountType === "percent" && discountValue > 100) discountType = "other";
  const currency = /^[A-Za-z]{3}$/.test(x.currency || "") ? x.currency.toUpperCase() : null;
  if (discountType === "amount" && !currency) discountType = "other";
  if (!["percent", "amount"].includes(discountType)) discountValue = discountType === "none" ? null : discountValue;
  const startDate = ymdOrNull(x.startDate);
  let endDate = ymdOrNull(x.endDate);
  if (startDate && endDate && endDate < startDate) endDate = null;

  return {
    title: cleanText(x.title, 200),
    description: cleanText(x.description, 2000),
    terms: cleanText(x.terms, 2000),
    brandName: cleanText(x.brandName, 80),
    businessName: cleanText(x.businessName, 120),
    isBrandOffer: Boolean(x.brandName) && !x.businessName,
    primaryCategory: CATEGORY_IDS.includes(x.primaryCategory) ? x.primaryCategory : "services",
    categories: withHotelCategory((x.otherCategories || []).filter((c) => CATEGORY_IDS.includes(c)).slice(0, 3), x),
    tags: ["auto"],
    discountType,
    discountValue: discountType === "percent" || discountType === "amount" ? discountValue : null,
    discountText: cleanText(x.discountText, 120),
    currency: discountType === "amount" ? currency : null,
    startDate,
    endDate,
    timezone: ctx.region.timezone,
    publishedAt: ctx.publishedAt ? ctx.publishedAt.toISOString() : null,
    sourceUrl: ctx.url,
    canonicalUrl: ctx.url,
    sourceName: ctx.sourceName,
    sourceType: ctx.sourceType,
    sourceOfferId: slugify(x.title).slice(0, 60) || null,
    imageUrl: ctx.imageUrl || null,
    availabilityType: AVAILABILITY_TYPES.includes(x.availabilityType) ? x.availabilityType : "both",
    scope: SCOPES.includes(x.scope) ? x.scope : "national",
    city: cleanText(x.city, 80),
    country,
    eligibleLocations: [],
  };
}

/**
 * Geocoding queries for one address, most to least specific. OpenStreetMap
 * rarely knows building names or house numbers, so leading parts are dropped
 * until an area name ("Banani, Dhaka") remains.
 */
export function addressQueries(address, city, regionName) {
  const parts = String(address || "")
    .split(",")
    .map((p) => p.replace(/\(.*?\)/g, "").replace(/-\s*\d{4}\b/, "").trim())
    .filter(Boolean);
  if (city && !parts.some((p) => p.toLowerCase().includes(city.toLowerCase()))) parts.push(city);
  // Full address, then street + area + city, then area + city.
  const tails = [parts, parts.slice(-3), parts.slice(-2)].filter((t) => t.length);
  return [...new Set(tails.map((t) => [...t, regionName].join(", ")))];
}

// Geocodes branch addresses and settles scope so normalizeOfferInput accepts it.
async function resolveGeography(db, input, branches, region) {
  const located = [];
  for (const b of (branches || []).slice(0, MAX_BRANCHES)) {
    const city = cleanText(b.city, 80) || input.city;
    for (const query of addressQueries(b.address, city, region.name)) {
      try {
        const hit = await geocodeAddress(db, query, { country: input.country });
        if (hit) {
          located.push({ name: cleanText(b.name, 120), address: cleanText(b.address, 200), city, country: input.country, latitude: hit.lat, longitude: hit.lng });
          break;
        }
      } catch (err) {
        log.warn("geocode failed", { query, error: err.message });
        break;
      }
    }
  }
  if (located.length && input.scope !== "online") {
    input.scope = "local";
    input.eligibleLocations = located;
    input.city ||= located[0].city;
    if (input.availabilityType === "online") input.availabilityType = "both";
  } else if (input.scope === "online" || input.availabilityType === "online") {
    input.scope = "online";
    input.availabilityType = "online";
  } else if ((input.scope === "local" || input.scope === "city") && input.city) {
    input.scope = "city";
  } else {
    input.scope = "national";
  }
}

/**
 * Stores one extracted offer. Returns { outcome, offerId?, reason? }.
 * outcome: published | held | duplicate | skipped | invalid
 */
export async function publishExtracted(db, x, ctx) {
  const now = ctx.now ?? new Date();
  const decision = decidePublication(x, { ...ctx, now });
  if (decision.action === "skip") return { outcome: "skipped", reason: decision.reason };

  const input = toOfferInput(x, ctx);
  const brandKey = normalizeKey(input.brandName);
  const [dup] = await findDuplicateCandidates(db, { title: input.title, brandKey });
  if (dup) {
    // Seen again in another source: remember the source, and if it is still
    // high-confidence count that as a fresh sighting.
    const set = { updatedAt: now };
    if (decision.action === "publish" && dup.validationStatus === "active") set.lastVerifiedAt = now;
    await db.collection("offers").updateOne(
      { _id: dup._id },
      { $set: set, $addToSet: { alternateSources: { url: ctx.url, sourceType: ctx.sourceType, sourceName: ctx.sourceName } } },
    );
    return { outcome: "duplicate", offerId: String(dup._id) };
  }

  await resolveGeography(db, input, x.branches, ctx.region);
  if (decision.action === "publish") {
    input.validationStatus = "active";
    input.reviewState = "approved";
    input.evidenceNote = `Auto-extracted from ${ctx.sourceName || "source"}: "${cleanText(x.evidenceQuote, 400)}" (confidence ${x.confidence})`;
  } else {
    input.validationStatus = "unverified";
    input.reviewState = "pending";
  }

  try {
    const doc = await createOffer(db, input, { now, actor: "discovery", method: "auto_extract" });
    if (decision.action === "hold") {
      await db.collection("offers").updateOne({ _id: doc._id }, { $set: { statusReason: `Held by discovery: ${decision.reason}` } });
    }
    return { outcome: decision.action === "publish" ? "published" : "held", offerId: String(doc._id), reason: decision.reason };
  } catch (err) {
    if (err instanceof ValidationError) {
      // A duplicate dedupeKey means this exact offer from this URL is already stored.
      if (Object.values(err.errors).some((m) => /already exists/.test(m))) return { outcome: "duplicate" };
      return { outcome: "invalid", reason: JSON.stringify(err.errors) };
    }
    throw err;
  }
}
