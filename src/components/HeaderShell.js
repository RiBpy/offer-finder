"use client";

import { useEffect, useState } from "react";

/** Sticky top bar: a brand gradient strip, glass background, and a shadow once the page scrolls. */
export default function HeaderShell({ children }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-30 border-b backdrop-blur-xl transition-[box-shadow,background-color,border-color] duration-300 ${
        scrolled ? "border-slate-200 bg-white/80 shadow-lg shadow-black/5" : "border-transparent bg-white/60"
      }`}
    >
      <div aria-hidden="true" className="h-[3px] bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-500" />
      {children}
    </header>
  );
}
