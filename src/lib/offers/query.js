// Parses public offer queries and builds the MongoDB aggregation pipeline.

import { BANKS, BANK_IDS, CATEGORY_IDS, SOURCE_TYPE_IDS, SORTS, VALIDITY_MODES } from "../constants.js";
import { addDaysYmd, dayRangeInZone, isValidTimeZone, isYmd, todayYmd, DAY_MS } from "../dates.js";
import { isLatitude, isLongitude, roundCoord } from "../geo.js";
import { cleanText, escapeRegex, normalizeKey } from "../text.js";
import { activeNowFilter, staleDays } from "./status.js";

const SORT_IDS = SORTS.map((s) => s.id);
const MODE_IDS = VALIDITY_MODES.map((m) => m.id);
const SECTIONS = ["brand", "near", "ending", "recent"];
const MAX_RADIUS_KM = 500;

export const PUBLIC_PROJECTION = {
  title: 1,
  slug: 1,
  description: 1,
  brandName: 1,
  businessName: 1,
  isBrandOffer: 1,
  categories: 1,
  primaryCategory: 1,
  tags: 1,
  discountType: 1,
  discountValue: 1,
  discountText: 1,
  originalPrice: 1,
  discountedPrice: 1,
  currency: 1,
  startDate: 1,
  endDate: 1,
  timezone: 1,
  publishedAt: 1,
  sourceUrl: 1,
  sourceName: 1,
  sourceType: 1,
  lastVerifiedAt: 1,
  validationStatus: 1,
  availabilityType: 1,
  scope: 1,
  eligibleLocations: 1,
  country: 1,
  city: 1,
  address: 1,
  imageUrl: 1,
  createdAt: 1,
  distanceMeters: 1,
};

/**
 * @param {URLSearchParams} sp
 * @returns {{ params?: object, errors?: object }}
 */
export function parseOfferQuery(sp, now = new Date()) {
  const errors = {};
  const get = (k) => {
    const v = sp.get(k);
    return v == null || v === "" ? null : v;
  };

  const tz = get("tz") || "UTC";
  if (!isValidTimeZone(tz)) errors.tz = "Unknown timezone";
  const zone = errors.tz ? "UTC" : tz;

  const date = get("date") || todayYmd(zone, now);
  if (!isYmd(date)) errors.date = "Use YYYY-MM-DD";

  let lat = null;
  let lng = null;
  if (get("lat") != null || get("lng") != null) {
    lat = Number(get("lat"));
    lng = Number(get("lng"));
    if (!isLatitude(lat) || !isLongitude(lng)) errors.location = "Invalid coordinates";
    else {
      lat = roundCoord(lat);
      lng = roundCoord(lng);
    }
  }
  const city = cleanText(get("city"), 80);
  const country = get("country")?.toUpperCase() ?? null;
  if (country && !/^[A-Z]{2}$/.test(country)) errors.country = "Use a 2-letter country code";

  const radiusRaw = get("radius") || "25";
  let radiusMode = "km";
  let radiusKm = null;
  if (radiusRaw === "city" || radiusRaw === "country") radiusMode = radiusRaw;
  else {
    radiusKm = Number(radiusRaw);
    if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > MAX_RADIUS_KM) errors.radius = "Radius must be 1–500 km";
  }
  if (radiusMode === "city" && !city) errors.radius = "Entire-city search needs a city";
  if (radiusMode === "country" && !country) errors.radius = "Entire-country search needs a country";

  const mode = get("validity") || "today";
  if (!MODE_IDS.includes(mode)) errors.validity = "Unknown validity filter";
  const from = get("from");
  const to = get("to");
  if (mode === "custom") {
    if (!isYmd(from || "") || !isYmd(to || "")) errors.range = "Custom range needs from and to dates";
    else if (to < from) errors.range = "End of range is before start";
    else if ((Date.parse(to) - Date.parse(from)) / DAY_MS > 366) errors.range = "Range can be at most one year";
  }

  const category = get("category");
  if (category && !CATEGORY_IDS.includes(category)) errors.category = "Unknown category";
  const sourceType = get("sourceType");
  if (sourceType && !SOURCE_TYPE_IDS.includes(sourceType)) errors.sourceType = "Unknown source type";
  const bank = get("bank");
  if (bank && !BANK_IDS.includes(bank)) errors.bank = "Unknown bank";
  const availability = get("availability") || "any";
  if (!["any", "online", "online_only", "in_store"].includes(availability)) errors.availability = "Unknown availability";
  const minDiscount = get("minDiscount") == null ? null : Number(get("minDiscount"));
  if (minDiscount != null && !(minDiscount >= 0 && minDiscount <= 100)) errors.minDiscount = "Use 0–100";

  const section = get("section");
  if (section && !SECTIONS.includes(section)) errors.section = "Unknown section";
  let sort = get("sort") || (section === "near" ? "nearest" : section === "ending" ? "ending" : "newest");
  if (!SORT_IDS.includes(sort) && sort !== "recent") errors.sort = "Unknown sort";
  if (section === "recent") sort = "recent";
  if (sort === "nearest" && lat == null) sort = "newest";
  if (section === "near" && lat == null) errors.section = "Near You needs coordinates";

  const page = Math.max(1, Math.min(500, parseInt(get("page") || "1", 10) || 1));
  const limit = Math.max(1, Math.min(50, parseInt(get("limit") || "20", 10) || 20));

  if (Object.keys(errors).length) return { errors };
  return {
    params: {
      tz: zone,
      date,
      location: { lat, lng, city, cityKey: normalizeKey(city), country },
      radiusMode,
      radiusKm,
      includeNational: get("national") !== "0",
      includeUnverified: get("unverified") === "1",
      mode,
      from,
      to,
      q: cleanText(get("q"), 100),
      category,
      brandKey: normalizeKey(get("brand")),
      sourceType,
      bank,
      availability,
      minDiscount,
      section,
      sort,
      page,
      limit,
      withCounts: get("counts") === "1",
    },
  };
}

