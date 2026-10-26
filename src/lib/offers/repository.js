// Database operations on offers.

import { ObjectId } from "mongodb";
import { slugify } from "../text.js";
import { normalizeOfferInput, ValidationError } from "./model.js";
import { activeNowFilter } from "./status.js";
import { PUBLIC_PROJECTION, toPublicOffer } from "./query.js";

export function toObjectId(id) {
  return typeof id === "string" && ObjectId.isValid(id) && id.length === 24 ? new ObjectId(id) : null;
}

function makeSlug(title, id) {
  return `${slugify(title) || "offer"}-${id.toHexString().slice(-6)}`;
}

function duplicateKeyError(err) {
  if (err?.code !== 11000) return err;
  const field = err.keyPattern?.dedupeKey || err.keyPattern?.sourceOfferId ? "sourceUrl" : "slug";
  return new ValidationError({ [field]: "An offer with this source URL already exists" });
}

function evidenceEntry(method, note, now) {
  return { at: now, method, note: note || null };
}

export async function createOffer(db, input, { now = new Date(), actor = "admin" } = {}) {
  const { fields, geo, evidenceNote } = normalizeOfferInput(input, { now });
  const _id = new ObjectId();
  const doc = {
    _id,
    ...fields,
    slug: makeSlug(fields.title, _id),
    ...(geo ? { geo } : {}),
    verificationEvidence: evidenceNote ? [evidenceEntry("admin", `${evidenceNote} (by ${actor})`, now)] : [],
    lastVerifiedAt: fields.validationStatus === "active" ? now : null,
    lastCheckedAt: null,
    statusReason: null,
    mergedInto: null,
    viewCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await db.collection("offers").insertOne(doc);
  } catch (err) {
    throw duplicateKeyError(err);
  }
  return doc;
}

export async function updateOffer(db, id, input, { now = new Date(), actor = "admin" } = {}) {
  const _id = toObjectId(id);
  if (!_id) return null;
  const existing = await db.collection("offers").findOne({ _id });
  if (!existing) return null;
  // An edit that keeps an offer Active may reuse its existing evidence.
  const keepEvidence = existing.validationStatus === "active" && input.validationStatus === "active";
  const { fields, geo, evidenceNote } = normalizeOfferInput({ ...input, keepEvidence }, { now });
  const update = { $set: { ...fields, updatedAt: now } };
  if (geo) update.$set.geo = geo;
  else update.$unset = { geo: "" };
  if (evidenceNote) {
    update.$push = { verificationEvidence: evidenceEntry("admin", `${evidenceNote} (by ${actor})`, now) };
    if (fields.validationStatus === "active") update.$set.lastVerifiedAt = now;
  }
  if (fields.validationStatus === "active" && !existing.lastVerifiedAt) update.$set.lastVerifiedAt = now;
  if (fields.validationStatus !== existing.validationStatus) update.$set.statusReason = `Set to ${fields.validationStatus} by ${actor}`;
  try {
    return await db.collection("offers").findOneAndUpdate({ _id }, update, { returnDocument: "after" });
  } catch (err) {
    throw duplicateKeyError(err);
  }
}

const QUICK_ACTIONS = {
  approve: { reviewState: "approved" },
  reject: { reviewState: "rejected" },
  mark_active: { validationStatus: "active", reviewState: "approved" },
  mark_unverified: { validationStatus: "unverified" },
  mark_expired: { validationStatus: "expired" },
  mark_unavailable: { validationStatus: "unavailable" },
};

/** Status-only changes from the admin dashboard. */
export async function applyQuickAction(db, id, action, { note, now = new Date(), actor = "admin" } = {}) {
  const _id = toObjectId(id);
  const set = QUICK_ACTIONS[action];
  if (!_id || !set) throw new ValidationError({ action: "Unknown action" });
  const existing = await db.collection("offers").findOne({ _id });
  if (!existing) return null;

  const update = { $set: { ...set, updatedAt: now, statusReason: `${action.replace("_", " ")} by ${actor}${note ? `: ${note}` : ""}` } };
  const becomesActive = (set.validationStatus ?? existing.validationStatus) === "active";
  if (action === "approve" && existing.validationStatus === "active" && !existing.lastVerifiedAt) update.$set.lastVerifiedAt = now;
  if (action === "mark_active") {
    if (!note) throw new ValidationError({ note: "Describe the evidence that the offer is active" });
    if (existing.endDate && existing.endDate <= now) throw new ValidationError({ action: "The end date has passed" });
    update.$set.lastVerifiedAt = now;
    update.$push = { verificationEvidence: evidenceEntry("admin", `${note} (by ${actor})`, now) };
  } else if (becomesActive && action === "approve" && existing.endDate && existing.endDate <= now) {
    update.$set.validationStatus = "expired";
  }
  return db.collection("offers").findOneAndUpdate({ _id }, update, { returnDocument: "after" });
}

