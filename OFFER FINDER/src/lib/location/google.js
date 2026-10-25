// Google Maps Platform calls, made from the server so the key never reaches
// the browser. Uses Places API (New) for autocomplete/details and the
// Geocoding API for reverse geocoding.
//
// Billing note: pass the same sessionToken to autocomplete and the following
// details call so Google bills the session, not each keystroke.

const PLACES = "https://places.googleapis.com/v1";
const GEOCODE = "https://maps.googleapis.com/maps/api/geocode/json";

export function googleEnabled() {
  return Boolean(process.env.GOOGLE_MAPS_SERVER_KEY);
}

function key() {
  const k = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!k) {
    const e = new Error("Google Maps is not configured");
    e.code = "GOOGLE_NOT_CONFIGURED";
    throw e;
  }
  return k;
}

async function googleFetch(url, init) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(6000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data?.error?.message || `Google API HTTP ${res.status}`);
    e.code = "GOOGLE_ERROR";
    e.httpStatus = res.status;
    throw e;
  }
  return data;
}

export async function autocomplete(input, { sessionToken, lat, lng, languageCode } = {}) {
  const body = { input, ...(sessionToken ? { sessionToken } : {}), ...(languageCode ? { languageCode } : {}) };
  if (lat != null && lng != null) body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 50000 } };
  const data = await googleFetch(`${PLACES}/places:autocomplete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key() },
    body: JSON.stringify(body),
  });
  return (data.suggestions || [])
    .map((s) => s.placePrediction)
    .filter(Boolean)
    .map((p) => ({
      placeId: p.placeId,
      main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      secondary: p.structuredFormat?.secondaryText?.text ?? "",
    }));
}

export function summarizeComponents(components, getLong = (c) => c.longText, getShort = (c) => c.shortText) {
  const find = (type) => (components || []).find((x) => x.types?.includes(type));
  const city = find("locality") || find("postal_town") || find("administrative_area_level_2") || find("administrative_area_level_1");
  const country = find("country");
  return { city: city ? getLong(city) : null, country: country ? getShort(country)?.toUpperCase() : null };
}

export async function placeDetails(placeId, { sessionToken } = {}) {
  if (!/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) {
    const e = new Error("Invalid place id");
    e.status = 400;
    e.errors = { placeId: "Invalid place id" };
    throw e;
  }
  const qs = sessionToken ? `?sessionToken=${encodeURIComponent(sessionToken)}` : "";
  const data = await googleFetch(`${PLACES}/places/${placeId}${qs}`, {
    headers: {
      "X-Goog-Api-Key": key(),
      // Essentials-tier fields only, to keep the cost down.
      "X-Goog-FieldMask": "id,formattedAddress,location,addressComponents",
    },
  });
  const { city, country } = summarizeComponents(data.addressComponents);
  return {
    label: data.formattedAddress,
    lat: data.location?.latitude ?? null,
    lng: data.location?.longitude ?? null,
    city,
    country,
  };
}

export async function reverseGeocode(lat, lng) {
  const url = `${GEOCODE}?latlng=${lat},${lng}&result_type=locality|sublocality|administrative_area_level_2|administrative_area_level_1&key=${encodeURIComponent(key())}`;
  const data = await googleFetch(url);
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    const e = new Error(`Geocoding failed: ${data.status}`);
    e.code = "GOOGLE_ERROR";
    throw e;
  }
  const first = data.results?.[0];
  if (!first) return { label: null, city: null, country: null };
  const { city, country } = summarizeComponents(first.address_components, (c) => c.long_name, (c) => c.short_name);
  return { label: [city, country].filter(Boolean).join(", ") || first.formatted_address, city, country };
}
