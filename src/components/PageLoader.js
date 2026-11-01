"use client";

import { useEffect, useState } from "react";

/**
 * First-visit screen: the logo breathing on a plain page until the first
 * offers have arrived, then a fade. Later loads (a filter choice) show card
 * skeletons instead.
 */
export default function PageLoader({ done }) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setGone(true), 450);
    return () => clearTimeout(t);
  }, [done]);
  if (gone) return null;
  return (
    <div className={`page-loader ${done ? "is-done" : ""}`} role="status" aria-live="polite">
      <div className="page-loader-logo flex flex-col items-center gap-4">
        <svg aria-hidden="true" viewBox="0 0 64 64" className="h-16 w-16 drop-shadow-[0_10px_24px_rgb(5_150_105/0.35)]">
          <defs>
            <linearGradient id="loader-tile" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#10b981" />
              <stop offset="1" stopColor="#0d9488" />
            </linearGradient>
          </defs>
          <rect width="64" height="64" rx="16" fill="url(#loader-tile)" />
          <circle cx="22" cy="22" r="6" fill="none" stroke="#fff" strokeWidth="5" />
          <circle cx="42" cy="42" r="6" fill="none" stroke="#fff" strokeWidth="5" />
          <path d="M44 18 20 46" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" />
        </svg>
        <span className="text-2xl font-semibold tracking-tight text-slate-900">
          Offer<span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">Finder</span>
        </span>
      </div>
      <span className="page-loader-bar" aria-hidden="true" />
      <span className="sr-only">Loading today’s offers…</span>
    </div>
  );
}
