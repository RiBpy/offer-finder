"use client";

import Link from "next/link";
import { CATEGORIES, categoryLabel, sourceTypeLabel } from "@/lib/constants";
import { AVAILABILITY_LABELS, discountLabel, formatMoney, timeAgo, validityLabel } from "@/lib/format";
import { formatDistance } from "@/lib/geo";
import { useBookmarks } from "./hooks";
import OfferPicture from "./OfferPicture";

const TONES = {
  ok: "bg-brand-50 text-brand-ink-strong",
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

const Icon = ({ d, className = "h-3.5 w-3.5" }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const CLOCK = "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z";
const PIN = "M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z";
const CHECK = "m5 12.5 4.5 4.5L19 7.5";

const chip = "inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-medium text-slate-700";

/** `index` staggers the card's entrance animation within the batch it arrived in. */
export default function OfferCard({ offer, compact = false, index = 0 }) {
  const v = validityLabel(offer);
  const discount = discountLabel(offer);
  const distance = formatDistance(offer.distanceKm);
  const category = CATEGORIES.find((c) => c.id === offer.primaryCategory);
  const seller = [...new Set([offer.brandName, offer.businessName].filter(Boolean))].join(" · ");
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
      className={`offer-card card-in relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5 ${compact ? "w-56 shrink-0 snap-start sm:w-60" : ""}`}
    >
      {/* Images sit on white in both themes: many are transparent logos with dark lettering. */}
      <div className="relative aspect-[16/9] overflow-hidden bg-[#fff]">
        <div className="offer-zoom absolute inset-0">
          <OfferPicture offer={offer} />
        </div>
        {discount && (
          <span className="absolute bottom-2 left-2 max-w-[80%] truncate rounded-md bg-gradient-to-r from-brand-600 to-brand-accent px-2.5 py-1 text-xs font-extrabold uppercase tracking-tight text-white shadow-lg shadow-brand-900/25 sm:text-[13px]">
            {discount}
          </span>
        )}
        {offer.validationStatus !== "active" && (
          <span className="absolute bottom-2 right-2">
            <StatusPill status={offer.validationStatus} />
          </span>
        )}
        <BookmarkButton id={offer.id} title={offer.title} className="absolute right-2 top-2 z-10" />
      </div>

      <div className="relative flex flex-1 flex-col gap-2 p-3">
        {seller && <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-brand-ink">{seller}</p>}
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 sm:text-[15px]">
          <Link href={`/offers/${offer.slug}`} draggable={false} className="after:absolute after:inset-0 after:z-[1] focus-visible:outline-none">
            {offer.title}
          </Link>
        </h3>

        {offer.originalPrice != null && offer.discountedPrice != null && (
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-bold text-brand-ink">{formatMoney(offer.discountedPrice, offer.currency)}</span>
            <span className="text-xs text-slate-400 line-through">{formatMoney(offer.originalPrice, offer.currency)}</span>
          </p>
        )}

        <div className="flex flex-wrap items-center gap-1 text-[11px]">
          <span className={chip}>
            {category?.icon && <span aria-hidden="true">{category.icon}</span>}
            {categoryLabel(offer.primaryCategory)}
          </span>
          {!compact && <span className={chip}>{AVAILABILITY_LABELS[offer.availabilityType]}</span>}
          {!compact && offer.isBrandOffer && <span className="rounded-md bg-violet-50 px-1.5 py-0.5 font-medium text-violet-800">Brand offer</span>}
        </div>

        <div className="mt-auto space-y-2 border-t border-slate-100 pt-2 text-[11px]">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-slate-600">
            <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold ${TONES[v.tone]}`}>
              <Icon d={CLOCK} className="h-3 w-3" />
              {v.text}
            </span>
            {(distance || where) && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <Icon d={PIN} className="h-3 w-3 text-slate-400" />
                <span className="truncate">{[distance, where].filter(Boolean).join(" · ")}</span>
              </span>
            )}
          </div>
          <div className="flex min-w-0 items-center justify-between gap-2 text-slate-500">
            <span className="inline-flex min-w-0 items-center gap-1">
              <Icon d={CHECK} className="h-3 w-3 text-brand-ink" />
              <span className="truncate">
                {sourceTypeLabel(offer.sourceType)}
                {offer.lastVerifiedAt && <> · {timeAgo(offer.lastVerifiedAt)}</>}
              </span>
            </span>
            <a
              href={offer.sourceUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              draggable={false}
              className="relative z-10 shrink-0 rounded-md border border-brand-600/30 px-2 py-0.5 font-semibold text-brand-ink transition-colors hover:bg-brand-600 hover:text-white"
            >
              Source ↗
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}

// Mirrors the real card's layout so nothing jumps when offers arrive.
export function OfferCardSkeleton({ compact = false, index = 0 }) {
  return (
    <div
      className={`skeleton-card flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5 ${compact ? "w-56 shrink-0 sm:w-60" : ""}`}
      style={{ "--i": index }}
      aria-hidden="true"
    >
      <div className="skeleton relative aspect-[16/9]">
        <div className="absolute bottom-2 left-2 h-6 w-16 rounded-md bg-white/70" />
        <div className="absolute right-2 top-2 h-8 w-8 rounded-full bg-white/70" />
        <svg viewBox="0 0 24 24" className="absolute inset-0 m-auto h-8 w-8 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z" strokeLinejoin="round" />
          <circle cx="7.5" cy="7.5" r="1.5" />
        </svg>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="skeleton h-3 w-2/5 rounded" />
        <div className="space-y-1.5">
          <div className="skeleton h-3.5 w-full rounded" />
          <div className="skeleton h-3.5 w-4/5 rounded" />
        </div>
        <div className="flex gap-1">
          <div className="skeleton h-4 w-20 rounded-md" />
          {!compact && <div className="skeleton h-4 w-14 rounded-md" />}
        </div>
        <div className="mt-auto space-y-2 border-t border-slate-100 pt-2">
          <div className="flex gap-2">
            <div className="skeleton h-4 w-24 rounded-md" />
            <div className="skeleton h-4 w-12 rounded-md" />
          </div>
          <div className="flex justify-between">
            <div className="skeleton h-3 w-24 rounded" />
            <div className="skeleton h-4 w-14 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