function statusFilter(p, now) {
  if (!p.includeUnverified) return activeNowFilter(now);
  // Unverified offers are only shown when explicitly requested, and still
  // never after their stated end date.
  const active = activeNowFilter(now);
  return {
    reviewState: "approved",
    mergedInto: null,
    $or: [{ validationStatus: "unverified", $or: [{ endDate: null }, { endDate: { $gt: now } }] }, { $and: [{ validationStatus: "active" }, { $or: active.$or }] }],
  };
}

function validityFilter(p) {
  const day = dayRangeInZone(p.date, p.tz);
  const startsBy = (t) => ({ $or: [{ startDate: null }, { startDate: { $lt: t } }] });
  const endsAfter = (t) => ({ $or: [{ endDate: null }, { endDate: { $gte: t } }] });
  switch (p.mode) {
    case "starting_today":
      return { startDate: { $gte: day.start, $lt: day.end } };
    case "ending_today":
      return { endDate: { $gte: day.start, $lt: day.end } };
    case "week":
      return startsBy(dayRangeInZone(addDaysYmd(p.date, 6), p.tz).end);
    case "ongoing":
      return { $and: [{ endDate: null }, startsBy(day.end)] };
    case "custom": {
      const start = dayRangeInZone(p.from, p.tz).start;
      const end = dayRangeInZone(p.to, p.tz).end;
      return { $and: [startsBy(end), endsAfter(start)] };
    }
    default:
      return { $and: [startsBy(day.end), endsAfter(day.start)] };
  }
}

function attributeFilters(p, now) {
  const and = [];
  if (p.q) {
    const re = new RegExp(escapeRegex(p.q), "i");
    and.push({ $or: [{ title: re }, { brandName: re }, { businessName: re }, { description: re }, { tags: re }] });
  }
  // `categories` always contains the primary one, so a hotel buffet tagged
  // food + hotels shows under both.
  if (p.category) and.push({ categories: p.category });
  if (p.brandKey) and.push({ brandKey: p.brandKey });
  if (p.sourceType) and.push({ sourceType: p.sourceType });
  if (p.bank) and.push({ sourceName: BANKS.find((b) => b.id === p.bank).sourceName });
  if (p.availability === "online") and.push({ availabilityType: { $in: ["online", "both"] } });
  if (p.availability === "online_only") and.push({ availabilityType: "online" });
  if (p.availability === "in_store") and.push({ availabilityType: { $in: ["in_store", "both"] } });
  if (p.minDiscount) and.push({ discountType: "percent", discountValue: { $gte: p.minDiscount } });
  if (p.section === "brand") and.push({ isBrandOffer: true });
  if (p.section === "ending") and.push({ endDate: { $gt: now, $lte: new Date(now.getTime() + 7 * DAY_MS) } });
  if (p.section === "recent") and.push({ createdAt: { $gte: new Date(now.getTime() - 14 * DAY_MS) } });
  return and;
}

const ciEquals = (s) => new RegExp(`^${escapeRegex(s)}$`, "i");

// Offers that apply regardless of distance: online, nationwide, or city-wide.
function areaWideConditions(p) {
  const { cityKey, country } = p.location;
  const or = [];
  if (cityKey) or.push({ scope: "city", cityKey, ...(country ? { country } : {}) });
  if (p.includeNational) {
    if (country) {
      or.push({ scope: "national", country });
      or.push({ scope: "online", $or: [{ country: null }, { country }] });
    } else {
      or.push({ scope: { $in: ["national", "online"] } });
    }
  }
  return or;
}

// Offers with branches, matched by city or country name when there is no
// distance to go on (manual city selection, or city/country search modes).
function branchAreaConditions(p) {
  const { city, country } = p.location;
  if (p.radiusMode === "country" && country)
    return [{ scope: "local", $or: [{ country }, { "eligibleLocations.country": country }] }];
  if (city)
    return [{ scope: "local", $or: [{ city: ciEquals(city) }, { "eligibleLocations.city": ciEquals(city) }] }];
  return [];
}

