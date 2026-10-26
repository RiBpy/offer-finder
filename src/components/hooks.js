"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

// localStorage can be unavailable (private mode, blocked storage), so every
// access is guarded and the app keeps working without it.
function read(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent("of-storage", { detail: key }));
}

export function useStoredState(key, fallback) {
  const [value, setValue] = useState(fallback);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setValue(read(key, fallback));
    setLoaded(true);
    const onChange = (e) => {
      if (!e.detail || e.detail === key || e.key === key) setValue(read(key, fallback));
    };
    window.addEventListener("of-storage", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("of-storage", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [key]);
  const set = useCallback(
    (v) => {
      const next = typeof v === "function" ? v(read(key, fallback)) : v;
      write(key, next);
      setValue(next);
    },
    [key],
  );
  return [value, set, loaded];
}

const BOOKMARKS = "of.bookmarks";

export function useBookmarks() {
  const [ids, setIds, loaded] = useStoredState(BOOKMARKS, []);
  const toggle = useCallback(
    (id) => setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur].slice(0, 100))),
    [setIds],
  );
  return { ids, has: (id) => ids.includes(id), toggle, loaded };
}

const subscribeNoop = () => () => {};

// Browser timezone and today's date, computed on the client only.
export function useToday() {
  const tz = useSyncExternalStore(subscribeNoop, () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", () => null);
  const [date, setDate] = useState(null);
  useEffect(() => {
    if (!tz) return;
    const compute = () => setDate(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()));
    compute();
    // Roll over at midnight if the tab stays open.
    const id = setInterval(compute, 60_000);
    return () => clearInterval(id);
  }, [tz]);
  return { tz, date };
}
