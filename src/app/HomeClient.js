"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import OfferCard, { OfferCardSkeleton } from "@/components/OfferCard";
import LocationPicker, { requestBrowserLocation } from "@/components/LocationPicker";
import {
  ActiveFilters,
  DEFAULT_FILTERS,
  FilterDrawer,
  FilterMenu,
  SortSelect,
  activeFilterCount,
  describeFilters,
  filtersFromSearch,
  filtersToSearch,
  isDefaultFilters,
} from "@/components/Filters";
import { Logo, BottomNav } from "@/components/SiteChrome";
import ThemeToggle from "@/components/ThemeToggle";
import HeaderShell from "@/components/HeaderShell";
import { useDragScroll, useStoredState, useToday } from "@/components/hooks";
import { rememberList, rememberedList, takeScrollRestore } from "@/lib/return-to";

const PAGE_SIZE = 12;

function buildParams({ location, filters, tz, date }) {
  const p = new URLSearchParams({ tz, date });
  if (location?.lat != null) p.set("lat", location.lat), p.set("lng", location.lng);
  if (location?.city) p.set("city", location.city);
  if (location?.country) p.set("country", location.country);
  let radius = filters.radius;
  if (location?.lat == null) radius = location?.city ? "city" : "25";
  if (radius === "city" && !location?.city) radius = "25";
  if (radius === "country" && !location?.country) radius = "25";
  p.set("radius", radius);
  if (!filters.national) p.set("national", "0");
  if (filters.unverified) p.set("unverified", "1");
  if (filters.validity !== "today") p.set("validity", filters.validity);
  if (filters.validity === "custom") {
    if (filters.from) p.set("from", filters.from);
    if (filters.to) p.set("to", filters.to);
  }
  for (const k of ["q", "audience", "category", "store", "sourceType", "bank", "minDiscount"]) if (filters[k]) p.set(k, String(filters[k]).trim());
  if (filters.availability !== "any") p.set("availability", filters.availability);
  if (filters.brandOnly) p.set("section", "brand");
  let sort = filters.sort;
  if (sort === "nearest" && location?.lat == null) sort = "newest";
  p.set("sort", sort);
  return p;
}

async function fetchOffers(params, signal) {
  const r = await fetch(`/api/offers?${params}`, { signal });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const detail = data.fields ? Object.values(data.fields).join(" ") : data.error;
    throw new Error(detail || "Could not load offers");
  }
  return data;
}

function Section({ title, subtitle, params, extra }) {
  const [state, setState] = useState({ loading: true, items: [] });
  const rowRef = useDragScroll();
  const key = params ? `${params}&${extra}` : null;
  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true }));
    fetchOffers(new URLSearchParams(key), ctrl.signal)
      .then((d) => setState({ loading: false, items: d.items }))
      .catch((e) => e.name !== "AbortError" && setState({ loading: false, items: [] }));
    return () => ctrl.abort();
  }, [key]);
  if (!state.loading && state.items.length === 0) return null;
  return (
    <section aria-label={title} className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div ref={rowRef} className="no-scrollbar -mx-4 flex cursor-grab snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-px-4 px-4 pb-2">
        {state.loading
          ? [0, 1, 2, 3, 4].map((i) => <OfferCardSkeleton key={i} index={i} compact />)
          : state.items.map((o, i) => <OfferCard key={o.id} offer={o} index={i} compact />)}
      </div>
    </section>
  );
}

