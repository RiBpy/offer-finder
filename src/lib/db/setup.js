import {
  AVAILABILITY_TYPES,
  CATEGORY_IDS,
  DISCOUNT_TYPES,
  REVIEW_STATES,
  SCOPES,
  SOURCE_TYPE_IDS,
  VALIDATION_STATUSES,
} from "../constants.js";

const nullable = (bsonType) => ({ bsonType: [bsonType, "null"] });

// Server-side schema for the offers collection. Application code validates
// input first (src/lib/offers/model.js); this validator is the last line of
// defence against malformed writes.
export const offerValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "title",
      "slug",
      "dedupeKey",
      "sourceUrl",
      "sourceType",
      "primaryCategory",
      "categories",
      "validationStatus",
      "reviewState",
      "availabilityType",
      "scope",
      "createdAt",
      "updatedAt",
    ],
    properties: {
      title: { bsonType: "string", minLength: 3, maxLength: 200 },
      slug: { bsonType: "string", pattern: "^[a-z0-9-]+$" },
      description: nullable("string"),
      terms: nullable("string"),
      brandName: nullable("string"),
      brandKey: nullable("string"),
      businessName: nullable("string"),
      isBrandOffer: { bsonType: "bool" },
      categories: { bsonType: "array", minItems: 1, items: { enum: CATEGORY_IDS } },
      primaryCategory: { enum: CATEGORY_IDS },
      tags: { bsonType: "array", items: { bsonType: "string" } },
      discountType: { enum: DISCOUNT_TYPES },
      discountValue: { bsonType: ["double", "int", "long", "decimal", "null"] },
      discountText: nullable("string"),
      originalPrice: { bsonType: ["double", "int", "long", "decimal", "null"] },
      discountedPrice: { bsonType: ["double", "int", "long", "decimal", "null"] },
      currency: { bsonType: ["string", "null"], pattern: "^[A-Z]{3}$" },
      startDate: nullable("date"),
      endDate: nullable("date"),
      timezone: nullable("string"),
      publishedAt: nullable("date"),
      sourceUrl: { bsonType: "string", pattern: "^https?://" },
      canonicalUrl: nullable("string"),
      dedupeKey: { bsonType: "string" },
      sourceName: nullable("string"),
      sourceType: { enum: SOURCE_TYPE_IDS },
      sourceOfferId: nullable("string"),
      sourcePublicationDate: nullable("date"),
      lastVerifiedAt: nullable("date"),
      lastCheckedAt: nullable("date"),
      validationStatus: { enum: VALIDATION_STATUSES },
      reviewState: { enum: REVIEW_STATES },
      statusReason: nullable("string"),
      verificationEvidence: {
        bsonType: "array",
        items: {
          bsonType: "object",
          required: ["at", "method"],
          properties: {
            at: { bsonType: "date" },
            method: { enum: ["admin", "structured_data", "source_check"] },
            note: nullable("string"),
          },
        },
      },
      availabilityType: { enum: AVAILABILITY_TYPES },
      scope: { enum: SCOPES },
      eligibleLocations: {
        bsonType: "array",
        items: {
          bsonType: "object",
          properties: {
            name: nullable("string"),
            address: nullable("string"),
            city: nullable("string"),
            country: nullable("string"),
            latitude: { bsonType: ["double", "int", "null"], minimum: -90, maximum: 90 },
            longitude: { bsonType: ["double", "int", "null"], minimum: -180, maximum: 180 },
          },
        },
      },
      geo: {
        bsonType: "object",
        required: ["type", "coordinates"],
        properties: { type: { enum: ["MultiPoint"] }, coordinates: { bsonType: "array", minItems: 1 } },
      },
      latitude: { bsonType: ["double", "int", "null"] },
      longitude: { bsonType: ["double", "int", "null"] },
      country: { bsonType: ["string", "null"], pattern: "^[A-Z]{2}$" },
      city: nullable("string"),
      cityKey: nullable("string"),
      address: nullable("string"),
      imageUrl: nullable("string"),
      mergedInto: { bsonType: ["objectId", "null"] },
      viewCount: { bsonType: ["int", "long", "double"] },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" },
    },
  },
};

async function ensureCollection(db, name, options) {
  const existing = await db.listCollections({ name }, { nameOnly: true }).toArray();
  if (existing.length === 0) {
    try {
      await db.createCollection(name, options);
    } catch (err) {
      if (err.codeName !== "NamespaceExists") throw err;
    }
  } else if (options?.validator) {
    await db.command({ collMod: name, validator: options.validator, validationLevel: "moderate" });
  }
}

export async function ensureCollections(db) {
  await ensureCollection(db, "offers", { validator: offerValidator, validationLevel: "moderate" });
  await ensureCollection(db, "sources");
  await ensureCollection(db, "jobs");

  const offers = db.collection("offers");
  await offers.createIndexes([
    { key: { slug: 1 }, name: "slug_unique", unique: true },
    // canonical URL, plus the source's own offer id when one page lists several offers
    { key: { dedupeKey: 1 }, name: "dedupe_unique", unique: true },
    { key: { canonicalUrl: 1 }, name: "canonical_url" },
    {
      key: { sourceName: 1, sourceOfferId: 1 },
      name: "source_offer_unique",
      unique: true,
      partialFilterExpression: { sourceOfferId: { $type: "string" } },
    },
    { key: { geo: "2dsphere" }, name: "geo_2dsphere" },
    { key: { validationStatus: 1, reviewState: 1, endDate: 1 }, name: "status_end" },
    { key: { primaryCategory: 1, validationStatus: 1, endDate: 1 }, name: "category_status_end" },
    { key: { brandKey: 1, validationStatus: 1 }, name: "brand_status" },
    { key: { country: 1, scope: 1, cityKey: 1 }, name: "country_scope_city" },
    { key: { startDate: 1 }, name: "start_date" },
    { key: { createdAt: -1 }, name: "created_desc" },
    { key: { lastVerifiedAt: -1 }, name: "verified_desc" },
    { key: { publishedAt: -1 }, name: "published_desc" },
    { key: { reviewState: 1, createdAt: -1 }, name: "review_queue" },
  ]);

  await db.collection("sources").createIndexes([{ key: { host: 1 }, name: "host_unique", unique: true }]);
  await db.collection("jobs").createIndexes([
    { key: { status: 1, createdAt: -1 }, name: "status_created" },
    { key: { offerId: 1, createdAt: -1 }, name: "offer_created" },
  ]);
}
