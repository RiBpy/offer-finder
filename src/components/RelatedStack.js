"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import OfferPicture from "./OfferPicture";
import { discountLabel, validityLabel } from "@/lib/format";
import { categoryLabel } from "@/lib/constants";

const DRAWN = 4; // cards visible in the stack
const STEP_PX = 14; // how far each card behind peeks out below the one in front
const FLING_PX = 80; // drag distance that sends the top card away
const OUT_MS = 380;

// `reveal` (0–1) fades the content in as a card comes to the front; cards
// further back show as plain cards, so only the top one is read.
function StackCard({ offer, reveal }) {
  const discount = discountLabel(offer);
  const v = validityLabel(offer);
  const seller = offer.businessName || offer.brandName || offer.sourceName;
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-900/10">
      <div className="flex h-full flex-col" style={{ opacity: reveal, transition: "opacity 0.3s ease" }}>
        <div className="relative aspect-[16/9] shrink-0 overflow-hidden">
          <OfferPicture offer={offer} />
          {discount && (
            <span className="absolute bottom-2 left-2 max-w-[80%] truncate rounded-md bg-gradient-to-r from-brand-700 to-brand-accent px-2.5 py-1 text-xs font-extrabold uppercase text-white shadow-lg">
              {discount}
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-3">
          {seller && <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-brand-ink">{seller}</p>}
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">{offer.title}</p>
          <p className="mt-auto flex items-center justify-between gap-2 text-[11px] text-slate-500">
            <span className="truncate">{categoryLabel(offer.primaryCategory)}</span>
            <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">{v.text}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * "You may also like": the offers as a stack of cards. Drag (or swipe) the top
 * card sideways and it flies off to the back of the stack while the next one
 * comes forward, round and round; the arrows and the arrow keys do the same.
 * A tap on the top card opens that offer.
 */
export default function RelatedStack({ offers }) {
  const n = offers.length;
  const [order, setOrder] = useState(() => offers.map((_, i) => i)); // front card first
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(0); // -1 or 1 while the top card flies off
  const [instant, setInstant] = useState(false); // no transitions for one frame after re-stacking
  const startX = useRef(0);
  const moved = useRef(false);
  const busy = useRef(false);

  const send = useCallback(
    (dir) => {
      if (busy.current || n < 2) return;
      busy.current = true;
      setLeaving(dir);
      setTimeout(() => {
        setInstant(true);
        setOrder((o) => [...o.slice(1), o[0]]);
        setLeaving(0);
        setDx(0);
        // Transitions back on once the re-stacked cards have been drawn in place.
        setTimeout(() => {
          setInstant(false);
          busy.current = false;
        }, 40);
      }, OUT_MS);
    },
    [n],
  );
  const back = useCallback(() => {
    if (busy.current || n < 2) return;
    setOrder((o) => [o[o.length - 1], ...o.slice(0, -1)]);
  }, [n]);

  if (!n) return null;
  const front = order[0];
  const progress = Math.min(Math.abs(dx) / FLING_PX, 1); // how far the cards behind have moved up

  const onPointerDown = (e) => {
    moved.current = false;
    if (n < 2 || busy.current) return;
    startX.current = e.clientX;
    setDragging(true);
  };
  const onPointerMove = (e) => {
    if (!dragging) return;
    const d = e.clientX - startX.current;
    // Only a real drag takes the pointer over; a tap stays a click on the link.
    if (!moved.current && Math.abs(d) > 5) {
      moved.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (moved.current) setDx(d);
  };
  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (Math.abs(dx) > FLING_PX) send(Math.sign(dx));
    else setDx(0);
  };

  return (
    <div
      className="related-stack"
      tabIndex={0}
      role="group"
      aria-roledescription="carousel"
      aria-label="You may also like"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") send(1);
        if (e.key === "ArrowLeft") back();
      }}
    >
      {/* All cards share one grid cell, so the stack is as tall as its tallest card. */}
      <div className="relative mx-auto grid w-full max-w-md" style={{ marginBottom: (Math.min(n, DRAWN) - 1) * STEP_PX }}>
        {offers.map((offer, i) => {
          const pos = order.indexOf(i);
          const depth = Math.max(0, pos - (pos > 0 ? progress : 0) - (leaving && pos > 0 ? 1 : 0));
          const hidden = pos >= DRAWN;
          let transform;
          if (pos === 0 && leaving) transform = `translateX(${leaving * 130}%) rotate(${leaving * 22}deg)`;
          else if (pos === 0) transform = `translateX(${dx}px) rotate(${dx / 16}deg)`;
          else {
            const d = Math.min(depth, DRAWN - 1);
            transform = `translateY(${d * STEP_PX}px) scale(${1 - d * 0.05}) rotate(${(i % 2 ? 1 : -1) * d * 1.5}deg)`;
          }
          return (
            <div
              key={offer.id}
              aria-hidden={pos !== 0}
              className={`relative select-none [grid-area:1/1] ${pos === 0 ? "cursor-grab touch-pan-y active:cursor-grabbing" : "pointer-events-none"}`}
              style={{
                zIndex: 100 - pos,
                transform,
                opacity: hidden || (pos === 0 && leaving) ? 0 : 1 - Math.min(depth, DRAWN) * 0.12,
                transition: instant || (pos === 0 && dragging) ? "none" : "transform 0.38s cubic-bezier(0.2, 0.7, 0.3, 1), opacity 0.38s ease",
                transformOrigin: "50% 100%",
              }}
              {...(pos === 0 ? { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp } : {})}
            >
              <Link
                href={`/offers/${offer.slug}`}
                draggable={false}
                tabIndex={pos === 0 ? 0 : -1}
                aria-label={offer.title}
                className="block h-full rounded-2xl focus-visible:outline-offset-4"
                // A drag is not a tap: don't open the offer at the end of one.
                onClickCapture={(e) => moved.current && e.preventDefault()}
              >
                <StackCard offer={offer} reveal={pos === 0 && !leaving ? 1 : Math.max(0, 1 - depth)} />
              </Link>
            </div>
          );
        })}
      </div>

      {n > 1 && (
        <div className="mt-4 flex items-center justify-center gap-4">
          <button type="button" onClick={back} aria-label="Previous offer" className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-brand-600/50 hover:text-brand-ink active:scale-90">
            ←
          </button>
          <span className="min-w-14 text-center text-sm font-medium tabular-nums text-slate-500" aria-live="polite">
            {front + 1} / {n}
          </span>
          <button type="button" onClick={() => send(1)} aria-label="Next offer" className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-brand-600/50 hover:text-brand-ink active:scale-90">
            →
          </button>
        </div>
      )}
    </div>
  );
}
