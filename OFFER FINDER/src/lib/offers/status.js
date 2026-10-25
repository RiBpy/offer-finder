// Rules that decide whether an offer may be shown as Active right now.

import { DAY_MS } from "../dates.js";

export function staleDays() {
  const n = Number(process.env.OFFER_STALE_DAYS);
  return Number.isFinite(n) && n > 0 ? n : 7;
}

/**
 * Mongo filter for offers that are publicly visible as Active at `now`:
 * approved, active, not merged, not past their end date, and, if they have no
 * end date, verified within the staleness window.
 */
export function activeNowFilter(now = new Date()) {
  const staleBefore = new Date(now.getTime() - staleDays() * DAY_MS);
  return {
    reviewState: "approved",
    validationStatus: "active",
    mergedInto: null,
    $or: [{ endDate: { $gt: now } }, { endDate: null, lastVerifiedAt: { $gte: staleBefore } }],
  };
}

/**
 * The status a visitor should see, accounting for time passing since the
 * stored status was written (the cron job persists the same transitions).
 */
export function effectiveStatus(offer, now = new Date()) {
  const s = offer.validationStatus;
  if (s !== "active") return s;
  if (offer.endDate && new Date(offer.endDate) <= now) return "expired";
  if (!offer.endDate) {
    const v = offer.lastVerifiedAt ? new Date(offer.lastVerifiedAt).getTime() : 0;
    if (now.getTime() - v > staleDays() * DAY_MS) return "unverified";
  }
  return "active";
}

export const STATUS_LABELS = {
  active: "Active",
  unverified: "Unverified",
  expired: "Expired",
  unavailable: "Unavailable",
};
