// GET /api/offers — public offer search. See docs/API.md for parameters.

import { getDb } from "@/lib/db/mongo";
import { parseOfferQuery, searchOffers } from "@/lib/offers/query";
import { errorResponse, json, limitOr429 } from "@/lib/http/respond";

export async function GET(request) {
  const limited = limitOr429(request, "offers", { limit: 120, windowMs: 60_000 });
  if (limited) return limited;
  const { params, errors } = parseOfferQuery(request.nextUrl.searchParams);
  if (errors) return json({ error: "Invalid query", fields: errors }, { status: 400 });
  try {
    const db = await getDb();
    const result = await searchOffers(db, params);
    return json(result, {
      // Short shared cache: expiry is evaluated per query, so keep it brief.
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (err) {
    return errorResponse(err, { route: "GET /api/offers" });
  }
}
