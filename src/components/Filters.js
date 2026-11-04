"use client";

import { useEffect, useState } from "react";
import { AUDIENCES, BANK_GROUPS, BANKS, bankOffersLabel, CATEGORIES, RADIUS_OPTIONS, SORTS, SOURCE_TYPES, STORE_GROUPS, STORES, VALIDITY_MODES } from "@/lib/constants";

export const DEFAULT_FILTERS = {
  q: "",
  audience: "",
  category: "",
  brandOnly: false,
  store: "",
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
  audience: "for",
  category: "category",
  brandOnly: "brand",
  store: "store",
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
  audience: AUDIENCES.map((a) => a.id),
  category: CATEGORIES.map((c) => c.id),
  store: STORES.map((s) => s.id),
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

// --- The menu --------------------------------------------------------------

// "Shop for" groups. Audience groups narrow to offers for that audience (or for
// everyone); Home & Household is categories only.
const SHOP_FOR = [
  {
    id: "men",
    audience: "men",
    label: "Men",
    allLabel: "All men's offers",
    icon: "👔",
    items: [
      ["fashion", "Clothing"],
      ["footwear", "Shoes"],
      ["bags", "Bags & accessories"],
      ["beauty", "Grooming"],
    ],
  },
  {
    id: "women",
    audience: "women",
    label: "Women",
    allLabel: "All women's offers",
    icon: "👠",
    items: [
      ["fashion", "Clothing"],
      ["footwear", "Shoes"],
      ["bags", "Bags & accessories"],
      ["beauty", "Beauty & personal care"],
    ],
  },
  {
    id: "kids",
    audience: "kids",
    label: "Kids",
    allLabel: "All kids' offers",
    icon: "🧸",
    items: [
      ["fashion", "Clothing"],
      ["footwear", "Shoes"],
      ["bags", "Bags"],
      ["entertainment", "Toys & activities"],
    ],
  },
  {
    id: "household",
    audience: "",
    label: "Home & Household",
    icon: "🏠",
    items: [
      ["groceries", "Groceries & supermarkets"],
      ["home", "Home & furniture"],
      ["electronics", "Electronics & appliances"],
    ],
  },
];
const OTHER_CATEGORIES = ["food", "hotels", "travel", "health", "entertainment", "services"];

const categoryOf = (id) => CATEGORIES.find((c) => c.id === id);

/** Heading for the offer list and the back link, e.g. "Men · Shoes"; "" when unfiltered. */
export function describeFilters(f) {
  const group = SHOP_FOR.find((g) => g.audience === f.audience && g.audience);
  const sub = group?.items.find(([id]) => id === f.category)?.[1];
  const parts = [
    group ? (sub ? `${group.label} · ${sub}` : group.allLabel.replace(/^All (\w)/, (_, c) => c.toUpperCase())) : categoryOf(f.category)?.label,
    f.brandOnly && !f.store && "Brand offers",
    STORES.find((s) => s.id === f.store)?.label,
    BANKS.find((b) => b.id === f.bank) && bankOffersLabel(BANKS.find((b) => b.id === f.bank)),
    f.q && `“${f.q}”`,
  ].filter(Boolean);
  return parts.join(" · ");
}

/** Filters set outside "All offers", "Sort" and the location radius, for the phone Filters button. */
export function activeFilterCount(f) {
  return (
    (f.audience || f.category ? 1 : 0) +
    (f.brandOnly || f.store ? 1 : 0) +
    (f.bank ? 1 : 0) +
    ["validity", "availability", "sourceType", "minDiscount"].filter((k) => f[k] !== DEFAULT_FILTERS[k]).length +
    (f.unverified ? 1 : 0) +
    (f.national ? 0 : 1)
  );
}

const select = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-600";

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

function Chevron({ open }) {
  return (
    <svg aria-hidden="true" className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function Count({ n }) {
  return n == null ? null : <span className="ml-auto shrink-0 pl-2 text-xs tabular-nums text-slate-400">{n}</span>;
}

// One selectable entry; picking the selected entry again clears it.
function Item({ active, onClick, children, count, indent = false }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      // The same weight whether chosen or not: bold text is wider and could wrap, shifting the menu.
      className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${indent ? "pl-4" : ""} ${
        active ? "bg-brand-50 text-brand-ink-strong ring-1 ring-inset ring-brand-600/20" : "text-slate-700 hover:bg-slate-100"
      } ${count === 0 && !active ? "opacity-50" : ""}`}
    >
      {children}
      <Count n={count} />
    </button>
  );
}

function Accordion({ id, icon, label, open, onToggle, active, children }) {
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`menu-${id}`}
        onClick={onToggle}
        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-slate-100 ${active ? "text-brand-ink-strong" : "text-slate-800"}`}
      >
        <span aria-hidden="true" className="w-5 text-center text-base">{icon}</span>
        <span className="flex-1">{label}</span>
        {active && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-600" />}
        <Chevron open={open} />
      </button>
      {open && (
        <div id={`menu-${id}`} className="panel-in ml-5 mt-0.5 space-y-0.5 border-l border-slate-200 pb-1 pl-2">
          {children}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }) {
  return <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{children}</p>;
}

/**
 * The filter menu: All offers, "Shop for" groups (Men, Women, Kids, Home), the
 * other categories, Brands, Banks and More filters. It is the sidebar on large
 * screens and the drawer on phones and tablets. `onPick` runs after any choice
 * (the drawer closes on it).
 */
export function FilterMenu({ filters, setFilters, counts, hasCoords, hasCity, onPick = () => {} }) {
  const [open, setOpen] = useState(() => new Set());
  // Open the groups holding the current choice (also when it comes from the address bar).
  const { audience, category, store, bank } = filters;
  const storeGroup = STORES.find((s) => s.id === store)?.group;
  const bankGroup = BANKS.find((b) => b.id === bank)?.group;
  useEffect(() => {
    const ids = [];
    const group = SHOP_FOR.find((g) => (g.audience ? g.audience === audience : !audience && g.items.some(([c]) => c === category)));
    if (group) ids.push(group.id);
    if (storeGroup) ids.push("brands", `brands-${storeGroup}`);
    if (bankGroup) ids.push("banks", `banks-${bankGroup}`);
    if (ids.length) setOpen((s) => (ids.every((id) => s.has(id)) ? s : new Set([...s, ...ids])));
  }, [audience, category, storeGroup, bankGroup]);
  const toggle = (id) => setOpen((s) => new Set(s.has(id) ? [...s].filter((x) => x !== id) : [...s, id]));
  const apply = (patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    onPick();
  };

  // One menu choice at a time (a category, a brand or a bank): mixing them, like
  // Women · Beauty at a supermarket with EBL cards, mostly finds nothing.
  const NONE = { audience: "", category: "", brandOnly: false, store: "", bank: "" };
  const pick = (choice, selected) => apply(selected ? NONE : { ...NONE, ...choice });
  const pickShop = (audience, category) => pick({ audience, category }, filters.audience === audience && filters.category === category);
  const isShop = (audience, category) => filters.audience === audience && filters.category === category;
  const groupActive = (g) => (g.audience ? filters.audience === g.audience : !filters.audience && g.items.some(([c]) => c === filters.category));
  const nothingPicked = !filters.audience && !filters.category && !filters.brandOnly && !filters.store && !filters.bank;

  const set = (k) => (e) => apply({ [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const clear = (...keys) => () => apply(Object.fromEntries(keys.map((k) => [k, DEFAULT_FILTERS[k]])));
  const radiusOptions = RADIUS_OPTIONS.filter((r) => (r.id === "city" ? hasCity : r.id === "country" ? true : hasCoords));
  const moreCount = ["validity", "availability", "sourceType", "minDiscount"].filter((k) => filters[k] !== DEFAULT_FILTERS[k]).length + (filters.unverified ? 1 : 0) + (filters.national ? 0 : 1);

  return (
    <nav aria-label="Filter offers" className="space-y-0.5">
      <Item active={nothingPicked} count={counts?.all} onClick={() => apply(NONE)}>
        <span aria-hidden="true" className="mr-2.5 w-5 text-center text-base">✨</span>All offers
      </Item>

      <SectionLabel>Shop for</SectionLabel>
      {SHOP_FOR.map((g) => (
        <Accordion key={g.id} id={g.id} icon={g.icon} label={g.label} open={open.has(g.id)} onToggle={() => toggle(g.id)} active={groupActive(g)}>
          {g.audience && (
            <Item indent active={isShop(g.audience, "")} onClick={() => pickShop(g.audience, "")}>
              {g.allLabel}
            </Item>
          )}
          {g.items.map(([cat, label]) => (
            <Item
              key={cat}
              indent
              active={isShop(g.audience, cat)}
              count={g.audience ? counts?.audiences?.[g.audience]?.[cat] ?? (counts ? 0 : null) : counts?.categories?.[cat] ?? (counts ? 0 : null)}
              onClick={() => pickShop(g.audience, cat)}
            >
              {label}
            </Item>
          ))}
        </Accordion>
      ))}

      <SectionLabel>Categories</SectionLabel>
      {OTHER_CATEGORIES.map((id) => (
        <Item key={id} active={isShop("", id)} count={counts?.categories?.[id] ?? (counts ? 0 : null)} onClick={() => pickShop("", id)}>
          <span aria-hidden="true" className="mr-2.5 w-5 text-center text-base">{categoryOf(id).icon}</span>
          {categoryOf(id).label}
        </Item>
      ))}

      <SectionLabel>Brands &amp; banks</SectionLabel>
      {/* Brands open to their groups (Clothing, Shoes & bags…), and each group to its brands. */}
      <Accordion id="brands" icon="🏷️" label="Brands" open={open.has("brands")} onToggle={() => toggle("brands")} active={Boolean(storeGroup)}>
        {STORE_GROUPS.map((g) => (
          <Accordion key={g.id} id={`brands-${g.id}`} icon={g.icon} label={g.label} open={open.has(`brands-${g.id}`)} onToggle={() => toggle(`brands-${g.id}`)} active={storeGroup === g.id}>
            {STORES.filter((s) => s.group === g.id).map((s) => (
              <Item key={s.id} indent active={filters.store === s.id} count={counts?.stores?.[s.id]} onClick={() => pick({ store: s.id }, filters.store === s.id)}>
                {s.label}
              </Item>
            ))}
          </Accordion>
        ))}
      </Accordion>
      {/* Bank & card offers open to Bank and MFS (mobile wallets), and each to its names. */}
      <Accordion id="banks" icon="💳" label="Bank & card offers" open={open.has("banks")} onToggle={() => toggle("banks")} active={Boolean(bankGroup)}>
        {BANK_GROUPS.map((g) => (
          <Accordion key={g.id} id={`banks-${g.id}`} icon={g.icon} label={g.label} open={open.has(`banks-${g.id}`)} onToggle={() => toggle(`banks-${g.id}`)} active={bankGroup === g.id}>
            {BANKS.filter((b) => b.group === g.id).map((b) => (
              <Item key={b.id} indent active={filters.bank === b.id} count={counts?.banks?.[b.id]} onClick={() => pick({ bank: b.id }, filters.bank === b.id)}>
                {b.label}
              </Item>
            ))}
          </Accordion>
        ))}
      </Accordion>

      <div className="pt-3">
        <Accordion id="more" icon="⚙️" label={`More filters${moreCount ? ` (${moreCount})` : ""}`} open={open.has("more")} onToggle={() => toggle("more")} active={moreCount > 0}>
          <div className="space-y-3 py-2 pr-1">
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-slate-700">Valid</span>
              <ClearableSelect className="w-full" label="validity" value={filters.validity} defaultValue={DEFAULT_FILTERS.validity} onChange={set("validity")} onClear={clear("validity", "from", "to")}>
                {VALIDITY_MODES.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </ClearableSelect>
            </label>
            {filters.validity === "custom" && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <label>
                  <span className="mb-1 block text-slate-600">From</span>
                  <input type="date" className={`${select} w-full`} value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
                </label>
                <label>
                  <span className="mb-1 block text-slate-600">To</span>
                  <input type="date" className={`${select} w-full`} value={filters.to} min={filters.from || undefined} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
                </label>
              </div>
            )}
            {radiusOptions.length > 0 && (
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-slate-700">Distance</span>
                <select className={`${select} w-full`} value={filters.radius} onChange={set("radius")}>
                  {radiusOptions.map((r) => (
                    <option key={r.id} value={r.id}>{r.id === "city" || r.id === "country" ? r.label : `Within ${r.label}`}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-slate-700">Where to redeem</span>
              <ClearableSelect className="w-full" label="where to redeem" value={filters.availability} defaultValue={DEFAULT_FILTERS.availability} onChange={set("availability")} onClear={clear("availability")}>
                <option value="any">Online or in-store</option>
                <option value="in_store">In-store</option>
                <option value="online">Available online</option>
                <option value="online_only">Online only</option>
              </ClearableSelect>
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-slate-700">Source</span>
              <ClearableSelect className="w-full" label="source" value={filters.sourceType} onChange={set("sourceType")} onClear={clear("sourceType")}>
                <option value="">Any source</option>
                {SOURCE_TYPES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </ClearableSelect>
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-slate-700">Minimum discount</span>
              <ClearableSelect className="w-full" label="minimum discount" value={filters.minDiscount} onChange={set("minDiscount")} onClear={clear("minDiscount")}>
                <option value="">Any</option>
                {[10, 20, 30, 40, 50, 70].map((n) => (
                  <option key={n} value={n}>{n}% or more</option>
                ))}
              </ClearableSelect>
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <input type="checkbox" checked={filters.national} onChange={set("national")} className="h-4 w-4 shrink-0 accent-brand-700" />
              Include nationwide and online-only deals
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <input type="checkbox" checked={filters.unverified} onChange={set("unverified")} className="h-4 w-4 shrink-0 accent-brand-700" />
              Also show unverified offers (clearly labelled)
            </label>
          </div>
        </Accordion>
      </div>
    </nav>
  );
}

/** Small removable tags for what is filtered, shown above the results. */
export function ActiveFilters({ filters, setFilters }) {
  const tags = [];
  const name = describeFilters({ ...DEFAULT_FILTERS, audience: filters.audience, category: filters.category });
  if (name) tags.push([name, { audience: "", category: "" }]);
  if (filters.store) tags.push([STORES.find((s) => s.id === filters.store)?.label, { store: "" }]);
  else if (filters.brandOnly) tags.push(["Brand offers", { brandOnly: false }]);
  const tagBank = BANKS.find((b) => b.id === filters.bank);
  if (tagBank) tags.push([tagBank.group === "bank" ? `${tagBank.label} cards` : tagBank.label, { bank: "" }]);
  if (filters.minDiscount) tags.push([`${filters.minDiscount}%+ off`, { minDiscount: "" }]);
  if (filters.sourceType) tags.push([SOURCE_TYPES.find((s) => s.id === filters.sourceType)?.label, { sourceType: "" }]);
  if (filters.availability !== "any") tags.push([{ in_store: "In-store", online: "Available online", online_only: "Online only" }[filters.availability], { availability: "any" }]);
  if (filters.validity !== "today") tags.push([VALIDITY_MODES.find((m) => m.id === filters.validity)?.label, { validity: "today", from: "", to: "" }]);
  if (!tags.length) return null;
  return (
    <>
      {tags.map(([label, reset]) => (
        <button
          key={label}
          type="button"
          onClick={() => setFilters((f) => ({ ...f, ...reset }))}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-brand-600/30 bg-brand-50 py-1.5 pl-3 pr-2 text-sm font-medium text-brand-ink-strong transition hover:border-brand-600/60 active:scale-95"
          aria-label={`Remove filter: ${label}`}
        >
          {label}
          <span aria-hidden="true" className="text-base leading-none opacity-70">×</span>
        </button>
      ))}
      {!isDefaultFilters(filters) && (
        <button type="button" onClick={() => setFilters((f) => ({ ...DEFAULT_FILTERS, q: f.q, radius: f.radius, sort: f.sort }))} className="shrink-0 px-1 text-sm font-medium text-brand-ink hover:underline">
          Clear all
        </button>
      )}
    </>
  );
}

export function SortSelect({ filters, setFilters, hasCoords, className = "" }) {
  return (
    <label className={`flex shrink-0 items-center gap-2 text-sm text-slate-500 ${className}`}>
      <span className="hidden sm:inline">Sort</span>
      <select aria-label="Sort by" className={select} value={filters.sort} onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}>
        {SORTS.filter((s) => s.id !== "nearest" || hasCoords).map((s) => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>
    </label>
  );
}

/** The filter menu as a drawer from the left, for phones and tablets. */
export function FilterDrawer({ open, onClose, total, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    // The page behind should not scroll while the drawer is open.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="lg:hidden">
      <div aria-hidden="true" onClick={onClose} className="backdrop-in fixed inset-0 z-40 bg-black/50" />
      <div role="dialog" aria-modal="true" aria-label="Filters" className="drawer-in fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-sm flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
          <button type="button" onClick={onClose} aria-label="Close filters" className="grid h-9 w-9 place-items-center rounded-full text-xl leading-none text-slate-500 hover:bg-slate-100">
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-2 py-2">{children}</div>
        <div className="border-t border-slate-200 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button type="button" onClick={onClose} className="w-full rounded-full bg-brand-700 py-3 text-sm font-semibold text-white shadow-md shadow-brand-700/20 active:scale-[0.98]">
            {total == null ? "Show offers" : `Show ${total} ${total === 1 ? "offer" : "offers"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
