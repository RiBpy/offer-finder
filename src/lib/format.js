// Display formatting shared by server and client components.

export function formatDate(d, { tz, withYear = false } = {}) {
  if (!d) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
    ...(tz ? { timeZone: tz } : {}),
  }).format(new Date(d));
}

export function formatDateTime(d, tz) {
  if (!d) return null;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", ...(tz ? { timeZone: tz } : {}) }).format(new Date(d));
}

export function timeAgo(d, now = Date.now()) {
  if (!d) return null;
  const s = Math.round((now - new Date(d).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (Math.abs(s) < 60) return rtf.format(-s, "second");
  if (Math.abs(s) < 3600) return rtf.format(-Math.round(s / 60), "minute");
  if (Math.abs(s) < 86400) return rtf.format(-Math.round(s / 3600), "hour");
  return rtf.format(-Math.round(s / 86400), "day");
}

export function formatMoney(amount, currency) {
  if (amount == null) return null;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

// Only what the source stated: never computes savings that were not given.
export function discountLabel(o) {
  switch (o.discountType) {
    case "percent":
      return o.discountValue != null ? `${o.discountValue}% off` : o.discountText;
    case "amount":
      return o.discountValue != null ? `${formatMoney(o.discountValue, o.currency)} off` : o.discountText;
    case "fixed_price":
      return o.discountedPrice != null ? `Now ${formatMoney(o.discountedPrice, o.currency)}` : o.discountText;
    case "bogo":
      return o.discountText || "Buy one, get one";
    default:
      return o.discountText || null;
  }
}

const sameDay = (a, b, tz) => formatDate(a, { tz, withYear: true }) === formatDate(b, { tz, withYear: true });

export function validityLabel(o, now = new Date()) {
  const start = o.startDate ? new Date(o.startDate) : null;
  const end = o.endDate ? new Date(o.endDate) : null;
  if (end && end <= now) return { text: "Expired", tone: "muted" };
  if (start && start > now) return { text: `Starts ${formatDate(start)}`, tone: "info" };
  if (end && sameDay(end, now)) return { text: "Ends today", tone: "urgent" };
  if (end) {
    const days = Math.ceil((end - now) / 86400000);
    return { text: days <= 3 ? `Ends ${formatDate(end)} · ${days}d left` : `Valid until ${formatDate(end)}`, tone: days <= 3 ? "urgent" : "ok" };
  }
  return { text: "Ongoing", tone: "ok" };
}

export const AVAILABILITY_LABELS = { online: "Online only", in_store: "In-store", both: "Online & in-store" };