/** Hides `duplicateId` and records its source on `primaryId`. */
export async function mergeOffers(db, primaryId, duplicateId, { now = new Date(), actor = "admin" } = {}) {
  const p = toObjectId(primaryId);
  const d = toObjectId(duplicateId);
  if (!p || !d || p.equals(d)) throw new ValidationError({ merge: "Choose two different offers" });
  const [primary, dup] = await Promise.all([
    db.collection("offers").findOne({ _id: p }),
    db.collection("offers").findOne({ _id: d }),
  ]);
  if (!primary || !dup) return null;
  if (primary.mergedInto) throw new ValidationError({ merge: "The primary offer is itself merged into another" });
  await db.collection("offers").updateOne(
    { _id: d },
    { $set: { mergedInto: p, reviewState: "rejected", statusReason: `Merged into ${primary.slug} by ${actor}`, updatedAt: now } },
  );
  await db.collection("offers").updateMany({ mergedInto: d }, { $set: { mergedInto: p, updatedAt: now } });
  await db.collection("offers").updateOne(
    { _id: p },
    {
      $addToSet: { alternateSources: { url: dup.sourceUrl, sourceType: dup.sourceType, sourceName: dup.sourceName } },
      $set: { updatedAt: now },
    },
  );
  return db.collection("offers").findOne({ _id: p });
}

/** Public lookup: only approved, non-merged offers. Expired ones are returned
 * so the details page can say so instead of 404ing a shared link. */
export async function getPublicOfferBySlug(db, slug) {
  if (typeof slug !== "string" || !/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const doc = await db
    .collection("offers")
    .findOne(
      { slug, reviewState: "approved", mergedInto: null },
      { projection: { ...PUBLIC_PROJECTION, terms: 1, alternateSources: 1, canonicalUrl: 1, updatedAt: 1, verificationEvidence: { $slice: -1 } } },
    );
  return doc ? toPublicOffer(doc) : null;
}

export async function getPublicOffersByIds(db, ids, now = new Date()) {
  const oids = ids.map(toObjectId).filter(Boolean).slice(0, 100);
  if (!oids.length) return [];
  const docs = await db
    .collection("offers")
    .find({ _id: { $in: oids }, reviewState: "approved", mergedInto: null }, { projection: PUBLIC_PROJECTION })
    .toArray();
  return docs.map(toPublicOffer);
}

export async function incrementViews(db, slug) {
  await db.collection("offers").updateOne({ slug }, { $inc: { viewCount: 1 } });
}

export async function countActive(db, now = new Date()) {
  return db.collection("offers").countDocuments(activeNowFilter(now));
}

export async function getOfferForAdmin(db, id) {
  const _id = toObjectId(id);
  return _id ? db.collection("offers").findOne({ _id }) : null;
}

const ADMIN_TABS = {
  pending: { reviewState: "pending", mergedInto: null },
  active: { reviewState: "approved", validationStatus: "active", mergedInto: null },
  unverified: { validationStatus: "unverified", reviewState: { $ne: "rejected" }, mergedInto: null },
  expired: { validationStatus: { $in: ["expired", "unavailable"] }, mergedInto: null },
  rejected: { $or: [{ reviewState: "rejected" }, { mergedInto: { $ne: null } }] },
  all: {},
};

export async function listOffersForAdmin(db, { tab = "pending", q, page = 1, limit = 30 } = {}) {
  const filter = { ...(ADMIN_TABS[tab] ?? ADMIN_TABS.pending) };
  if (q) {
    const re = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$and = [{ $or: [{ title: re }, { brandName: re }, { sourceUrl: re }] }];
  }
  const cursor = db
    .collection("offers")
    .find(filter, {
      projection: {
        title: 1, slug: 1, brandName: 1, businessName: 1, primaryCategory: 1, validationStatus: 1, reviewState: 1,
        endDate: 1, startDate: 1, lastVerifiedAt: 1, lastCheckedAt: 1, statusReason: 1, sourceUrl: 1, mergedInto: 1, createdAt: 1,
      },
    })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  const [items, total, counts] = await Promise.all([
    cursor.toArray(),
    db.collection("offers").countDocuments(filter),
    Promise.all(Object.entries(ADMIN_TABS).map(async ([k, f]) => [k, await db.collection("offers").countDocuments(f)])),
  ]);
  return { items, total, counts: Object.fromEntries(counts) };
}
