"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Top bar pinned to the viewport: a brand gradient strip, glass background,
 * and a shadow once the page scrolls. It is `fixed` rather than `sticky` so it
 * stays put whatever wraps it; a spacer of its measured height keeps content
 * from sliding underneath. `spacerClassName` is the height to reserve before
 * the first measurement, so the page does not jump while it loads.
 */
export default function HeaderShell({ children, spacerClassName = "h-[68px]" }) {
  const ref = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const [height, setHeight] = useState(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // The header wraps onto more lines on narrow screens, so follow its real height.
  useEffect(() => {
    const el = ref.current;
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <header
        ref={ref}
        className={`fixed inset-x-0 top-0 z-30 border-b backdrop-blur-xl transition-[box-shadow,background-color,border-color] duration-300 ${
          scrolled ? "border-slate-200 bg-white/80 shadow-lg shadow-black/5" : "border-transparent bg-white/60"
        }`}
      >
        <div aria-hidden="true" className="h-[3px] bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-500" />
        {children}
      </header>
      <div aria-hidden="true" className={height == null ? spacerClassName : undefined} style={height == null ? undefined : { height }} />
    </>
  );
}
