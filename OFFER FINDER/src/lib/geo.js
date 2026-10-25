// Geographic helpers shared by server and client.

export function isLatitude(n) {
  return typeof n === "number" && Number.isFinite(n) && n >= -90 && n <= 90;
}

export function isLongitude(n) {
  return typeof n === "number" && Number.isFinite(n) && n >= -180 && n <= 180;
}

// Rounds coordinates so that precise user positions are never sent or stored.
// 3 decimals is roughly 100 m, enough for radius filtering.
export function roundCoord(n, decimals = 3) {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function formatDistance(km) {
  if (km == null || !Number.isFinite(km)) return null;
  if (km < 1) return `${Math.max(100, Math.round(km * 10) * 100)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}
