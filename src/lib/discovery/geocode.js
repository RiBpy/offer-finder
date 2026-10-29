// Address → coordinates (and coordinates → area) via OpenStreetMap Nominatim,
// used when no Google key is configured. Nominatim's usage policy allows at
// most one request per second with an identifying User-Agent, so calls are
// serialised and results are cached in the geocache collection.

import { userAgent } from "../sources/fetcher.js";
import { cleanText } from "../text.js";

const BASE = "https://nominatim.openstreetmap.org";
const CACHE_DAYS = 90;

let last = 0;
let chain = Promise.resolve();

function throttled(fn) {
  const run = chain.then(async () => {
    const wait = last + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    return fn();
  });
  chain = run.catch(() => {});
  return run;
}

async function nominatim(path) {
  return throttled(async () => {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "User-Agent": userAgent(), "Accept-Language": "en" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
    return res.json();
  });
}

function cityOf(address = {}) {
  return address.city || address.town || address.municipality || address.state_district || address.county || address.state || null;
}

/** Returns { lat, lng } or null. */
export async function geocodeAddress(db, query, { country } = {}) {
  const q = cleanText(query, 250);
  if (!q) return null;
  const key = `fwd:${country || ""}:${q.toLowerCase()}`;
  const cached = await db.collection("geocache").findOne({ _id: key });
  if (cached && cached.expiresAt > new Date()) return cached.result;

  const params = new URLSearchParams({ q, format: "jsonv2", limit: "1" });
  if (country) params.set("countrycodes", country.toLowerCase());
  const [hit] = await nominatim(`/search?${params}`);
  const result = hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null;
  await db
    .collection("geocache")
    .updateOne({ _id: key }, { $set: { result, expiresAt: new Date(Date.now() + CACHE_DAYS * 86400000) } }, { upsert: true });
  return result;
}

/** Returns { label, city, country } for already-rounded coordinates. */
export async function reverseGeocodeOsm(lat, lng) {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lng), format: "jsonv2", zoom: "10" });
  const data = await nominatim(`/reverse?${params}`);
  const city = cityOf(data?.address);
  const country = data?.address?.country_code ? data.address.country_code.toUpperCase() : null;
  return { label: [city, data?.address?.country].filter(Boolean).join(", ") || null, city, country };
}
