import {
  AVAILABILITY_TYPES,
  CATEGORY_IDS,
  DISCOUNT_TYPES,
  REVIEW_STATES,
  SCOPES,
  SOURCE_TYPE_IDS,
  VALIDATION_STATUSES,
} from "../constants.js";
import { endOfDayInZone, isValidTimeZone, isYmd, startOfDayInZone } from "../dates.js";
import { isLatitude, isLongitude } from "../geo.js";
import { cleanMultiline, cleanText, normalizeKey } from "../text.js";
import { canonicalizeUrl } from "../dedupe.js";

export class ValidationError extends Error {
  constructor(errors) {
    super("Invalid offer input");
    this.errors = errors;
    this.status = 400;
  }
}

function parseNumber(v) {
  if (v === "" || v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

function parseUrl(v) {
  const s = cleanText(v);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

// Dates arrive as "YYYY-MM-DD" (interpreted in the offer's timezone) or as an
// ISO timestamp. Date-only end dates mean "until the end of that day".
function parseDate(v, tz, endOfDay) {
  if (v === "" || v == null) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? undefined : v;
  const s = String(v).trim();
  if (isYmd(s)) return endOfDay ? endOfDayInZone(s, tz) : startOfDayInZone(s, tz);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

function stringList(v, max = 20, itemMax = 40) {
  const arr = Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [];
  return [...new Set(arr.map((x) => cleanText(x, itemMax)).filter(Boolean).map((x) => x.toLowerCase()))].slice(0, max);
}

/**
 * Validates admin input and returns the normalized offer fields (no _id,
 * slug or timestamps). Throws ValidationError with a field → message map.
 */
export function normalizeOfferInput(input, { now = new Date() } = {}) {
  const e = {};
  const tz = cleanText(input.timezone) || "UTC";
  if (!isValidTimeZone(tz)) e.timezone = "Unknown timezone";
  const zone = e.timezone ? "UTC" : tz;

  const title = cleanText(input.title, 200);
  if (!title || title.length < 3) e.title = "Title is required (3–200 characters)";

  const sourceUrl = parseUrl(input.sourceUrl);
  if (!sourceUrl) e.sourceUrl = "A valid http(s) source URL is required";
  const canonicalInput = parseUrl(input.canonicalUrl);
  if (canonicalInput === undefined) e.canonicalUrl = "Invalid canonical URL";
  const imageUrl = parseUrl(input.imageUrl);
  if (imageUrl === undefined) e.imageUrl = "Invalid image URL";

  const sourceType = input.sourceType;
  if (!SOURCE_TYPE_IDS.includes(sourceType)) e.sourceType = "Choose a source type";

  const primaryCategory = input.primaryCategory;
  if (!CATEGORY_IDS.includes(primaryCategory)) e.primaryCategory = "Choose a primary category";
  const extra = (Array.isArray(input.categories) ? input.categories : []).filter((c) => CATEGORY_IDS.includes(c));
  const categories = [...new Set([primaryCategory, ...extra])].filter(Boolean);

  const availabilityType = input.availabilityType;
  if (!AVAILABILITY_TYPES.includes(availabilityType)) e.availabilityType = "Choose online, in-store or both";
  const scope = input.scope;
  if (!SCOPES.includes(scope)) e.scope = "Choose where the offer applies";

  const validationStatus = input.validationStatus || "unverified";
  if (!VALIDATION_STATUSES.includes(validationStatus)) e.validationStatus = "Invalid status";
  const reviewState = input.reviewState || "pending";
  if (!REVIEW_STATES.includes(reviewState)) e.reviewState = "Invalid review state";

  const discountType = input.discountType || "none";
  if (!DISCOUNT_TYPES.includes(discountType)) e.discountType = "Invalid discount type";
  const discountValue = parseNumber(input.discountValue);
  const originalPrice = parseNumber(input.originalPrice);
  const discountedPrice = parseNumber(input.discountedPrice);
  if (Number.isNaN(discountValue) || (discountValue != null && discountValue < 0)) e.discountValue = "Invalid number";
  if (discountType === "percent" && discountValue != null && discountValue > 100) e.discountValue = "Percent must be 0–100";
  if (["percent", "amount"].includes(discountType) && discountValue == null)
    e.discountValue = "Enter the discount stated by the source";
  if (Number.isNaN(originalPrice) || (originalPrice != null && originalPrice < 0)) e.originalPrice = "Invalid price";
  if (Number.isNaN(discountedPrice) || (discountedPrice != null && discountedPrice < 0)) e.discountedPrice = "Invalid price";
  if (originalPrice != null && discountedPrice != null && !(discountedPrice < originalPrice))
    e.discountedPrice = "Discounted price must be lower than the original price";
  const currency = cleanText(input.currency)?.toUpperCase() || null;
  if (currency && !/^[A-Z]{3}$/.test(currency)) e.currency = "Use a 3-letter currency code";
  if ((originalPrice != null || discountedPrice != null || discountType === "amount") && !currency)
    e.currency = "Currency is required with prices or amounts";

  const startDate = parseDate(input.startDate, zone, false);
  const endDate = parseDate(input.endDate, zone, true);
  const publishedAt = parseDate(input.publishedAt, zone, false);
  if (startDate === undefined) e.startDate = "Use YYYY-MM-DD";
  if (endDate === undefined) e.endDate = "Use YYYY-MM-DD";
  if (publishedAt === undefined) e.publishedAt = "Use YYYY-MM-DD";
  if (startDate && endDate && endDate < startDate) e.endDate = "End date is before start date";

  const country = cleanText(input.country)?.toUpperCase() || null;
  if (country && !/^[A-Z]{2}$/.test(country)) e.country = "Use a 2-letter country code";
  const city = cleanText(input.city, 80);

  const locs = Array.isArray(input.eligibleLocations) ? input.eligibleLocations.slice(0, 200) : [];
  const eligibleLocations = [];
  locs.forEach((l, i) => {
    const lat = parseNumber(l?.latitude);
    const lng = parseNumber(l?.longitude);
    const hasCoords = lat != null || lng != null;
    if (hasCoords && !(isLatitude(lat) && isLongitude(lng))) {
      e[`eligibleLocations.${i}`] = "Latitude/longitude out of range";
      return;
    }
    const loc = {
      name: cleanText(l?.name, 120),
      address: cleanText(l?.address, 200),
      city: cleanText(l?.city, 80),
      country: cleanText(l?.country)?.toUpperCase() || country,
      latitude: hasCoords ? lat : null,
      longitude: hasCoords ? lng : null,
    };
    if (loc.name || loc.address || loc.city || hasCoords) eligibleLocations.push(loc);
  });

  if (scope === "local" && !eligibleLocations.some((l) => l.latitude != null))
    e.eligibleLocations = "Local offers need at least one branch with verified coordinates";
  if (scope === "city" && !city) e.city = "City-wide offers need a city";
  if (scope === "national" && !country) e.country = "Nationwide offers need a country";
  if (scope === "online" && availabilityType !== "online")
    e.availabilityType = "Online-scope offers must be online only";

  const evidenceNote = cleanText(input.evidenceNote, 500);
  if (validationStatus === "active" && !evidenceNote && !input.keepEvidence)
    e.evidenceNote = "Describe the evidence that the offer is active (e.g. 'Source states valid until 31 Oct')";
  if (validationStatus === "active" && endDate && endDate <= now)
    e.validationStatus = "The end date has passed; this offer cannot be Active";

  if (Object.keys(e).length) throw new ValidationError(e);

  const canonicalUrl = canonicalizeUrl(canonicalInput || sourceUrl);
  const sourceOfferId = cleanText(input.sourceOfferId, 200);
  const points = eligibleLocations.filter((l) => l.latitude != null).map((l) => [l.longitude, l.latitude]);
  const first = eligibleLocations.find((l) => l.latitude != null);

  return {
    fields: {
      title,
      description: cleanMultiline(input.description, 2000),
      terms: cleanMultiline(input.terms, 2000),
      brandName: cleanText(input.brandName, 80),
      brandKey: normalizeKey(input.brandName),
      businessName: cleanText(input.businessName, 120),
      isBrandOffer: Boolean(input.isBrandOffer),
      categories,
      primaryCategory,
      tags: stringList(input.tags),
      discountType,
      discountValue: discountType === "none" ? null : discountValue,
      discountText: cleanText(input.discountText, 120),
      originalPrice,
      discountedPrice,
      currency,
      startDate,
      endDate,
      timezone: zone,
      publishedAt,
      sourceUrl,
      canonicalUrl,
      dedupeKey: sourceOfferId ? `${canonicalUrl}#${sourceOfferId}` : canonicalUrl,
      sourceName: cleanText(input.sourceName, 120) || new URL(sourceUrl).hostname.replace(/^www\./, ""),
      sourceType,
      sourceOfferId,
      sourcePublicationDate: publishedAt,
      validationStatus,
      reviewState,
      availabilityType,
      scope,
      eligibleLocations,
      latitude: first ? first.latitude : null,
      longitude: first ? first.longitude : null,
      country,
      city,
      cityKey: normalizeKey(city),
      address: cleanText(input.address, 200) || first?.address || null,
      imageUrl,
    },
    geo: points.length ? { type: "MultiPoint", coordinates: points } : null,
    evidenceNote,
  };
}
