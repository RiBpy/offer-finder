// Timezone-aware date helpers built on Intl, no dependencies.

const DAY_MS = 24 * 60 * 60 * 1000;

export function isValidTimeZone(tz) {
  if (typeof tz !== "string" || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function isYmd(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// Offset of `tz` from UTC at instant `ms`, in milliseconds.
function tzOffsetMs(ms, tz) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(ms / 1000) * 1000;
}

// The UTC instant at which local midnight of `ymd` occurs in `tz`.
export function startOfDayInZone(ymd, tz) {
  const [y, m, d] = ymd.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let t = guess - tzOffsetMs(guess, tz);
  // Re-check once in case the offset differs at the corrected instant (DST change).
  t = guess - tzOffsetMs(t, tz);
  return new Date(t);
}

export function addDaysYmd(ymd, days) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d) + days * DAY_MS);
  return dt.toISOString().slice(0, 10);
}

// [start, end) of the local calendar day `ymd` in `tz`.
export function dayRangeInZone(ymd, tz) {
  return { start: startOfDayInZone(ymd, tz), end: startOfDayInZone(addDaysYmd(ymd, 1), tz) };
}

// Today's date (YYYY-MM-DD) in `tz`, or the runtime's local zone if omitted.
export function todayYmd(tz, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

// End-of-day instant (last millisecond) of `ymd` in `tz`. Used when a source says
// "valid until 31 October" without a time.
export function endOfDayInZone(ymd, tz) {
  return new Date(startOfDayInZone(addDaysYmd(ymd, 1), tz).getTime() - 1);
}

export function daysBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

export { DAY_MS };
