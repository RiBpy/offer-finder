// GET /api/admin/jobs — failed verification jobs and source health.

import { getDb } from "@/lib/db/mongo";
import { listSources } from "@/lib/sources/health";
import { listAdapters } from "@/lib/sources/registry";
import { errorResponse, json, requireAdmin } from "@/lib/http/respond";

export async function GET(request) {
  const { response } = await requireAdmin(request);
  if (response) return response;
  try {
    const db = await getDb();
    const [failed, recent, sources, lastRun] = await Promise.all([
      db.collection("jobs").find({ status: "failed", resolvedAt: null }).sort({ createdAt: -1 }).limit(100).toArray(),
      db.collection("jobs").find({}).sort({ createdAt: -1 }).limit(20).toArray(),
      listSources(db),
      db.collection("jobs").findOne({ type: "revalidate_batch" }, { sort: { createdAt: -1 } }),
    ]);
    return json({ failed, recent, sources, adapters: listAdapters(), lastRun });
  } catch (err) {
    return errorResponse(err, { route: "GET /api/admin/jobs" });
  }
}
