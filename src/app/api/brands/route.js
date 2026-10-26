// GET /api/brands — brand names that currently have active offers (for the brand filter).

import { getDb } from "@/lib/db/mongo";
import { activeNowFilter } from "@/lib/offers/status";
import { errorResponse, json, limitOr429 } from "@/lib/http/respond";

export async function GET(request) {
  const limited = limitOr429(request, "brands", { limit: 30, windowMs: 60_000 });
  if (limited) return limited;
  try {
    const db = await getDb();
    const names = await db.collection("offers").distinct("brandName", { ...activeNowFilter(), brandName: { $type: "string" } });
    return json({ brands: names.sort((a, b) => a.localeCompare(b)).slice(0, 500) }, { headers: { "Cache-Control": "public, s-maxage=300" } });
  } catch (err) {
    return errorResponse(err, { route: "GET /api/brands" });
  }
}
