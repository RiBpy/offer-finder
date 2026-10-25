"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import OfferForm, { offerToForm } from "../../OfferForm";
import { adminFetch, Badge } from "../../api";
import { formatDateTime } from "@/lib/format";

export default function EditOffer({ params }) {
  const { id } = use(params);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await adminFetch(`/api/admin/offers/${id}`));
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function merge(duplicateId) {
    if (!window.confirm("Hide the other offer and keep this one as the main listing?")) return;
    setBusy(true);
    try {
      await adminFetch("/api/admin/merge", { method: "POST", body: { primaryId: id, duplicateId } });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <p className="text-red-700">{error}</p>;
  if (!data) return <p className="text-slate-500">Loading…</p>;
  const o = data.offer;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-2 text-2xl font-bold">{o.title}</h1>
          <Badge value={o.validationStatus} />
          <Badge value={o.mergedInto ? "rejected" : o.reviewState} />
        </div>
        {o.mergedInto && (
          <p className="rounded-lg bg-slate-100 p-3 text-sm">
            Merged into <Link className="underline" href={`/admin/offers/${o.mergedInto}`}>another offer</Link>. It is hidden from the public site.
          </p>
        )}
        {o.statusReason && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{o.statusReason}</p>}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <OfferForm key={version} initial={offerToForm(o)} offerId={id} />
      </div>

      <aside className="space-y-4 text-sm">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 font-semibold">Public page</h2>
          {o.reviewState === "approved" && !o.mergedInto ? (
            <Link href={`/offers/${o.slug}`} className="break-all text-emerald-700 underline" target="_blank">/offers/{o.slug}</Link>
          ) : (
            <p className="text-slate-500">Not public until approved.</p>
          )}
          <dl className="mt-3 space-y-1 text-xs text-slate-600">
            <div>Created: {formatDateTime(o.createdAt)}</div>
            <div>Last verified: {o.lastVerifiedAt ? formatDateTime(o.lastVerifiedAt) : "never"}</div>
            <div>Last checked: {o.lastCheckedAt ? formatDateTime(o.lastCheckedAt) : "never"}</div>
            <div>Views: {o.viewCount ?? 0}</div>
          </dl>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 font-semibold">Verification evidence</h2>
          {o.verificationEvidence?.length ? (
            <ul className="space-y-2">
              {[...o.verificationEvidence].reverse().map((e, i) => (
                <li key={i} className="rounded bg-slate-50 p-2 text-xs">
                  <div className="font-medium">{e.method.replace("_", " ")} · {formatDateTime(e.at)}</div>
                  {e.note && <div className="text-slate-600">{e.note}</div>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-500">None yet.</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 font-semibold">Possible duplicates</h2>
          {data.duplicates.length ? (
            <ul className="space-y-2">
              {data.duplicates.map((d) => (
                <li key={d._id} className="rounded bg-slate-50 p-2 text-xs">
                  <Link href={`/admin/offers/${d._id}`} className="font-medium underline">{d.title}</Link>
                  <div className="text-slate-500">{d.reason}</div>
                  {!o.mergedInto && (
                    <button disabled={busy} onClick={() => merge(d._id)} className="mt-1 rounded border px-2 py-0.5">
                      Merge into this offer
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-500">None found.</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 font-semibold">Recent checks</h2>
          {data.jobs.length ? (
            <ul className="space-y-1 text-xs">
              {data.jobs.map((j) => (
                <li key={j._id}>
                  <Badge value={j.status === "failed" ? "unavailable" : "approved"} /> {j.outcome} · {formatDateTime(j.createdAt)}
                  {j.error && <div className="text-red-700">{j.error}</div>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-500">Not checked yet.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
