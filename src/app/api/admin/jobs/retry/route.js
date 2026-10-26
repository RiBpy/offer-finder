// POST /api/admin/jobs/retry { jobId } — re-run verification for a failed job's offer.

import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/mongo";
import { verifyOffer } from "@/lib/verify/verifier";
import { errorResponse, json, readJson, requireAdmin } from "@/lib/http/respond";

export const maxDuration = 30;

export async function POST(request) {
  const { response } = await requireAdmin(request);
  if (response) return response;
  try {
    const { jobId } = await readJson(request, 1000);
    if (typeof jobId !== "string" || !ObjectId.isValid(jobId)) return json({ error: "Invalid job id" }, { status: 400 });
    const db = await getDb();
    const job = await db.collection("jobs").findOne({ _id: new ObjectId(jobId) });
    if (!job?.offerId) return json({ error: "Not found" }, { status: 404 });
    const offer = await db.collection("offers").findOne({ _id: job.offerId });
    if (!offer) return json({ error: "Offer no longer exists" }, { status: 404 });
    const decision = await verifyOffer(db, offer, { trigger: "admin_retry" });
    await db.collection("jobs").updateOne({ _id: job._id }, { $set: { resolvedAt: new Date(), resolution: decision.outcome } });
    return json({ outcome: decision.outcome, failed: decision.failed });
  } catch (err) {
    return errorResponse(err, { route: "POST /api/admin/jobs/retry" });
  }
}
