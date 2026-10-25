// GET   /api/admin/offers/:id                 — full record incl. evidence and duplicates
// PUT   /api/admin/offers/:id                 — replace editable fields
// PATCH /api/admin/offers/:id { action, note } — approve / reject / status changes

import { getDb } from "@/lib/db/mongo";
import { applyQuickAction, getOfferForAdmin, updateOffer } from "@/lib/offers/repository";
import { findDuplicateCandidates } from "@/lib/dedupe";
import { errorResponse, json, readJson, requireAdmin } from "@/lib/http/respond";
import { log } from "@/lib/log";

export async function GET(request, { params }) {
  const { response } = await requireAdmin(request);
  if (response) return response;
  const { id } = await params;
  try {
    const db = await getDb();
    const offer = await getOfferForAdmin(db, id);
    if (!offer) return json({ error: "Not found" }, { status: 404 });
    const duplicates = await findDuplicateCandidates(db, offer, { excludeId: offer._id });
    const jobs = await db.collection("jobs").find({ offerId: offer._id }).sort({ createdAt: -1 }).limit(10).toArray();
    return json({ offer, duplicates, jobs });
  } catch (err) {
    return errorResponse(err, { route: "GET /api/admin/offers/:id" });
  }
}

export async function PUT(request, { params }) {
  const { session, response } = await requireAdmin(request);
  if (response) return response;
  const { id } = await params;
  try {
    const db = await getDb();
    const updated = await updateOffer(db, id, await readJson(request), { actor: session.sub });
    if (!updated) return json({ error: "Not found" }, { status: 404 });
    log.info("offer updated", { id, by: session.sub });
    return json({ id, slug: updated.slug });
  } catch (err) {
    return errorResponse(err, { route: "PUT /api/admin/offers/:id" });
  }
}

export async function PATCH(request, { params }) {
  const { session, response } = await requireAdmin(request);
  if (response) return response;
  const { id } = await params;
  try {
    const { action, note } = await readJson(request, 5000);
    const db = await getDb();
    const updated = await applyQuickAction(db, id, action, { note: typeof note === "string" ? note.trim().slice(0, 500) : "", actor: session.sub });
    if (!updated) return json({ error: "Not found" }, { status: 404 });
    log.info("offer action", { id, action, by: session.sub });
    return json({ id, validationStatus: updated.validationStatus, reviewState: updated.reviewState });
  } catch (err) {
    return errorResponse(err, { route: "PATCH /api/admin/offers/:id" });
  }
}
