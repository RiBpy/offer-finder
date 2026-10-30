"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RETURN_EVENT, rememberedHomeHref, rememberedList, requestScrollRestore } from "@/lib/return-to";

/**
 * "← All offers" on an offer page: goes back to the list the offer was opened
 * from (a filtered home page or Saved), named after it, at the same scroll
 * position. Server-rendered as a plain link home, updated once mounted.
 */
export function BackToListLink({ className = "" }) {
  const [entry, setEntry] = useState(null);
  useEffect(() => setEntry(rememberedList()), []);
  const href = entry?.href || "/";
  const text = entry?.label ? `← Back to ${entry.label}` : "← All offers";
  return (
    <Link href={href} onClick={entry ? requestScrollRestore : undefined} className={className}>
      {text}
    </Link>
  );
}

/** Link to the offer list that keeps the visitor's last filters (header and bottom bar). */
export function OffersLink({ className = "", children, ...rest }) {
  const [href, setHref] = useState("/");
  useEffect(() => {
    const update = () => setHref(rememberedHomeHref());
    update();
    window.addEventListener(RETURN_EVENT, update);
    return () => window.removeEventListener(RETURN_EVENT, update);
  }, []);
  return (
    <Link href={href} className={className} {...rest}>
      {children}
    </Link>
  );
}
