"use client";

import { useEffect, useState } from "react";
import { BANKS, CATEGORIES, RADIUS_OPTIONS, SORTS, SOURCE_TYPES, VALIDITY_MODES } from "@/lib/constants";
import { useDragScroll } from "./hooks";

export const DEFAULT_FILTERS = {
  q: "",
  category: "",
  brandOnly: false,
  validity: "today",
  from: "",
  to: "",
  radius: "25",
  national: true,
  availability: "any",
  brand: "",
  sourceType: "",
  bank: "",
  minDiscount: "",
  sort: "newest",
  unverified: false,
};

export function isDefaultFilters(f) {
  return Object.keys(DEFAULT_FILTERS).every((k) => k === "radius" || k === "sort" || f[k] === DEFAULT_FILTERS[k]);
}

const select = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600";

export function CategoryNav({ filters, setFilters, counts }) {
  const rowRef = useDragScroll();
  const chip = (active) =>
    `flex shrink-0 snap-start items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition ${
      active ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
    }`;
  const count = (n) => counts && <span className="tabular-nums opacity-70">({n ?? 0})</span>;
  return (
    <nav ref={rowRef} aria-label="Categories" className="no-scrollbar -mx-4 flex cursor-grab snap-x gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1">
      <button type="button" className={chip(!filters.category && !filters.brandOnly)} onClick={() => setFilters((f) => ({ ...f, category: "", brandOnly: false }))}>
        All offers {count(counts?.all)}
      </button>
      <button type="button" aria-pressed={filters.brandOnly} className={chip(filters.brandOnly)} onClick={() => setFilters((f) => ({ ...f, brandOnly: !f.brandOnly }))}>
        <span aria-hidden="true">🏷️</span> Brand Offers {count(counts?.brand)}
      </button>
      {CATEGORIES.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-pressed={filters.category === c.id}
          className={chip(filters.category === c.id)}
          onClick={() => setFilters((f) => ({ ...f, category: f.category === c.id ? "" : c.id }))}
        >
          <span aria-hidden="true">{c.icon}</span> {c.label} {count(counts?.categories[c.id])}
        </button>
      ))}
    </nav>
  );
}

export function FilterBar({ filters, setFilters, hasCoords, hasCity }) {
  const [open, setOpen] = useState(false);
  const [brands, setBrands] = useState([]);
  const set = (k) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setFilters((f) => ({ ...f, [k]: v }));
  };

  useEffect(() => {
    if (!open || brands.length) return;
    fetch("/api/brands")
      .then((r) => (r.ok ? r.json() : { brands: [] }))
      .then((d) => setBrands(d.brands))
      .catch(() => {});
  }, [open, brands.length]);

  const radiusOptions = RADIUS_OPTIONS.filter((r) => (r.id === "city" ? hasCity : r.id === "country" ? true : hasCoords));
  const extraCount = ["availability", "brand", "sourceType", "minDiscount"].filter((k) => filters[k] !== DEFAULT_FILTERS[k]).length + (filters.unverified ? 1 : 0) + (filters.national ? 0 : 1);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="f-validity">Validity</label>
        <select id="f-validity" className={select} value={filters.validity} onChange={set("validity")}>
          {VALIDITY_MODES.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
        {filters.validity === "custom" && (
          <span className="flex items-center gap-1 text-sm">
            <label className="sr-only" htmlFor="f-from">From</label>
            <input id="f-from" type="date" className={select} value={filters.from} onChange={set("from")} />
            <span aria-hidden="true">–</span>
            <label className="sr-only" htmlFor="f-to">To</label>
            <input id="f-to" type="date" className={select} value={filters.to} min={filters.from || undefined} onChange={set("to")} />
          </span>
        )}
        {radiusOptions.length > 0 && (
          <>
            <label className="sr-only" htmlFor="f-radius">Search radius</label>
            <select id="f-radius" className={select} value={filters.radius} onChange={set("radius")}>
              {radiusOptions.map((r) => (
                <option key={r.id} value={r.id}>{r.id === "city" || r.id === "country" ? r.label : `Within ${r.label}`}</option>
              ))}
            </select>
          </>
        )}
        <label className="sr-only" htmlFor="f-sort">Sort by</label>
        <select id="f-sort" className={select} value={filters.sort} onChange={set("sort")}>
          {SORTS.filter((s) => s.id !== "nearest" || hasCoords).map((s) => (
            <option key={s.id} value={s.id}>Sort: {s.label}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="f-bank">Bank card offers</label>
        <select id="f-bank" className={select} value={filters.bank} onChange={set("bank")}>
          <option value="">All banks</option>
          {BANKS.map((b) => (
            <option key={b.id} value={b.id}>{b.label} card offers</option>
          ))}
        </select>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="more-filters"
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          More filters{extraCount ? ` (${extraCount})` : ""}
        </button>
        {!isDefaultFilters(filters) && (
          <button type="button" onClick={() => setFilters({ ...DEFAULT_FILTERS, radius: filters.radius })} className="px-2 py-2 text-sm font-medium text-emerald-700 hover:underline">
            Clear all filters
          </button>
        )}
      </div>

      {open && (
        <div id="more-filters" className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Where to redeem</span>
            <select className={`${select} w-full`} value={filters.availability} onChange={set("availability")}>
              <option value="any">Online or in-store</option>
              <option value="in_store">In-store</option>
              <option value="online">Available online</option>
              <option value="online_only">Online only</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Brand</span>
            {/* A select, not a datalist: a datalist only suggests names matching what is typed, so once a brand was picked the others disappeared. */}
            <select className={`${select} w-full`} value={filters.brand} onChange={set("brand")}>
              <option value="">Any brand</option>
              {filters.brand && !brands.includes(filters.brand) && <option value={filters.brand}>{filters.brand}</option>}
              {brands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Source</span>
            <select className={`${select} w-full`} value={filters.sourceType} onChange={set("sourceType")}>
              <option value="">Any source</option>
              {SOURCE_TYPES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Minimum discount</span>
            <select className={`${select} w-full`} value={filters.minDiscount} onChange={set("minDiscount")}>
              <option value="">Any</option>
              {[10, 20, 30, 40, 50, 70].map((n) => (
                <option key={n} value={n}>{n}% or more</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={filters.national} onChange={set("national")} className="h-4 w-4 accent-emerald-700" />
            Include nationwide and online-only deals
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={filters.unverified} onChange={set("unverified")} className="h-4 w-4 accent-emerald-700" />
            Also show unverified offers (clearly labelled)
          </label>
        </div>
      )}
    </div>
  );
}

