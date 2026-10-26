// POST /api/admin/extract { url } — fetch a source page and return a draft.

import { getDb } from "@/lib/db/mongo";
import { draftFromUrl } from "@/lib/offers/discover";
import { errorResponse, json, readJson, requireAdmin } from "@/lib/http/respond";

export const maxDuration = 30;

export async function POST(request) {
  const { response } = await requireAdmin(request);
  if (response) return response;
  try {
    const { url } = await readJson(request, 5000);
    let parsed;
    try {
      parsed = new URL(String(url || "").trim());
    } catch {
      return json({ error: "Validation failed", fields: { url: "Enter a valid URL" } }, { status: 400 });
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return json({ error: "Validation failed", fields: { url: "Only http(s) URLs" } }, { status: 400 });
    }
    const db = await getDb();
    return json(await draftFromUrl(db, parsed.toString()));
  } catch (err) {
    return errorResponse(err, { route: "POST /api/admin/extract" });
  }
}
