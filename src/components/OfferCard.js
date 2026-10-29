"use client";

import Link from "next/link";
import { categoryLabel, sourceTypeLabel } from "@/lib/constants";
import { AVAILABILITY_LABELS, discountLabel, formatMoney, timeAgo, validityLabel } from "@/lib/format";
import { formatDistance } from "@/lib/geo";
import { useBookmarks } from "./hooks";

const TONES = {
  ok: "bg-emerald-50 text-emerald-800",
  urgent: "bg-amber-50 text-amber-800",
  info: "bg-sky-50 text-sky-800",
  muted: "bg-slate-100 text-slate-600",
};

export function BookmarkButton({ id, title, className = "" }) {
  const { has, toggle } = useBookmarks();
  const saved = has(id);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(id);
      }}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from saved offers` : `Save ${title}`}
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-200 bg-white/95 text-base shadow-sm transition hover:scale-110 hover:bg-slate-50 active:scale-90 ${className}`}
    >
      <span aria-hidden="true">{saved ? "★" : "☆"}</span>
    </button>
  );
}

export function StatusPill({ status }) {
  if (status === "active") return null;
  const label = { unverified: "Unverified", expired: "Expired", unavailable: "Unavailable" }[status] || status;
  return <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-white dark:text-slate-50">{label}</span>;
}

/** `index` staggers the card's entrance animation within the batch it arrived in. */
export default function OfferCard({ offer, compact = false, index = 0 }) {
  const v = validityLabel(offer);
  const discount = discountLabel(offer);
  const distance = formatDistance(offer.distanceKm);
  const where =
    offer.scope === "online"
      ? null
      : offer.scope === "national"
        ? `Nationwide${offer.country ? ` · ${offer.country}` : ""}`
        : offer.scope === "city"
          ? offer.city
          : offer.eligibleLocations?.length > 1
            ? `${offer.eligibleLocations.length} branches`
            : offer.eligibleLocations?.[0]?.name || offer.address || offer.city;

  return (
    <article
      style={{ "--i": index }}
      className={`card-in group relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-emerald-600/40 hover:shadow-lg ${compact ? "w-52 shrink-0 snap-start sm:w-56" : ""}`}
    >
      <div className="relative aspect-[2/1] overflow-hidden bg-slate-100">
        {offer.imageUrl ? (
          // Source images are external and vary in size; a plain lazy img avoids
          // proxying third-party images through our server.
          <img src={offer.imageUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" draggable={false} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="grid h-full place-items-center bg-gradient-to-br from-emerald-50 to-slate-100 text-2xl font-semibold text-emerald-800/70">
            {(offer.brandName || offer.businessName || offer.title).slice(0, 1).toUpperCase()}
          </div>
        )}
        {discount && (
          <span className="absolute left-2 top-2 max-w-[70%] truncate rounded-md bg-emerald-700 px-2 py-0.5 text-xs font-semibold text-white shadow">{discount}</span>
        )}
        <BookmarkButton id={offer.id} title={offer.title} className="absolute right-2 top-2 z-10" />
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex flex-wrap items-center gap-1 text-[11px]">
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">{categoryLabel(offer.primaryCategory)}</span>
          {!compact && offer.isBrandOffer && <span className="rounded-full bg-violet-50 px-1.5 py-0.5 font-medium text-violet-800">Brand offer</span>}
          {!compact && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-slate-600">{AVAILABILITY_LABELS[offer.availabilityType]}</span>}
          <StatusPill status={offer.validationStatus} />
        </div>

        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">
          <Link href={`/offers/${offer.slug}`} draggable={false} className="after:absolute after:inset-0 focus-visible:outline-none">
            {offer.title}
          </Link>
        </h3>
        {(offer.brandName || offer.businessName) && (
          <p className="truncate text-xs text-slate-600">{[offer.brandName, offer.businessName].filter(Boolean).join(" · ")}</p>
        )}
        {offer.originalPrice != null && offer.discountedPrice != null && (
          <p className="text-xs">
            <span className="mr-2 text-slate-400 line-through">{formatMoney(offer.originalPrice, offer.currency)}</span>
            <span className="font-semibold text-slate-900">{formatMoney(offer.discountedPrice, offer.currency)}</span>
          </p>
        )}

        <div className="mt-auto flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-[11px] text-slate-600">
          <span className={`rounded px-1.5 py-0.5 font-medium ${TONES[v.tone]}`}>{v.text}</span>
          {distance && <span>📍 {distance}</span>}
          {where && <span className="min-w-0 truncate">{where}</span>}
        </div>
        <div className="flex min-w-0 items-center justify-between gap-2 border-t border-slate-100 pt-1.5 text-[11px] text-slate-500">
          <span className="min-w-0 truncate">
            {sourceTypeLabel(offer.sourceType)}
            {offer.lastVerifiedAt && <> · {timeAgo(offer.lastVerifiedAt)}</>}
          </span>
          <a
            href={offer.sourceUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            draggable={false}
            className="relative z-10 shrink-0 font-medium text-emerald-700 hover:underline"
          >
            Source ↗
          </a>
        </div>
      </div>
    </article>
  );
}

// Mirrors the real card's layout so nothing jumps when offers arrive.
export function OfferCardSkeleton({ compact = false, index = 0 }) {
  return (
    <div
      className={`skeleton-card flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${compact ? "w-52 shrink-0 sm:w-56" : ""}`}
      style={{ "--i": index }}
      aria-hidden="true"
    >
      <div className="skeleton relative aspect-[2/1]">
        <div className="absolute left-2 top-2 h-5 w-14 rounded-md bg-white/70" />
        <div className="absolute right-2 top-2 h-8 w-8 rounded-full bg-white/70" />
        <svg viewBox="0 0 24 24" className="absolute inset-0 m-auto h-8 w-8 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z" strokeLinejoin="round" />
          <circle cx="7.5" cy="7.5" r="1.5" />
        </svg>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex gap-1">
          <div className="skeleton h-4 w-16 rounded-full" />
          {!compact && <div className="skeleton h-4 w-12 rounded-full" />}
        </div>
        <div className="space-y-1.5">
          <div className="skeleton h-3.5 w-full rounded" />
          <div className="skeleton h-3.5 w-4/5 rounded" />
        </div>
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="mt-auto flex gap-2 pt-1">
          <div className="skeleton h-4 w-20 rounded" />
          <div className="skeleton h-4 w-12 rounded" />
        </div>
        <div className="flex justify-between border-t border-slate-100 pt-1.5">
          <div className="skeleton h-3 w-24 rounded" />
          <div className="skeleton h-3 w-10 rounded" />
        </div>
      </div>
    </div>
  );
}
