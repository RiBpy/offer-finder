// GET /api/cron/discover — one discovery step (collect sources when due, then
// read queued pages with the AI provider), for manual or external triggering
// with the CRON_SECRET. Normal runs happen on visits via /api/discover/refresh.

import crypto from "node:crypto";
import { getDb } from "@/lib/db/mongo";
import { runDiscovery } from "@/lib/discovery/run";
import { errorResponse, json } from "@/lib/http/respond";

export const maxDuration = 60;

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(request.headers.get("authorization") || "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

export async function GET(request) {
  if (!authorized(request)) return json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = await getDb();
    const budgetMs = Number(process.env.DISCOVERY_BUDGET_MS) || 20000;
    return json(await runDiscovery(db, { trigger: "cron", budgetMs }));
  } catch (err) {
    if (err.code === "AI_NOT_CONFIGURED") return json({ error: err.message }, { status: 503 });
    return errorResponse(err, { route: "GET /api/cron/discover" });
  }
}