export default function HomeClient() {
  const { tz, date } = useToday();
  const [location, setLocation, locationLoaded] = useStoredState("of.location", null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  // Filters come from the address bar, read once on the client before the first load.
  const [filtersReady, setFiltersReady] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const [pickerMessage, setPickerMessage] = useState(null);
  const [locating, setLocating] = useState(false);
  const [geoAttempted, setGeoAttempted] = useState(false);
  const [feed, setFeed] = useState({ status: "idle", items: [], total: 0, page: 1, hasMore: false, error: null });
  // Offers per category chip; kept while a new query loads so the chips do not flicker.
  const [counts, setCounts] = useState(null);
  const [searchText, setSearchText] = useState("");
  const autoTried = useRef(false);
  // Discovery runs on page load (the server applies a shared cooldown).
  const [discovery, setDiscovery] = useState({ status: "idle", found: 0 });
  const [reloadToken, setReloadToken] = useState(0);
  const discoveryStarted = useRef(false);
  const scrollRestored = useRef(false);

  useEffect(() => {
    const initial = filtersFromSearch(window.location.search);
    setFilters(initial);
    setSearchText(initial.q);
    setFiltersReady(true);
    // The bottom bar's "Location" link opens the picker.
    if (new URLSearchParams(window.location.search).get("location") === "1") setPickerOpen(true);
  }, []);

  // Keep the address bar in step with the filters, and remember this list so
  // offer pages can link back to it.
  const listHref = useMemo(() => {
    const qs = filtersToSearch(filters);
    return qs ? `/?${qs}` : "/";
  }, [filters]);
  const listName = describeFilters(filters);
  const listLabel = !listName ? "" : /offers$/.test(listName) ? listName : `${listName} offers`;
  useEffect(() => {
    if (!filtersReady) return;
    if (window.location.pathname + window.location.search !== listHref) window.history.replaceState(null, "", listHref);
    // Same list as remembered (e.g. on the way back): keep its scroll position.
    const prev = rememberedList();
    if (prev?.href !== listHref || prev.label !== listLabel) rememberList({ href: listHref, label: listLabel, scrollY: 0 });
  }, [filtersReady, listHref, listLabel]);

  // Opening an offer records where on the list it was, for the way back.
  const onListClick = (e) => {
    if (e.target.closest?.('a[href^="/offers/"]')) rememberList({ href: listHref, label: listLabel, scrollY: window.scrollY });
  };

  // First visit: explain and ask for the browser location; fall back to manual choice.
  useEffect(() => {
    if (!locationLoaded || autoTried.current) return;
    autoTried.current = true;
    if (location) {
      setGeoAttempted(true);
      return;
    }
    setLocating(true);
    requestBrowserLocation()
      .then((loc) => setLocation(loc))
      .catch((e) => {
        setPickerMessage(e.message);
        setPickerOpen(true);
      })
      .finally(() => {
        setLocating(false);
        setGeoAttempted(true);
      });
  }, [locationLoaded, location, setLocation]);

  // Debounce the search box into filters.
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.q === searchText ? f : { ...f, q: searchText })), 300);
    return () => clearTimeout(t);
  }, [searchText]);

  const ready = Boolean(tz && date && geoAttempted && filtersReady);
  const baseParams = useMemo(() => (ready ? buildParams({ location, filters, tz, date }) : null), [ready, location, filters, tz, date]);
  const paramsKey = baseParams?.toString();

  const load = useCallback(
    async (page, signal, { silent = false } = {}) => {
      const p = new URLSearchParams(paramsKey);
      p.set("page", String(page));
      p.set("limit", String(PAGE_SIZE));
      if (page === 1) p.set("counts", "1");
      if (!silent) setFeed((f) => ({ ...f, status: page === 1 ? "loading" : "loading-more", error: null }));
      try {
        const d = await fetchOffers(p, signal);
        if (d.counts) setCounts(d.counts);
        setFeed((f) => {
          // Offers published since page 1 shift later pages, so a page can repeat
          // offers already shown; keep the first copy of each.
          const seen = new Set(page === 1 ? [] : f.items.map((o) => o.id));
          const items = page === 1 ? d.items : [...f.items, ...d.items.filter((o) => !seen.has(o.id))];
          return { status: "done", items, total: d.total, page, hasMore: d.hasMore, error: null };
        });
      } catch (e) {
        if (e.name !== "AbortError") setFeed((f) => ({ ...f, status: "error", error: e.message }));
      }
    },
    [paramsKey],
  );

  useEffect(() => {
    if (!paramsKey) return;
    const ctrl = new AbortController();
    load(1, ctrl.signal);
    return () => ctrl.abort();
  }, [paramsKey, load]);

  // Coming back from an offer: once the list has loaded, return to where it was.
  useEffect(() => {
    if (feed.status !== "done" || scrollRestored.current) return;
    scrollRestored.current = true;
    const y = takeScrollRestore(listHref);
    if (y) setTimeout(() => window.scrollTo(0, y), 0);
  }, [feed.status, listHref]);

  // Once per page load, ask the server to look for new offers. It returns at
  // once if another visitor triggered a check recently.
  useEffect(() => {
    if (!ready || discoveryStarted.current) return;
    discoveryStarted.current = true;
    setDiscovery({ status: "checking", found: 0 });
    fetch("/api/discover/refresh", { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const found = d?.published || 0;
        setDiscovery({ status: "done", found });
        if (found) setReloadToken((t) => t + 1);
      })
      .catch(() => setDiscovery({ status: "done", found: 0 }));
  }, [ready]);

  // New offers were published: refresh the list in place, without skeletons.
  useEffect(() => {
    if (!reloadToken || !paramsKey) return;
    const ctrl = new AbortController();
    load(1, ctrl.signal, { silent: true });
    return () => ctrl.abort();
    // Only reload when discovery reports new offers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadToken]);

  const selectLocation = (loc) => {
    setLocation(loc);
    setPickerOpen(false);
    setPickerMessage(null);
    if (loc.lat == null) setFilters((f) => ({ ...f, radius: "city" }));
    else if (filters.radius === "city" && !loc.city) setFilters((f) => ({ ...f, radius: "25" }));
  };

  const showSections = isDefaultFilters(filters);
  const sectionBase = useMemo(() => {
    if (!baseParams) return null;
    const p = new URLSearchParams(baseParams);
    p.delete("sort");
    p.set("limit", "10");
    return p.toString();
  }, [baseParams]);

  const todayLabel = date
    ? new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(new Date())
    : "";

  const feedTitle = describeFilters(filters) || "All verified offers";

  return (
    <>
      <HeaderShell spacerClassName="h-[123px] sm:h-[69px]">
        {/* Phones: logo and location share the first row, search and theme the second. */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-3 sm:flex-nowrap">
          <div className="flex w-full min-w-0 items-center gap-3 sm:w-auto">
            <Logo />
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="group flex min-w-0 flex-1 items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 text-sm shadow-sm transition hover:border-emerald-600/50 hover:shadow active:scale-[0.98] sm:max-w-xs sm:flex-none"
              aria-label={`Change location. Current: ${location?.label || "not set"}`}
            >
              <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700 transition-colors group-hover:bg-emerald-100">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z" />
                  <circle cx="12" cy="9.5" r="2.5" />
                </svg>
              </span>
              <span className="truncate font-medium text-slate-800">{locating ? "Finding your location…" : location?.label || "Choose location"}</span>
              <svg aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform group-hover:translate-y-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>
          <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto sm:gap-3">
            <form role="search" onSubmit={(e) => e.preventDefault()} className="relative min-w-0 flex-1 sm:w-80 sm:flex-none">
              <label htmlFor="q" className="sr-only">Search offers</label>
              <svg aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                id="q"
                type="search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search offers, brands, shops…"
                className="w-full rounded-full border border-transparent bg-slate-100 py-2.5 pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-100"
              />
            </form>
            <ThemeToggle />
          </div>
        </div>
      </HeaderShell>

      <main onClickCapture={onListClick} className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-24 sm:pb-8">
        <div className="mb-5 space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Offers {location?.city ? `in ${location.city}` : location ? "near you" : ""} today
            </h1>
            <p className="text-sm text-slate-500">
              {todayLabel}
              {tz && <span className="text-slate-400"> · {tz}</span>}
            </p>
          </div>
          {!location && geoAttempted && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <span>Choose a location to see offers near you. Until then, only nationwide and online offers are shown.</span>
              <button type="button" onClick={() => setPickerOpen(true)} className="rounded-lg bg-amber-900 px-3 py-1.5 font-medium text-white dark:text-amber-50">
                Choose location
              </button>
            </div>
          )}
          {locating && !location && (
            <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-700" role="status">
              Your browser may ask for permission to share your location. We use it only to find nearby offers and never store it on our servers.
            </p>
          )}
        </div>

        {/* Large screens: the filter menu is a sidebar; phones and tablets open it as a drawer. */}
        <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
          <aside aria-label="Filters" className="hidden lg:block">
            <div className="no-scrollbar sticky top-[86px] max-h-[calc(100vh-102px)] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-2 pb-4">
              <FilterMenu filters={filters} setFilters={setFilters} counts={counts} hasCoords={location?.lat != null} hasCity={Boolean(location?.city)} />
            </div>
          </aside>

          <div className="min-w-0 space-y-8">
            <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 py-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="flex shrink-0 items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-emerald-600/50 active:scale-95 lg:hidden"
              >
                <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 6h16M7 12h10M10 18h4" />
                </svg>
                Filters
                {activeFilterCount(filters) > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-emerald-700 px-1.5 text-xs text-white">{activeFilterCount(filters)}</span>
                )}
              </button>
              <ActiveFilters filters={filters} setFilters={setFilters} />
              <SortSelect className="ml-auto pl-2" filters={filters} setFilters={setFilters} hasCoords={location?.lat != null} />
            </div>

            {showSections && sectionBase && (
              <div className="space-y-8">
                <Section key={`brand-${reloadToken}`} title="Brand Offers" subtitle="Sales and campaigns run by brands and shops" params={sectionBase} extra="section=brand" />
                {location?.lat != null && (
                  <Section key={`near-${reloadToken}`} title="Near You" subtitle="Closest verified branches first" params={sectionBase} extra="section=near" />
                )}
                <Section key={`ending-${reloadToken}`} title="Ending Soon" subtitle="Valid offers ending in the next 7 days" params={sectionBase} extra="section=ending" />
                <Section key={`recent-${reloadToken}`} title="Recently Added" params={sectionBase} extra="section=recent" />
              </div>
            )}

            <section aria-label={feedTitle} aria-busy={feed.status === "loading"} className="min-h-[75vh] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-900">{feedTitle}</h2>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  {discovery.status === "checking" && (
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800" role="status">
                      <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-600" aria-hidden="true" />
                      Checking for new offers…
                    </span>
                  )}
                  {discovery.status === "done" && discovery.found > 0 && (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800" role="status">
                      ✓ {discovery.found} new {discovery.found === 1 ? "offer" : "offers"} found
                    </span>
                  )}
                  {feed.status === "done" && <span>{feed.total} {feed.total === 1 ? "offer" : "offers"}</span>}
                </div>
              </div>

              {feed.status === "error" && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
                  {feed.error}{" "}
                  <button type="button" className="font-semibold underline" onClick={() => load(1)}>
                    Try again
                  </button>
                </div>
              )}

              {(feed.status === "loading" || feed.status === "idle") && (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <OfferCardSkeleton key={i} index={i} />
                  ))}
                </div>
              )}

              {feed.status !== "loading" && feed.status !== "idle" && feed.items.length > 0 && (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {feed.items.map((o, i) => (
                    <OfferCard key={o.id} offer={o} index={i % PAGE_SIZE} />
                  ))}
                </div>
              )}

              {feed.status === "done" && feed.items.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                  <p className="font-medium text-slate-800">
                    {location ? "No verified offers found in this area today." : "No verified nationwide or online offers right now."}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Try expanding your search radius, selecting another category, or clearing filters.
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {!isDefaultFilters(filters) && (
                      <button type="button" onClick={() => setFilters({ ...DEFAULT_FILTERS, radius: filters.radius })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium">
                        Clear all filters
                      </button>
                    )}
                    {location?.lat != null && filters.radius !== "country" && (
                      <button type="button" onClick={() => setFilters((f) => ({ ...f, radius: "50" }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium">
                        Search within 50 km
                      </button>
                    )}
                    <button type="button" onClick={() => setPickerOpen(true)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium">
                      Change location
                    </button>
                  </div>
                </div>
              )}

              {feed.hasMore && feed.status !== "loading" && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    disabled={feed.status === "loading-more"}
                    onClick={() => load(feed.page + 1)}
                    className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {feed.status === "loading-more" ? "Loading…" : "Load more offers"}
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      <FilterDrawer open={drawerOpen} onClose={closeDrawer} total={feed.status === "done" ? feed.total : null}>
        <FilterMenu filters={filters} setFilters={setFilters} counts={counts} hasCoords={location?.lat != null} hasCity={Boolean(location?.city)} onPick={closeDrawer} />
      </FilterDrawer>

      <LocationPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={selectLocation} current={location} message={pickerMessage} />
      <BottomNav active="home" />
    </>
  );
}
