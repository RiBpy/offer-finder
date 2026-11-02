"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import OfferPicture from "./OfferPicture";
import { discountLabel, validityLabel } from "@/lib/format";
import { categoryLabel } from "@/lib/constants";

const SIDE = 2; // cards shown on each side of the centre one
const SPACING = 0.78; // distance between neighbouring cards, in card widths

function Card({ offer, centre }) {
  const discount = discountLabel(offer);
  const v = validityLabel(offer);
  const seller = offer.businessName || offer.brandName || offer.sourceName;
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
      <div className="relative aspect-[4/3] shrink-0 overflow-hidden">
        <OfferPicture offer={offer} />
        {discount && (
          <span className="absolute left-2.5 top-2.5 max-w-[80%] truncate rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-ink shadow-sm">
            {discount}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        {seller && <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-brand-ink">{seller}</p>}
        <p className="line-clamp-2 min-h-[2.5rem] text-[15px] font-semibold leading-snug text-slate-900">{offer.title}</p>
        <p className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
          <span className="truncate">{categoryLabel(offer.primaryCategory)}</span>
          <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">{v.text}</span>
        </p>
        <span
          aria-hidden="true"
          className={`mt-1.5 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${centre ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-500"}`}
        >
          View offer →
        </span>
      </div>
    </div>
  );
}

/**
 * "You may also like" as a coverflow row: the chosen card big in the centre,
 * smaller and fainter cards to each side. It spins round endlessly: drag or
 * swipe, the side arrows, the dots, or the arrow keys. A tap on a side card
 * spins it to the centre; a tap on the centre card opens that offer.
 */
export default function RelatedCarousel({ offers }) {
  const n = offers.length;
  const [active, setActive] = useState(0);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [cardW, setCardW] = useState(260);
  const track = useRef(null);
  const startX = useRef(0);
  const moved = useRef(false);
  const lastK = useRef({}); // each card's place last time, to spot ones that wrap round

  // Card size follows the row's width.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      setCardW(w < 480 ? Math.round(Math.min(240, w * 0.64)) : w < 900 ? 240 : 270);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const go = useCallback((step) => setActive((a) => (((a + step) % n) + n) % n), [n]);
  const step = cardW * SPACING;

  // A card's place relative to the centre: 0 is the centre, -1 left of it, 1 right, …
  const placeOf = (i) => {
    let k = (((i - active) % n) + n) % n;
    if (k > n / 2) k -= n;
    return k;
  };
  const places = offers.map((_, i) => placeOf(i));

  // Remember each card's place after every render, to spot the ones that wrap round.
  useEffect(() => {
    lastK.current = Object.fromEntries(offers.map((o, i) => [o.id, places[i]]));
  });

  if (!n) return null;

  const onPointerDown = (e) => {
    moved.current = false;
    startX.current = e.clientX;
    setDragging(true);
  };
  const onPointerMove = (e) => {
    if (!dragging) return;
    const d = e.clientX - startX.current;
    if (!moved.current && Math.abs(d) > 6) {
      moved.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (moved.current) setDrag(d);
  };
  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    let steps = Math.round(-drag / step);
    if (!steps && Math.abs(drag) > 40) steps = -Math.sign(drag);
    if (steps) go(steps);
    setDrag(0);
  };

  const shift = drag / step; // the drag, in places
  // Cards that wrapped round from one end to the other jump there without sliding across.
  const jumped = places.map((k, i) => {
    const prev = lastK.current[offers[i].id];
    return prev != null && Math.abs(prev - k) > 1.5;
  });

  return (
    <div
      className="relative"
      role="group"
      aria-roledescription="carousel"
      aria-label="You may also like"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
    >
      <div
        ref={track}
        className="related-track relative mx-auto w-full touch-pan-y select-none overflow-hidden py-4"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* An invisible copy of a card gives the row its height. */}
        <div aria-hidden="true" className="invisible mx-auto" style={{ width: cardW }}>
          <Card offer={offers[active]} centre />
        </div>

        {offers.map((offer, i) => {
          const k = places[i] + shift;
          const d = Math.abs(k);
          const x = Math.sign(k) * (Math.min(d, 1) * step + Math.max(d - 1, 0) * step * 0.82);
          const hidden = d > SIDE + 0.5;
          const centre = places[i] === 0;
          return (
            <div
              key={offer.id}
              aria-hidden={!centre}
              className="absolute left-1/2 top-4"
              style={{
                width: cardW,
                zIndex: 100 - Math.round(d * 10),
                transform: `translateX(calc(-50% + ${x}px)) scale(${1 - Math.min(d, SIDE + 1) * 0.13})`,
                opacity: hidden ? 0 : 1 - Math.min(d, SIDE) * 0.3,
                filter: d > 0.5 ? `saturate(${1 - Math.min(d, SIDE) * 0.25})` : undefined,
                pointerEvents: hidden ? "none" : undefined,
                transition: dragging || jumped[i] ? "none" : "transform 0.5s cubic-bezier(0.2, 0.7, 0.3, 1), opacity 0.5s ease, filter 0.5s ease",
              }}
            >
              <Link
                href={`/offers/${offer.slug}`}
                draggable={false}
                tabIndex={centre ? 0 : -1}
                aria-label={offer.title}
                className="block rounded-2xl focus-visible:outline-offset-4"
                onClickCapture={(e) => {
                  // A drag is not a tap, and a tap on a side card brings it to the centre.
                  if (moved.current) return e.preventDefault();
                  if (!centre) {
                    e.preventDefault();
                    go(places[i]);
                  }
                }}
              >
                <Card offer={offer} centre={centre} />
              </Link>
            </div>
          );
        })}
      </div>

      {n > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous offer"
            className="absolute left-2 top-1/2 z-[200] grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white text-lg text-slate-700 shadow-md transition hover:text-brand-ink active:scale-90 sm:left-4"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next offer"
            className="absolute right-2 top-1/2 z-[200] grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white text-lg text-slate-700 shadow-md transition hover:text-brand-ink active:scale-90 sm:right-4"
          >
            ›
          </button>
          <div className="mt-4 flex justify-center gap-2" aria-label="Choose an offer">
            {offers.map((o, i) => (
              <button
                key={o.id}
                type="button"
                onClick={() => go(placeOf(i))}
                aria-label={`Offer ${i + 1} of ${n}`}
                aria-current={i === active}
                className={`h-2 rounded-full transition-all ${i === active ? "w-6 bg-brand-700" : "w-2 bg-slate-300 hover:bg-slate-400"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
