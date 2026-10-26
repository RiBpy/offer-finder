// Scheduled job: expire offers whose end date passed, then re-check a batch of
// offers against their sources, prioritising those ending soon and those with
// the most views.

import { DAY_MS } from "../dates.js";
import { staleDays } from "../offers/status.js";
import { verifyOffer } from "../verify/verifier.js";
import { log } from "../log.js";

export async function expireOffers(db, now = new Date()) {
  const expired = await db.collection("offers").updateMany(
    { validationStatus: { $in: ["active", "unverified"] }, endDate: { $lte: now } },
    { $set: { validationStatus: "expired", statusReason: "End date passed", updatedAt: now } },
  );
  const stale = await db.collection("offers").updateMany(
    { validationStatus: "active", endDate: null, $or: [{ lastVerifiedAt: null }, { lastVerifiedAt: { $lt: new Date(now.getTime() - staleDays() * DAY_MS) } }] },
    { $set: { validationStatus: "unverified", statusReason: `No end date and not re-verified for ${staleDays()} days`, updatedAt: now } },
  );
  return { expired: expired.modifiedCount, stale: stale.modifiedCount };
}

export async function revalidateBatch(db, { limit = 20, now = new Date(), deadlineMs = 50000 } = {}) {
  const started = Date.now();
  const sweep = await expireOffers(db, now);
  const recentlyChecked = new Date(now.getTime() - 12 * 3600 * 1000);
  const candidates = await db
    .collection("offers")
    .aggregate([
      {
        $match: {
          mergedInto: null,
          reviewState: { $ne: "rejected" },
          validationStatus: { $in: ["active", "unverified"] },
          $or: [{ lastCheckedAt: null }, { lastCheckedAt: { $lt: recentlyChecked } }],
        },
      },
      { $addFields: { _end: { $ifNull: ["$endDate", new Date("9999-12-31")] } } },
      { $sort: { _end: 1, viewCount: -1, lastCheckedAt: 1 } },
      { $limit: limit },
    ])
    .toArray();

  const outcomes = {};
  let checked = 0;
  for (const offer of candidates) {
    if (Date.now() - started > deadlineMs) break;
    try {
      const d = await verifyOffer(db, offer, { now: new Date() });
      outcomes[d.outcome] = (outcomes[d.outcome] || 0) + 1;
    } catch (err) {
      log.error("verify failed", { offerId: String(offer._id), error: err.message });
      outcomes.error = (outcomes.error || 0) + 1;
    }
    checked++;
  }
  return { ...sweep, checked, remaining: candidates.length - checked, outcomes };
}
