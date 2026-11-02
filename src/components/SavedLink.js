"use client";

import Link from "next/link";
import { useBookmarks } from "./hooks";

/**
 * The header's way to the saved offers: a star with how many are saved, and
 * the word "Saved" where there is room. Shaped like the theme button beside it.
 */
export default function SavedLink({ active = false, className = "" }) {
  const { ids, loaded } = useBookmarks();
  const count = loaded ? ids.length : 0;
  return (
    <Link
      href="/saved"
      aria-label={count ? `Saved offers (${count})` : "Saved offers"}
      aria-current={active ? "page" : undefined}
      className={`relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium transition hover:border-brand-600/50 hover:text-brand-ink active:scale-95 ${active ? "border-brand-600/50 bg-brand-50 text-brand-ink" : "border-slate-200 bg-white text-slate-700"} ${className}`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />
      </svg>
      <span className="hidden sm:inline">Saved</span>
      {count > 0 && (
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-700 px-1 text-[11px] font-semibold text-white">{count}</span>
      )}
    </Link>
  );
}
