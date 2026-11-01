"use client";

import { useId, useState } from "react";
import { CATEGORIES, categoryLabel } from "@/lib/constants";

// Wider than this is a logo or banner, not a photo.
const LOGO_ASPECT = 2.6;

function LogoMark({ className }) {
  const id = useId();
  return (
    <svg aria-hidden="true" viewBox="0 0 64 64" className={`drop-shadow-[0_6px_14px_rgb(5_150_105/0.3)] ${className}`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#10b981" />
          <stop offset="1" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${id})`} />
      <circle cx="22" cy="22" r="6" fill="none" stroke="#fff" strokeWidth="5" />
      <circle cx="42" cy="42" r="6" fill="none" stroke="#fff" strokeWidth="5" />
      <path d="M44 18 20 46" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Stands in for an offer without a picture (or whose picture failed to load):
 * our logo, who the offer is from, and what kind of offer it is.
 */
export function OfferPlaceholder({ offer, large = false }) {
  const name = offer.businessName || offer.brandName || offer.sourceName;
  const category = CATEGORIES.find((c) => c.id === offer.primaryCategory);
  return (
    <div
      role="img"
      aria-label={[name, categoryLabel(offer.primaryCategory), "offer"].filter(Boolean).join(" ")}
      className={`offer-placeholder absolute inset-0 flex flex-col items-center justify-center text-center ${large ? "gap-3 px-8" : "gap-1.5 px-4 pb-5"}`}
    >
      <LogoMark className={large ? "h-16 w-16" : "h-10 w-10"} />
      {name && <p className={`max-w-full truncate font-bold tracking-tight text-slate-800 ${large ? "text-2xl" : "text-sm"}`}>{name}</p>}
      {category && (
        <p className={`inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 font-medium text-emerald-800 ${large ? "text-sm" : "text-[11px]"}`}>
          <span aria-hidden="true">{category.icon}</span>
          {category.label}
        </p>
      )}
    </div>
  );
}

/**
 * The offer's picture, or the placeholder when it has none or it fails to
 * load. "card": the picture whole over a blurred, enlarged copy of itself
 * that fills the frame (wide logos sit on plain white). "hero": the picture
 * whole on white, for the offer page. Fills its (positioned) parent.
 */
export default function OfferPicture({ offer, variant = "card", className = "" }) {
  const [failed, setFailed] = useState(false);
  const [logo, setLogo] = useState(false);
  if (!offer.imageUrl || failed) return <OfferPlaceholder offer={offer} large={variant === "hero"} />;

  // Source images are external; plain lazy imgs avoid proxying them through our server.
  const img = { src: offer.imageUrl, alt: "", loading: "lazy", decoding: "async", referrerPolicy: "no-referrer", draggable: false };
  return (
    <div className={`absolute inset-0 bg-[#fff] ${className}`}>
      {variant === "card" && !logo && <img {...img} aria-hidden="true" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-60 blur-xl" />}
      <img
        {...img}
        // A server-rendered picture can fail before this code runs: check once on mount.
        ref={(el) => {
          if (el?.complete && el.naturalWidth === 0) setFailed(true);
        }}
        onError={() => setFailed(true)}
        onLoad={(e) => setLogo(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight > LOGO_ASPECT)}
        className={`relative h-full w-full object-contain ${logo ? "p-5" : ""}`}
      />
    </div>
  );
}