function sortStages(sort) {
  const FAR = new Date("9999-12-31T00:00:00Z");
  switch (sort) {
    case "nearest":
      return [
        { $addFields: { _k: { $ifNull: ["$distanceMeters", Number.MAX_SAFE_INTEGER] } } },
        { $sort: { _k: 1, endDate: 1, _id: 1 } },
      ];
    case "ending":
      return [{ $addFields: { _k: { $ifNull: ["$endDate", FAR] } } }, { $sort: { _k: 1, _id: 1 } }];
    case "discount":
      return [
        { $addFields: { _k: { $cond: [{ $eq: ["$discountType", "percent"] }, { $ifNull: ["$discountValue", -1] }, -1] } } },
        { $sort: { _k: -1, _id: -1 } },
      ];
    case "verified":
      return [{ $sort: { lastVerifiedAt: -1, _id: -1 } }];
    case "recent":
      return [{ $sort: { createdAt: -1, _id: -1 } }];
    default:
      return [{ $addFields: { _k: { $ifNull: ["$publishedAt", "$createdAt"] } } }, { $sort: { _k: -1, _id: -1 } }];
  }
}

// Location, date, status and attribute filters, before sorting and paging.
function matchStages(p, now) {
  const base = { $and: [statusFilter(p, now), validityFilter(p), ...attributeFilters(p, now)] };
  const { lat, lng } = p.location;
  const pipeline = [];

  if (lat != null) {
    const geoOr = [];
    if (p.radiusMode === "km") geoOr.push({ distanceMeters: { $lte: p.radiusKm * 1000 } });
    else geoOr.push(...branchAreaConditions(p));
    if (p.section !== "near") geoOr.push(...areaWideConditions(p));
    pipeline.push(
      {
        $geoNear: {
          near: { type: "Point", coordinates: [lng, lat] },
          distanceField: "distanceMeters",
          key: "geo",
          spherical: true,
          query: base,
        },
      },
      { $match: { $or: geoOr } },
    );
    const unionOr = p.section === "near" ? [] : areaWideConditions(p);
    if (unionOr.length) {
      pipeline.push({
        $unionWith: { coll: "offers", pipeline: [{ $match: { $and: [base, { geo: { $exists: false } }, { $or: unionOr }] } }] },
      });
    }
  } else {
    const or = [...areaWideConditions(p), ...branchAreaConditions(p)];
    // No location at all: only offers that do not depend on location.
    pipeline.push({ $match: { $and: [base, { $or: or.length ? or : [{ scope: "online" }] }] } });
  }
  return pipeline;
}

export function buildOfferPipeline(p, now = new Date()) {
  return [
    ...matchStages(p, now),
    ...sortStages(p.sort),
    {
      $facet: {
        items: [{ $skip: (p.page - 1) * p.limit }, { $limit: p.limit }, { $project: PUBLIC_PROJECTION }],
        total: [{ $count: "n" }],
      },
    },
  ];
}

/**
 * Offers per category and for Brand Offers under the current location, date
 * and other filters, so each category chip can show what selecting it gives.
 */
export function buildCountsPipeline(p, now = new Date()) {
  const unscoped = { ...p, category: null, section: p.section === "brand" ? null : p.section };
  return [
    ...matchStages(unscoped, now),
    {
      $facet: {
        all: [{ $count: "n" }],
        brand: [{ $match: { isBrandOffer: true } }, { $count: "n" }],
        byCategory: [{ $unwind: "$categories" }, { $group: { _id: "$categories", n: { $sum: 1 } } }],
      },
    },
  ];
}

async function countOffers(db, params, now) {
  const [res] = await db.collection("offers").aggregate(buildCountsPipeline(params, now), { maxTimeMS: 8000 }).toArray();
  return {
    all: res?.all?.[0]?.n ?? 0,
    brand: res?.brand?.[0]?.n ?? 0,
    categories: Object.fromEntries((res?.byCategory ?? []).map((c) => [c._id, c.n])),
  };
}

export async function searchOffers(db, params, now = new Date()) {
  const [[res], counts] = await Promise.all([
    db.collection("offers").aggregate(buildOfferPipeline(params, now), { maxTimeMS: 8000 }).toArray(),
    params.withCounts ? countOffers(db, params, now) : null,
  ]);
  const total = res?.total?.[0]?.n ?? 0;
  return {
    items: (res?.items ?? []).map(toPublicOffer),
    total,
    page: params.page,
    limit: params.limit,
    hasMore: params.page * params.limit < total,
    staleDays: staleDays(),
    ...(counts ? { counts } : {}),
  };
}

export function toPublicOffer(d) {
  const { _id, distanceMeters, ...rest } = d;
  return {
    id: String(_id),
    ...rest,
    distanceKm: distanceMeters == null ? null : Math.round(distanceMeters / 100) / 10,
  };
}
