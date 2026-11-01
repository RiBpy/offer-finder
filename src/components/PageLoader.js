"use client";

import { useEffect, useRef, useState } from "react";

const TICK_MS = 30;
const LEAVE_MS = 900; // the bike riding off to the right
const FADE_MS = 1300; // contents fade, then the screen dissolves (see .page-loader)

// A bicycle pulling an iron ball on a chain; the ball carries the percentage.
// One drawing (200 × 64) so the ball, chain and bike always line up.
function Rig({ pct }) {
  return (
    <svg viewBox="0 0 200 64" className="h-16 w-[200px] overflow-visible" aria-hidden="true">
      <defs>
        <radialGradient id="loader-iron" cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#94a3b8" />
          <stop offset="0.45" stopColor="#475569" />
          <stop offset="1" stopColor="#0f172a" />
        </radialGradient>
      </defs>

      {/* Chain: two dashed strokes offset by half a link read as interlocking links. */}
      <path d="M45 40 Q 82 50 120 44" fill="none" stroke="#64748b" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="5 3" />
      <path d="M45 40 Q 82 50 120 44" fill="none" stroke="#cbd5e1" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="5 3" strokeDashoffset="4" />

      {/* Iron ball, rolling under its percentage. */}
      <circle cx="24" cy="41" r="22" fill="url(#loader-iron)" />
      <g className="loader-roll">
        <path d="M8 34 Q 24 28 40 34 M8 48 Q 24 54 40 48" fill="none" stroke="#fff" strokeOpacity="0.18" strokeWidth="1.5" />
      </g>
      <circle cx="17" cy="33" r="5" fill="#fff" fillOpacity="0.18" />
      <circle cx="45" cy="40" r="3" fill="none" stroke="#64748b" strokeWidth="2" />
      <text x="24" y="45.5" textAnchor="middle" fontSize="12.5" fontWeight="800" fill="#fff" style={{ fontVariantNumeric: "tabular-nums" }}>
        {Math.round(pct)}%
      </text>

      {/* Bicycle and rider, bobbing a little as they pedal. */}
      <g className="loader-bike">
        {[124, 176].map((cx) => (
          <g key={cx}>
            <circle cx={cx} cy="49" r="13" fill="none" className="stroke-slate-700" strokeWidth="2.5" />
            <g className="loader-wheel">
              <path d={`M${cx - 13} 49h26M${cx} 36v26M${cx - 9} 40l18 18M${cx + 9} 40l-18 18`} className="stroke-slate-400" strokeWidth="1" />
            </g>
            <circle cx={cx} cy="49" r="2" className="fill-slate-700" />
          </g>
        ))}
        <path d="M124 49 140 31 150 49Z M140 31 168 29 150 49 M168 29 176 49 M136 27h9 M168 29l3-7h6" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <g className="stroke-slate-800" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M141 26 158 13" />
          <path d="M157 14 172 22" />
          <path className="loader-leg" d="M141 26 153 34 150 49" />
        </g>
        <circle cx="162" cy="7" r="5.5" className="fill-slate-800" />
        <path d="M156 5.5a6 6 0 0 1 11.5-1" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/**
 * First-visit screen: the logo, and a bike pulling the load percentage along a
 * track. `progress` (0–1) is how much of the page has loaded; a slow creep keeps
 * it moving while one step takes long. When `done`, it runs to 100%, the bike
 * pulls the ball off to the right, and the screen fades. Later loads (a filter
 * choice) show card skeletons instead.
 */
export default function PageLoader({ progress = 0, done }) {
  const [pct, setPct] = useState(0);
  const [phase, setPhase] = useState("loading"); // loading → leaving → fading → gone
  const goal = useRef(0);
  goal.current = done ? 100 : Math.min(94, progress * 100);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      setPct((p) => {
        const creep = Math.min(94, 70 * (1 - Math.exp(-(Date.now() - start) / 5000)));
        const target = goal.current === 100 ? 100 : Math.max(goal.current, creep);
        // A hidden tab has nothing to watch: finish at once.
        if (target === 100 && document.hidden) return 100;
        const next = Math.max(p, p + (target - p) * 0.12);
        return target - next < 0.5 ? target : next;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (phase === "loading" && done && pct >= 100) setPhase("leaving");
    if (phase === "leaving") {
      const t = setTimeout(() => setPhase("fading"), LEAVE_MS);
      return () => clearTimeout(t);
    }
    if (phase === "fading") {
      const t = setTimeout(() => setPhase("gone"), FADE_MS);
      return () => clearTimeout(t);
    }
  }, [phase, done, pct]);

  // Once it starts fading the page beneath can be used; it stays only to finish fading.
  if (phase === "gone") return null;
  return (
    <div
      className={`page-loader ${phase === "fading" ? "is-done" : ""}`}
      role="progressbar"
      aria-label="Loading today’s offers"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <div className="page-loader-logo flex items-center gap-3">
        <svg aria-hidden="true" viewBox="0 0 64 64" className="h-11 w-11 drop-shadow-[0_8px_18px_rgb(5_150_105/0.35)]">
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

      <div className="loader-track" style={{ "--p": pct / 100 }}>
        <span className="loader-ground" />
        <span className="loader-trail" />
        <div className={`loader-rig ${phase === "loading" ? "" : "is-leaving"}`}>
          <Rig pct={pct} />
        </div>
      </div>
      <p className="text-sm text-slate-500">Finding today’s offers…</p>
    </div>
  );
}
