// POST /api/admin/revalidate — run a revalidation batch now.

import { getDb } from "@/lib/db/mongo";
import { runRevalidation } from "@/lib/jobs/run";
import { errorResponse, json, requireAdmin } from "@/lib/http/respond";

export const maxDuration = 60;

export async function POST(request) {
  const { response } = await requireAdmin(request);
  if (response) return response;
  try {
    const db = await getDb();
    return json(await runRevalidation(db, { trigger: "admin", limit: 10 }));
  } catch (err) {
    return errorResponse(err, { route: "POST /api/admin/revalidate" });
  }
}
