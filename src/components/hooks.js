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

/**
 * Lets a mouse drag a horizontally scrolling row (touch already scrolls
 * natively). Scroll snapping is paused while dragging, and the click that ends
 * a drag is swallowed so it does not open a card or toggle a chip.
 */
export function useDragScroll() {
  // A callback ref (with React 19 cleanup) so rows that mount later still attach.
  return useCallback((el) => {
    if (!el) return;
    let startX = 0;
    let startLeft = 0;
    let pointerId = null;
    let dragged = false;

    const down = (e) => {
      if (e.pointerType !== "mouse" || e.button !== 0 || el.scrollWidth <= el.clientWidth) return;
      pointerId = e.pointerId;
      startX = e.clientX;
      startLeft = el.scrollLeft;
      dragged = false;
    };
    const move = (e) => {
      if (e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      if (!dragged && Math.abs(dx) < 5) return;
      if (!dragged) {
        dragged = true;
        el.setPointerCapture(pointerId);
        el.style.scrollSnapType = "none";
        el.style.cursor = "grabbing";
        el.style.userSelect = "none";
      }
      el.scrollLeft = startLeft - dx;
    };
    const up = (e) => {
      if (e.pointerId !== pointerId) return;
      pointerId = null;
      el.style.cursor = "";
      el.style.userSelect = "";
      if (dragged) {
        // Restore snapping from the current position so the row settles on a card.
        el.style.scrollSnapType = "";
      }
    };
    const click = (e) => {
      if (dragged) {
        e.preventDefault();
        e.stopPropagation();
        dragged = false;
      }
    };
    const dragStart = (e) => e.preventDefault(); // links and images would start a native drag

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("click", click, true);
    el.addEventListener("dragstart", dragStart);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("click", click, true);
      el.removeEventListener("dragstart", dragStart);
    };
  }, []);
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
