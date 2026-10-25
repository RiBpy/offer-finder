"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "../api";
import { formatDateTime, timeAgo } from "@/lib/format";

export default function Sources() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await adminFetch("/api/admin/jobs"));
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function runNow() {
    setRunning(true);
    setNotice(null);
    try {
      const r = await adminFetch("/api/admin/revalidate", { method: "POST" });
      setNotice(`Expired ${r.expired}, marked stale ${r.stale}, checked ${r.checked} offers. Outcomes: ${JSON.stringify(r.outcomes)}`);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  async function retry(jobId) {
    try {
      const r = await adminFetch("/api/admin/jobs/retry", { method: "POST", body: { jobId } });
      setNotice(`Retry result: ${r.outcome}`);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  if (!data) return <p className="text-slate-500">{error || "Loading…"}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Sources &amp; jobs</h1>
        <button onClick={runNow} disabled={running} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {running ? "Running…" : "Run revalidation now"}
        </button>
      </div>
      {notice && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <p className="text-sm text-slate-600">
        Last scheduled batch:{" "}
        {data.lastRun ? `${formatDateTime(data.lastRun.createdAt)} (${data.lastRun.trigger}, checked ${data.lastRun.result?.checked ?? 0})` : "never"}
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Failed verification attempts</h2>
        {data.failed.length === 0 ? (
          <p className="text-sm text-slate-500">No unresolved failures.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {data.failed.map((j) => (
              <li key={j._id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div>
                  <Link href={`/admin/offers/${j.offerId}`} className="font-medium underline">{j.offerTitle || j.offerId}</Link>
                  <div className="text-xs text-red-700">{j.error}</div>
                  <div className="text-xs text-slate-500">{formatDateTime(j.createdAt)} · {j.trigger}</div>
                </div>
                <button onClick={() => retry(j._id)} className="rounded border px-3 py-1 text-xs">Retry</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Source health</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Host</th>
                <th className="px-3 py-2">Last fetch</th>
                <th className="px-3 py-2">Result</th>
                <th className="px-3 py-2">OK / failed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.sources.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-slate-500">No sources fetched yet.</td>
                </tr>
              )}
              {data.sources.map((s) => (
                <tr key={s._id}>
                  <td className="px-3 py-2 font-medium">{s.host}</td>
                  <td className="px-3 py-2 text-xs">{s.lastFetchedAt ? timeAgo(s.lastFetchedAt) : "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    {s.lastOk ? <span className="text-emerald-700">OK {s.lastStatus}</span> : <span className="text-red-700">{s.lastError || `HTTP ${s.lastStatus}`}</span>}
                    {s.consecutiveFailures > 2 && <span className="ml-2 rounded bg-red-100 px-1.5 text-red-800">{s.consecutiveFailures} failures in a row</span>}
                  </td>
                  <td className="px-3 py-2 text-xs">{s.successCount || 0} / {s.failureCount || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Source adapters</h2>
        <ul className="space-y-1 text-sm">
          {data.adapters.map((a) => (
            <li key={a.id}><strong>{a.label}</strong>: {a.description}</li>
          ))}
        </ul>
        <p className="text-xs text-slate-500">Feed, affiliate and social adapters are planned for Phase 2 and need provider approval.</p>
      </section>
    </div>
  );
}
