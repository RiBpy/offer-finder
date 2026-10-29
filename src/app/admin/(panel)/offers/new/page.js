"use client";

import Link from "next/link";
import { useState } from "react";
import OfferForm, { offerToForm } from "../../OfferForm";
import { adminFetch, Badge } from "../../api";

export default function NewOffer() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const [initial, setInitial] = useState(() => offerToForm({}));

  async function extract(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await adminFetch("/api/admin/extract", { method: "POST", body: { url } });
      setResult(r);
      setInitial(offerToForm({ ...r.draft, sourceUrl: r.draft.sourceUrl || url }));
      setFormKey((k) => k + 1);
    } catch (err) {
      setError(err.fields?.url || err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Add an offer</h1>
      <form onSubmit={extract} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <label htmlFor="src-url" className="block text-sm font-semibold">Start from the offer&apos;s source URL</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="src-url"
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://brand.example/campaign/eid-sale"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button disabled={busy} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:text-slate-50">
            {busy ? "Fetching…" : "Fetch details"}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          The page is fetched once, only if its robots.txt allows it. Extracted values are suggestions: check every field against the page.
        </p>
        {error && <p className="text-sm text-red-700">{error}</p>}
        {result && !result.ok && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Could not read the page automatically ({result.error}). You can still fill the form manually from what you see on the page.
          </p>
        )}
        {result?.warnings?.map((w) => (
          <p key={w} className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{w}</p>
        ))}
        {result?.duplicates?.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
            <p className="font-semibold text-red-900">Possible duplicates</p>
            <ul className="mt-1 space-y-1">
              {result.duplicates.map((d) => (
                <li key={d._id}>
                  <Link href={`/admin/offers/${d._id}`} className="text-red-900 underline">{d.title}</Link>{" "}
                  <span className="text-xs text-red-800">({d.reason}{d.score < 1 ? `, ${Math.round(d.score * 100)}% similar` : ""})</span>{" "}
                  <Badge value={d.validationStatus} />
                </li>
              ))}
            </ul>
          </div>
        )}
        {result?.textSample && (
          <details className="text-xs text-slate-600">
            <summary className="cursor-pointer">Page text sample</summary>
            <p className="mt-1">{result.textSample}</p>
          </details>
        )}
      </form>
      <OfferForm key={formKey} initial={initial} />
    </div>
  );
}
