"use client";

import { useState } from "react";
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
  sourceType: "",
  bank: "",
  minDiscount: "",
  sort: "newest",
  unverified: false,
};

export function isDefaultFilters(f) {
  return Object.keys(DEFAULT_FILTERS).every((k) => k === "radius" || k === "sort" || f[k] === DEFAULT_FILTERS[k]);
}

// Filters are kept in the address bar (only those that differ from the
// defaults), so a filtered list survives reloads and can be returned to.
const URL_KEYS = {
  q: "q",
  category: "category",
  brandOnly: "brand",
  validity: "validity",
  from: "from",
  to: "to",
  radius: "radius",
  national: "national",
  availability: "availability",
  sourceType: "source",
  bank: "bank",
  minDiscount: "min",
  sort: "sort",
  unverified: "unverified",
};
const ALLOWED = {
  category: CATEGORIES.map((c) => c.id),
  bank: BANKS.map((b) => b.id),
  sourceType: SOURCE_TYPES.map((s) => s.id),
  validity: VALIDITY_MODES.map((m) => m.id),
  sort: SORTS.map((s) => s.id),
};

export function filtersToSearch(f) {
  const p = new URLSearchParams();
  for (const [key, name] of Object.entries(URL_KEYS)) {
    const v = f[key];
    if (v === DEFAULT_FILTERS[key]) continue;
    p.set(name, typeof v === "boolean" ? (v ? "1" : "0") : String(v));
  }
  return p.toString();
}

export function filtersFromSearch(search) {
  const p = new URLSearchParams(search);
  const f = { ...DEFAULT_FILTERS };
  for (const [key, name] of Object.entries(URL_KEYS)) {
    const v = p.get(name);
    if (v == null || (ALLOWED[key] && !ALLOWED[key].includes(v))) continue;
    f[key] = typeof DEFAULT_FILTERS[key] === "boolean" ? v === "1" : v;
  }
  return f;
}

/** Short name for a filtered list, e.g. "Beauty & Personal Care · EBL"; "" when unfiltered. */
export function describeFilters(f) {
  const parts = [
    f.brandOnly ? "Brand offers" : CATEGORIES.find((c) => c.id === f.category)?.label,
    BANKS.find((b) => b.id === f.bank)?.label,
    f.q && `“${f.q}”`,
  ].filter(Boolean);
  return parts.join(" · ");
}

const select = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600";

export function CategoryNav({ filters, setFilters, counts }) {
  const rowRef = useDragScroll();
  const chip = (active) =>
    `flex shrink-0 snap-start items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition duration-200 active:scale-95 ${
      active ? "border-emerald-700 bg-emerald-700 text-white shadow-md shadow-emerald-700/20" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
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

// A filter select with a small × that resets it, shown only while it is set.
function ClearableSelect({ value, defaultValue = "", onClear, label, className = "", children, ...props }) {
  const set = value !== defaultValue;
  return (
    <span className={`relative inline-flex ${className}`}>
      <select {...props} aria-label={label} value={value} className={`${select} w-full ${set ? "pr-14" : ""}`}>
        {children}
      </select>
      {set && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Clear ${label}`}
          title={`Clear ${label}`}
          className="absolute right-7 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-base leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          ×
        </button>
      )}
    </span>
  );
}

export function FilterBar({ filters, setFilters, hasCoords, hasCity }) {
  const [open, setOpen] = useState(false);
  const set = (k) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setFilters((f) => ({ ...f, [k]: v }));
  };
  const clear = (...keys) => () => setFilters((f) => ({ ...f, ...Object.fromEntries(keys.map((k) => [k, DEFAULT_FILTERS[k]])) }));

  const radiusOptions = RADIUS_OPTIONS.filter((r) => (r.id === "city" ? hasCity : r.id === "country" ? true : hasCoords));
  const extraCount = ["availability", "sourceType", "minDiscount"].filter((k) => filters[k] !== DEFAULT_FILTERS[k]).length + (filters.unverified ? 1 : 0) + (filters.national ? 0 : 1);
  // Sits after the last filter: in the first row, or at the end of the open panel.
  const clearAll = !isDefaultFilters(filters) && (
    <button type="button" onClick={() => setFilters({ ...DEFAULT_FILTERS, radius: filters.radius })} className="px-2 py-2 text-sm font-medium text-emerald-700 hover:underline">
      Clear all filters
    </button>
  );

  return (
    <div className="space-y-3">
      {/* One line that scrolls sideways when it does not fit: wrapping made the row grow as filters (and Clear all) appeared, shifting the page. */}
      <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 py-1 [&>*]:shrink-0">
        <ClearableSelect id="f-validity" label="validity" value={filters.validity} defaultValue={DEFAULT_FILTERS.validity} onChange={set("validity")} onClear={clear("validity", "from", "to")}>
          {VALIDITY_MODES.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </ClearableSelect>
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
        <ClearableSelect id="f-bank" label="bank" value={filters.bank} onChange={set("bank")} onClear={clear("bank")}>
          <option value="">All banks</option>
          {BANKS.map((b) => (
            <option key={b.id} value={b.id}>{b.label} card offers</option>
          ))}
        </ClearableSelect>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="more-filters"
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          More filters{extraCount ? ` (${extraCount})` : ""}
        </button>
        {!open && clearAll}
      </div>

      {open && (
        <div id="more-filters" className="panel-in grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Where to redeem</span>
            <ClearableSelect className="w-full" label="where to redeem" value={filters.availability} defaultValue={DEFAULT_FILTERS.availability} onChange={set("availability")} onClear={clear("availability")}>
              <option value="any">Online or in-store</option>
              <option value="in_store">In-store</option>
              <option value="online">Available online</option>
              <option value="online_only">Online only</option>
            </ClearableSelect>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Source</span>
            <ClearableSelect className="w-full" label="source" value={filters.sourceType} onChange={set("sourceType")} onClear={clear("sourceType")}>
              <option value="">Any source</option>
              {SOURCE_TYPES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </ClearableSelect>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Minimum discount</span>
            <ClearableSelect className="w-full" label="minimum discount" value={filters.minDiscount} onChange={set("minDiscount")} onClear={clear("minDiscount")}>
              <option value="">Any</option>
              {[10, 20, 30, 40, 50, 70].map((n) => (
                <option key={n} value={n}>{n}% or more</option>
              ))}
            </ClearableSelect>
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={filters.national} onChange={set("national")} className="h-4 w-4 accent-emerald-700" />
            Include nationwide and online-only deals
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={filters.unverified} onChange={set("unverified")} className="h-4 w-4 accent-emerald-700" />
            Also show unverified offers (clearly labelled)
          </label>
          {clearAll && <div className="flex justify-end sm:col-span-2 lg:col-span-4">{clearAll}</div>}
        </div>
      )}
    </div>
  );
}

