// GET /api/health — liveness and database connectivity.

import { getDb } from "@/lib/db/mongo";

export async function GET() {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return Response.json({ ok: true, db: "up" }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return Response.json({ ok: false, db: err.code === "DB_NOT_CONFIGURED" ? "not configured" : "down" }, { status: 503 });
  }
}
