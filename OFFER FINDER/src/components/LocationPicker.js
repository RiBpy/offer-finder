"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { roundCoord } from "@/lib/geo";

let countryCache;
function countryOptions() {
  if (countryCache) return countryCache;
  const names = new Intl.DisplayNames(undefined, { type: "region" });
  const out = [];
  for (let a = 65; a <= 90; a++)
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      try {
        const name = names.of(code);
        if (name && name !== code && !/unknown/i.test(name)) out.push({ code, name });
      } catch {
        // not a region code
      }
    }
  // Drop pseudo-regions that DisplayNames knows but are not countries.
  const skip = new Set(["EU", "EZ", "UN", "QO", "XA", "XB", "ZZ"]);
  countryCache = out.filter((c) => !skip.has(c.code)).sort((x, y) => x.name.localeCompare(y.name));
  return countryCache;
}

export function guessCountry() {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    return region && /^[A-Z]{2}$/.test(region) ? region : "";
  } catch {
    return "";
  }
}

/**
 * Requests the browser location and resolves to a location object, or throws
 * with a user-facing message.
 */
export function requestBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("Your browser does not support location access."));
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = roundCoord(pos.coords.latitude);
        const lng = roundCoord(pos.coords.longitude);
        let place = {};
        try {
          const r = await fetch(`/api/location/reverse?lat=${lat}&lng=${lng}`);
          if (r.ok) place = await r.json();
        } catch {
          // keep coordinates only
        }
        resolve({
          lat,
          lng,
          city: place.city || null,
          country: place.country || null,
          label: place.label || "Your current area",
          source: "gps",
        });
      },
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. Choose your location below."
            : err.code === err.TIMEOUT
              ? "Getting your location took too long. Choose your location below."
              : "Your location is unavailable right now. Choose your location below.";
        reject(new Error(msg));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 },
    );
  });
}

function GoogleSearch({ onSelect, bias }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const session = useRef(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setItems([]);
      return;
    }
    if (!session.current) session.current = crypto.randomUUID();
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q, session: session.current });
        if (bias?.lat != null) params.set("lat", bias.lat), params.set("lng", bias.lng);
        const r = await fetch(`/api/location/autocomplete?${params}`, { signal: ctrl.signal });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Search failed");
        setItems(data.suggestions);
        setActive(-1);
        setError(null);
      } catch (e) {
        if (e.name !== "AbortError") setError(e.message);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, bias?.lat, bias?.lng]);

  async function choose(item) {
    setBusy(true);
    try {
      const r = await fetch(`/api/location/place?id=${encodeURIComponent(item.placeId)}&session=${session.current}`);
      const p = await r.json();
      if (!r.ok || p.lat == null) throw new Error(p.error || "Could not load that place");
      session.current = null; // a details call ends the billing session
      onSelect({
        lat: roundCoord(p.lat),
        lng: roundCoord(p.lng),
        city: p.city,
        country: p.country,
        label: [item.main, item.secondary].filter(Boolean).join(", "),
        source: "search",
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <label htmlFor="place-search" className="mb-1 block text-sm font-medium text-slate-700">
        Search for a city, area, address or landmark
      </label>
      <input
        id="place-search"
        role="combobox"
        aria-expanded={items.length > 0}
        aria-controls="place-results"
        aria-activedescendant={active >= 0 ? `place-${active}` : undefined}
        autoComplete="off"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setActive((a) => Math.min(items.length - 1, a + 1)), e.preventDefault();
          if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1)), e.preventDefault();
          if (e.key === "Enter" && items[active >= 0 ? active : 0]) choose(items[active >= 0 ? active : 0]), e.preventDefault();
        }}
        placeholder="e.g. Gulshan 2, Dhaka"
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
      />
      {busy && <p className="mt-2 text-sm text-slate-500">Loading place…</p>}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      {items.length > 0 && (
        <ul id="place-results" role="listbox" className="mt-2 max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {items.map((it, i) => (
            <li
              key={it.placeId}
              id={`place-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(it)}
              className={`cursor-pointer px-4 py-2.5 ${i === active ? "bg-emerald-50" : "hover:bg-slate-50"}`}
            >
              <div className="font-medium text-slate-900">{it.main}</div>
              {it.secondary && <div className="text-sm text-slate-500">{it.secondary}</div>}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-slate-400">Location search powered by Google</p>
    </div>
  );
}

function ManualForm({ onSelect, initial }) {
  const countries = useMemo(countryOptions, []);
  const [city, setCity] = useState(initial?.city || "");
  const [country, setCountry] = useState(initial?.country || guessCountry());
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!city.trim() || !country) return;
        const name = countries.find((c) => c.code === country)?.name || country;
        onSelect({ lat: null, lng: null, city: city.trim(), country, label: `${city.trim()}, ${name}`, source: "manual" });
      }}
      className="space-y-3"
    >
      <div>
        <label htmlFor="manual-city" className="mb-1 block text-sm font-medium text-slate-700">City</label>
        <input
          id="manual-city"
          required
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="e.g. Dhaka"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />
      </div>
      <div>
        <label htmlFor="manual-country" className="mb-1 block text-sm font-medium text-slate-700">Country</label>
        <select
          id="manual-country"
          required
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600"
        >
          <option value="">Choose a country</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
      </div>
      <button type="submit" className="w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800">
        Use this city
      </button>
      <p className="text-xs text-slate-500">
        Address search is not configured on this server, so offers are matched by city and country. Use your current location for distance-based results.
      </p>
    </form>
  );
}

export default function LocationPicker({ open, onClose, onSelect, current, message }) {
  const [googleOn, setGoogleOn] = useState(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    fetch("/api/location/config")
      .then((r) => r.json())
      .then((d) => setGoogleOn(Boolean(d.google)))
      .catch(() => setGoogleOn(false));
  }, []);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => setError(message || null), [message]);

  async function useMyLocation() {
    setLocating(true);
    setError(null);
    try {
      onSelect(await requestBrowserLocation());
    } catch (e) {
      setError(e.message);
    } finally {
      setLocating(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && onClose()}
      aria-labelledby="loc-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl p-0 shadow-2xl backdrop:bg-slate-900/50"
    >
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="loc-title" className="text-lg font-semibold text-slate-900">Choose your location</h2>
            {current?.label && <p className="text-sm text-slate-500">Current: {current.label}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 text-2xl leading-none text-slate-500 hover:bg-slate-100">
            ×
          </button>
        </div>

        {error && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="status">{error}</p>}

        <div className="rounded-xl bg-slate-50 p-4">
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="w-full rounded-xl border border-emerald-700 bg-white px-4 py-3 font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-60"
          >
            {locating ? "Finding your location…" : "📍 Use my current location"}
          </button>
          <p className="mt-2 text-xs text-slate-500">
            We use your location only to find offers near you. It is rounded to about 100 m, kept in this browser, and never stored on our servers.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
          <span className="h-px flex-1 bg-slate-200" /> or <span className="h-px flex-1 bg-slate-200" />
        </div>

        {googleOn === null ? (
          <div className="skeleton h-12 rounded-xl" />
        ) : googleOn ? (
          <GoogleSearch onSelect={onSelect} bias={current} />
        ) : (
          <ManualForm onSelect={onSelect} initial={current} />
        )}
      </div>
    </dialog>
  );
}
