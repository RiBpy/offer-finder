// GET /api/location/autocomplete?q=&session=&lat=&lng= — proxies Places Autocomplete (New).

import { autocomplete, googleEnabled } from "@/lib/location/google";
import { errorResponse, json, limitOr429 } from "@/lib/http/respond";
import { isLatitude, isLongitude, roundCoord } from "@/lib/geo";

export async function GET(request) {
  if (!googleEnabled()) return json({ error: "Location search is not configured" }, { status: 501 });
  const limited = limitOr429(request, "autocomplete", { limit: 60, windowMs: 60_000 });
  if (limited) return limited;
  const sp = request.nextUrl.searchParams;
  const q = (sp.get("q") || "").trim();
  if (q.length < 2 || q.length > 100) return json({ suggestions: [] });
  const session = sp.get("session");
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  const bias = sp.get("lat") && isLatitude(lat) && isLongitude(lng) ? { lat: roundCoord(lat, 1), lng: roundCoord(lng, 1) } : {};
  try {
    const suggestions = await autocomplete(q, {
      sessionToken: session && /^[A-Za-z0-9-]{8,64}$/.test(session) ? session : undefined,
      languageCode: (request.headers.get("accept-language") || "en").split(",")[0].slice(0, 10),
      ...bias,
    });
    return json({ suggestions }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    if (err.code === "GOOGLE_ERROR") return json({ error: "Location search is temporarily unavailable" }, { status: 502 });
    return errorResponse(err, { route: "GET /api/location/autocomplete" });
  }
}
