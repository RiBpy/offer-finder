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
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-200 bg-white/95 text-lg shadow-sm hover:bg-slate-50 ${className}`}
    >
      <span aria-hidden="true">{saved ? "★" : "☆"}</span>
    </button>
  );
}

export function StatusPill({ status }) {
  if (status === "active") return null;
  const label = { unverified: "Unverified", expired: "Expired", unavailable: "Unavailable" }[status] || status;
  return <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-white">{label}</span>;
}

export default function OfferCard({ offer, compact = false }) {
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
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md ${compact ? "w-72 shrink-0 snap-start" : ""}`}
    >
      <div className="relative aspect-[16/9] bg-slate-100">
        {offer.imageUrl ? (
          // Source images are external and vary in size; a plain lazy img avoids
          // proxying third-party images through our server.
          <img src={offer.imageUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center bg-gradient-to-br from-emerald-50 to-slate-100 text-3xl font-semibold text-emerald-800/70">
            {(offer.brandName || offer.businessName || offer.title).slice(0, 1).toUpperCase()}
          </div>
        )}
        {discount && (
          <span className="absolute left-3 top-3 rounded-lg bg-emerald-700 px-2.5 py-1 text-sm font-semibold text-white shadow">{discount}</span>
        )}
        <BookmarkButton id={offer.id} title={offer.title} className="absolute right-3 top-3 z-10" />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">{categoryLabel(offer.primaryCategory)}</span>
          {offer.isBrandOffer && <span className="rounded-full bg-violet-50 px-2 py-0.5 font-medium text-violet-800">Brand offer</span>}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{AVAILABILITY_LABELS[offer.availabilityType]}</span>
          <StatusPill status={offer.validationStatus} />
        </div>

        <h3 className="line-clamp-2 font-semibold leading-snug text-slate-900">
          <Link href={`/offers/${offer.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {offer.title}
          </Link>
        </h3>
        {(offer.brandName || offer.businessName) && (
          <p className="text-sm text-slate-600">{[offer.brandName, offer.businessName].filter(Boolean).join(" · ")}</p>
        )}
        {offer.originalPrice != null && offer.discountedPrice != null && (
          <p className="text-sm">
            <span className="mr-2 text-slate-400 line-through">{formatMoney(offer.originalPrice, offer.currency)}</span>
            <span className="font-semibold text-slate-900">{formatMoney(offer.discountedPrice, offer.currency)}</span>
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-slate-600">
          <span className={`rounded-md px-2 py-0.5 font-medium ${TONES[v.tone]}`}>{v.text}</span>
          {distance && <span>📍 {distance}</span>}
          {where && <span className="truncate">{where}</span>}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
          <span>
            {sourceTypeLabel(offer.sourceType)}
            {offer.lastVerifiedAt && <> · verified {timeAgo(offer.lastVerifiedAt)}</>}
          </span>
          <a
            href={offer.sourceUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="relative z-10 font-medium text-emerald-700 hover:underline"
          >
            View original ↗
          </a>
        </div>
      </div>
    </article>
  );
}

export function OfferCardSkeleton({ compact = false }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white ${compact ? "w-72 shrink-0" : ""}`} aria-hidden="true">
      <div className="skeleton aspect-[16/9]" />
      <div className="space-y-2 p-4">
        <div className="skeleton h-4 w-24 rounded" />
        <div className="skeleton h-5 w-full rounded" />
        <div className="skeleton h-4 w-2/3 rounded" />
        <div className="skeleton h-4 w-1/2 rounded" />
      </div>
    </div>
  );
}
