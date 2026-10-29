// GET /api/location/reverse?lat=&lng= — approximate area name for coordinates.
// Coordinates are rounded before leaving our server and are never stored.

import { googleEnabled, reverseGeocode } from "@/lib/location/google";
import { reverseGeocodeOsm } from "@/lib/discovery/geocode";
import { errorResponse, json, limitOr429 } from "@/lib/http/respond";
import { isLatitude, isLongitude, roundCoord } from "@/lib/geo";

export async function GET(request) {
  const sp = request.nextUrl.searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  if (!isLatitude(lat) || !isLongitude(lng)) return json({ error: "Invalid coordinates" }, { status: 400 });
  const limited = limitOr429(request, "reverse", { limit: 20, windowMs: 60_000 });
  if (limited) return limited;
  try {
    // Without a Google key, OpenStreetMap still gives the city and country
    // needed to match city-wide and nationwide offers.
    const r = googleEnabled()
      ? await reverseGeocode(roundCoord(lat, 3), roundCoord(lng, 3))
      : await reverseGeocodeOsm(roundCoord(lat, 2), roundCoord(lng, 2));
    return json({ ...r, configured: googleEnabled() }, { headers: { "Cache-Control": "private, max-age=600" } });
  } catch (err) {
    if (err.code === "GOOGLE_ERROR" || /Nominatim/.test(err.message) || err.name === "TimeoutError")
      return json({ label: null, city: null, country: null, error: "Reverse geocoding failed" });
    return errorResponse(err, { route: "GET /api/location/reverse" });
  }
}
