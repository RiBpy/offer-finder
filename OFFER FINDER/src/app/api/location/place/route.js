// GET /api/location/place?id=&session= — Place Details (New), Essentials fields only.

import { googleEnabled, placeDetails } from "@/lib/location/google";
import { errorResponse, json, limitOr429 } from "@/lib/http/respond";

export async function GET(request) {
  if (!googleEnabled()) return json({ error: "Location search is not configured" }, { status: 501 });
  const limited = limitOr429(request, "place", { limit: 30, windowMs: 60_000 });
  if (limited) return limited;
  const sp = request.nextUrl.searchParams;
  const session = sp.get("session");
  try {
    const place = await placeDetails(sp.get("id") || "", {
      sessionToken: session && /^[A-Za-z0-9-]{8,64}$/.test(session) ? session : undefined,
    });
    return json(place, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    if (err.code === "GOOGLE_ERROR") return json({ error: "Location lookup is temporarily unavailable" }, { status: 502 });
    return errorResponse(err, { route: "GET /api/location/place" });
  }
}
