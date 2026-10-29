"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { adminFetch, Badge } from "./api";
import { categoryLabel } from "@/lib/constants";
import { formatDate, timeAgo } from "@/lib/format";

const TABS = [
  { id: "pending", label: "Needs review" },
  { id: "active", label: "Active" },
  { id: "unverified", label: "Unverified" },
  { id: "expired", label: "Expired / unavailable" },
  { id: "rejected", label: "Rejected / merged" },
  { id: "all", label: "All" },
];

export default function AdminOffers() {
  const [tab, setTab] = useState("pending");
  const [q, setQ] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await adminFetch(`/api/admin/offers?tab=${tab}&q=${encodeURIComponent(q)}`));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [tab, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  async function act(id, action) {
    let note = "";
    if (action === "mark_active") {
      note = window.prompt("What evidence shows this offer is active? (e.g. 'Source page states valid until 31 Oct')") || "";
      if (!note) return;
    }
    setBusyId(id);
    try {
      await adminFetch(`/api/admin/offers/${id}`, { method: "PATCH", body: { action, note } });
      await load();
    } catch (e) {
      setError(e.fields ? Object.values(e.fields).join(" ") : e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Offers</h1>
        <Link href="/admin/offers/new" className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
          + Add offer from URL
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${tab === t.id ? "bg-slate-900 text-white dark:text-slate-50" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
          >
            {t.label}
            {data?.counts?.[t.id] != null && <span className="ml-1.5 opacity-70">{data.counts[t.id]}</span>}
          </button>
        ))}
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, brand, URL"
          aria-label="Search offers"
          className="ml-auto w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm sm:w-64"
        />
      </div>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Offer</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Validity</th>
              <th className="px-3 py-2">Checked</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!data && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">Loading…</td>
              </tr>
            )}
            {data?.items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">Nothing here.</td>
              </tr>
            )}
            {data?.items.map((o) => (
              <tr key={o._id} className="align-top">
                <td className="max-w-sm px-3 py-2.5">
                  <Link href={`/admin/offers/${o._id}`} className="font-medium text-slate-900 hover:underline">{o.title}</Link>
                  <div className="text-xs text-slate-500">
                    {[o.brandName || o.businessName, categoryLabel(o.primaryCategory)].filter(Boolean).join(" · ")}
                  </div>
                  <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-emerald-700 hover:underline">
                    {o.sourceUrl}
                  </a>
                  {o.statusReason && <div className="mt-1 text-xs text-amber-800">{o.statusReason}</div>}
                </td>
                <td className="space-x-1 px-3 py-2.5">
                  <Badge value={o.validationStatus} />
                  <Badge value={o.mergedInto ? "rejected" : o.reviewState} />
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-600">
                  {o.startDate ? formatDate(o.startDate, { withYear: true }) : "—"} → {o.endDate ? formatDate(o.endDate, { withYear: true }) : "no end date"}
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-600">
                  <div>Verified: {o.lastVerifiedAt ? timeAgo(o.lastVerifiedAt) : "never"}</div>
                  <div>Checked: {o.lastCheckedAt ? timeAgo(o.lastCheckedAt) : "never"}</div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap justify-end gap-1">
                    {o.reviewState !== "approved" && !o.mergedInto && (
                      <button disabled={busyId === o._id} onClick={() => act(o._id, "approve")} className="rounded border border-emerald-600 px-2 py-1 text-xs text-emerald-800">
                        Approve
                      </button>
                    )}
                    {o.validationStatus !== "active" && (
                      <button disabled={busyId === o._id} onClick={() => act(o._id, "mark_active")} className="rounded border px-2 py-1 text-xs">
                        Mark active
                      </button>
                    )}
                    {o.validationStatus === "active" && (
                      <button disabled={busyId === o._id} onClick={() => act(o._id, "mark_unverified")} className="rounded border px-2 py-1 text-xs">
                        Unverified
                      </button>
                    )}
                    {o.validationStatus !== "expired" && (
                      <button disabled={busyId === o._id} onClick={() => act(o._id, "mark_expired")} className="rounded border px-2 py-1 text-xs">
                        Expired
                      </button>
                    )}
                    {o.reviewState !== "rejected" && (
                      <button disabled={busyId === o._id} onClick={() => act(o._id, "reject")} className="rounded border border-red-300 px-2 py-1 text-xs text-red-700">
                        Reject
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Public visitors only see offers that are <strong>approved</strong> and <strong>active</strong>, not past their end date, and (if open-ended)
        verified within the staleness window.
      </p>
    </div>
  );
}
