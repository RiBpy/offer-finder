// POST /api/discover/refresh — called by the home page when it loads. Runs one
// small discovery step if the shared cooldown has passed (default 30 minutes),
// otherwise returns immediately without calling the AI provider.

import { getDb } from "@/lib/db/mongo";
import { refreshOnVisit } from "@/lib/discovery/run";
import { errorResponse, json, limitOr429 } from "@/lib/http/respond";

export const maxDuration = 60;

export async function POST(request) {
  const limited = limitOr429(request, "discover-refresh", { limit: 6, windowMs: 60_000 });
  if (limited) return limited;
  try {
    const db = await getDb();
    const result = await refreshOnVisit(db, {
      cooldownMs: (Number(process.env.DISCOVERY_COOLDOWN_MIN) || 30) * 60_000,
      budgetMs: Number(process.env.DISCOVERY_BUDGET_MS) || 20000,
      maxItems: Number(process.env.DISCOVERY_PAGES_PER_VISIT) || 3,
    });
    return json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err, { route: "POST /api/discover/refresh" });
  }
}
