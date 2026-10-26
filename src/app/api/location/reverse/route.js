// GET /api/location/reverse?lat=&lng= — approximate area name for coordinates.
// Coordinates are rounded before leaving our server and are never stored.

import { googleEnabled, reverseGeocode } from "@/lib/location/google";
import { errorResponse, json, limitOr429 } from "@/lib/http/respond";
import { isLatitude, isLongitude, roundCoord } from "@/lib/geo";

export async function GET(request) {
  const sp = request.nextUrl.searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  if (!isLatitude(lat) || !isLongitude(lng)) return json({ error: "Invalid coordinates" }, { status: 400 });
  if (!googleEnabled()) return json({ label: null, city: null, country: null, configured: false });
  const limited = limitOr429(request, "reverse", { limit: 20, windowMs: 60_000 });
  if (limited) return limited;
  try {
    const r = await reverseGeocode(roundCoord(lat, 3), roundCoord(lng, 3));
    return json({ ...r, configured: true }, { headers: { "Cache-Control": "private, max-age=600" } });
  } catch (err) {
    if (err.code === "GOOGLE_ERROR") return json({ label: null, city: null, country: null, error: "Reverse geocoding failed" });
    return errorResponse(err, { route: "GET /api/location/reverse" });
  }
}
