// GET  /api/admin/offers?tab=&q=&page= — review queue and lists
// POST /api/admin/offers               — create an offer (manual entry)

import { getDb } from "@/lib/db/mongo";
import { createOffer, listOffersForAdmin } from "@/lib/offers/repository";
import { errorResponse, json, readJson, requireAdmin } from "@/lib/http/respond";
import { log } from "@/lib/log";

export async function GET(request) {
  const { response } = await requireAdmin(request);
  if (response) return response;
  const sp = request.nextUrl.searchParams;
  try {
    const db = await getDb();
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
    return json(await listOffersForAdmin(db, { tab: sp.get("tab") || "pending", q: sp.get("q")?.slice(0, 100), page }));
  } catch (err) {
    return errorResponse(err, { route: "GET /api/admin/offers" });
  }
}

export async function POST(request) {
  const { session, response } = await requireAdmin(request);
  if (response) return response;
  try {
    const input = await readJson(request);
    const db = await getDb();
    const offer = await createOffer(db, input, { actor: session.sub });
    log.info("offer created", { id: String(offer._id), by: session.sub });
    return json({ id: String(offer._id), slug: offer.slug }, { status: 201 });
  } catch (err) {
    return errorResponse(err, { route: "POST /api/admin/offers" });
  }
}
