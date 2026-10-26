"use client";

// Small fetch wrapper for admin screens. Throws Error with .fields on 400s.
export async function adminFetch(url, { method = "GET", body } = {}) {
  const r = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401) {
    window.location.href = "/admin/login";
    throw new Error("Signed out");
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(data.error || `Request failed (${r.status})`);
    e.fields = data.fields;
    throw e;
  }
  return data;
}

export const STATUS_STYLES = {
  active: "bg-emerald-100 text-emerald-800",
  unverified: "bg-amber-100 text-amber-800",
  expired: "bg-slate-200 text-slate-700",
  unavailable: "bg-red-100 text-red-800",
  pending: "bg-sky-100 text-sky-800",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
};

export function Badge({ value }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[value] || "bg-slate-100"}`}>{value}</span>;
}
