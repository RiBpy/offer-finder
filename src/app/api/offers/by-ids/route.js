// GET /api/offers/by-ids?ids=a,b,c — resolves locally bookmarked offers.

import { getDb } from "@/lib/db/mongo";
import { getPublicOffersByIds } from "@/lib/offers/repository";
import { effectiveStatus } from "@/lib/offers/status";
import { errorResponse, json, limitOr429 } from "@/lib/http/respond";

export async function GET(request) {
  const limited = limitOr429(request, "by-ids", { limit: 60, windowMs: 60_000 });
  if (limited) return limited;
  const ids = (request.nextUrl.searchParams.get("ids") || "").split(",").filter(Boolean).slice(0, 100);
  try {
    const db = await getDb();
    const now = new Date();
    const items = (await getPublicOffersByIds(db, ids, now)).map((o) => ({ ...o, effectiveStatus: effectiveStatus(o, now) }));
    return json({ items }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return errorResponse(err, { route: "GET /api/offers/by-ids" });
  }
}
