"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import OfferCard, { OfferCardSkeleton } from "@/components/OfferCard";
import { useBookmarks } from "@/components/hooks";
import { rememberList, rememberedList, takeScrollRestore } from "@/lib/return-to";

export default function SavedClient() {
  const { ids, loaded } = useBookmarks();
  const [state, setState] = useState({ loading: true, items: [], error: null });
  const key = ids.join(",");

  // Offer pages link back here ("← Back to Saved offers"), at the same scroll position.
  useEffect(() => {
    if (rememberedList()?.href !== "/saved") rememberList({ href: "/saved", label: "Saved offers", scrollY: 0 });
  }, []);
  useEffect(() => {
    if (state.loading) return;
    const y = takeScrollRestore("/saved");
    if (y) setTimeout(() => window.scrollTo(0, y), 0);
  }, [state.loading]);
  const onListClick = (e) => {
    if (e.target.closest?.('a[href^="/offers/"]')) rememberList({ href: "/saved", label: "Saved offers", scrollY: window.scrollY });
  };

  useEffect(() => {
    if (!loaded) return;
    if (!key) return setState({ loading: false, items: [], error: null });
    const ctrl = new AbortController();
    fetch(`/api/offers/by-ids?ids=${key}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Could not load saved offers"))))
      .then((d) => setState({ loading: false, items: d.items, error: null }))
      .catch((e) => e.name !== "AbortError" && setState({ loading: false, items: [], error: e.message }));
    return () => ctrl.abort();
  }, [key, loaded]);

  if (state.loading)
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {[0, 1, 2].map((i) => (
          <OfferCardSkeleton key={i} index={i} />
        ))}
      </div>
    );
  if (state.error) return <p className="text-red-700">{state.error}</p>;
  if (!state.items.length)
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="font-medium text-slate-800">No saved offers yet.</p>
        <p className="mt-1 text-sm text-slate-500">Tap ☆ on any offer to save it here.</p>
        <Link href="/" className="mt-4 inline-block font-medium text-emerald-700 hover:underline">Browse offers</Link>
      </div>
    );

  const active = state.items.filter((o) => o.effectiveStatus === "active");
  const inactive = state.items.filter((o) => o.effectiveStatus !== "active");
  return (
    <div onClickCapture={onListClick} className="space-y-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {active.map((o) => (
          <OfferCard key={o.id} offer={o} />
        ))}
      </div>
      {inactive.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold text-slate-700">No longer active</h2>
          <div className="grid grid-cols-2 gap-3 opacity-70 md:grid-cols-3 lg:grid-cols-4">
            {inactive.map((o) => (
              <OfferCard key={o.id} offer={{ ...o, validationStatus: o.effectiveStatus }} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
