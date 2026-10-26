// GET /api/cron/revalidate — called by Vercel Cron (see vercel.json).
// Vercel sends "Authorization: Bearer $CRON_SECRET" when CRON_SECRET is set.

import crypto from "node:crypto";
import { getDb } from "@/lib/db/mongo";
import { runRevalidation } from "@/lib/jobs/run";
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
    return json(await runRevalidation(db, { trigger: "cron", limit: 25 }));
  } catch (err) {
    return errorResponse(err, { route: "GET /api/cron/revalidate" });
  }
}
