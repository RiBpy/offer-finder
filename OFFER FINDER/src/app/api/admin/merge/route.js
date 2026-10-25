// POST /api/admin/merge { primaryId, duplicateId }

import { getDb } from "@/lib/db/mongo";
import { mergeOffers } from "@/lib/offers/repository";
import { errorResponse, json, readJson, requireAdmin } from "@/lib/http/respond";
import { log } from "@/lib/log";

export async function POST(request) {
  const { session, response } = await requireAdmin(request);
  if (response) return response;
  try {
    const { primaryId, duplicateId } = await readJson(request, 2000);
    const db = await getDb();
    const merged = await mergeOffers(db, primaryId, duplicateId, { actor: session.sub });
    if (!merged) return json({ error: "Not found" }, { status: 404 });
    log.info("offers merged", { primaryId, duplicateId, by: session.sub });
    return json({ id: String(merged._id) });
  } catch (err) {
    return errorResponse(err, { route: "POST /api/admin/merge" });
  }
}
