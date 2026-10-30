import Link from "next/link";
import HeaderShell from "./HeaderShell";
import RibpyLogo from "./RibpyLogo";
import ThemeToggle from "./ThemeToggle";

export function Logo() {
  return (
    <Link href="/" className="group flex shrink-0 items-center gap-2.5 font-semibold">
      <span
        aria-hidden="true"
        className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-lg font-bold text-white shadow-md shadow-emerald-600/30 transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110"
      >
        %
      </span>
      <span className="text-lg tracking-tight text-slate-900">
        Offer<span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">Finder</span>
      </span>
    </Link>
  );
}

const navLink = "rounded-full px-3 py-1.5 transition-colors hover:bg-slate-100 hover:text-slate-900";

export function SimpleHeader() {
  return (
    <HeaderShell>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Logo />
        <nav className="flex items-center gap-1 text-sm font-medium text-slate-600">
          <Link href="/" className={navLink}>Offers</Link>
          <Link href="/saved" className={navLink}>Saved</Link>
          <ThemeToggle className="ml-2" />
        </nav>
      </div>
    </HeaderShell>
  );
}

export function BottomNav({ active }) {
  const item = (on) => `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium ${on ? "text-emerald-700" : "text-slate-500"}`;
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden">
      <Link href="/" className={item(active === "home")}>
        <span aria-hidden="true" className="text-lg">🏠</span> Offers
      </Link>
      <Link href="/?location=1" className={item(active === "location")}>
        <span aria-hidden="true" className="text-lg">📍</span> Location
      </Link>
      <Link href="/saved" className={item(active === "saved")}>
        <span aria-hidden="true" className="text-lg">★</span> Saved
      </Link>
    </nav>
  );
}

// Same glass as the header: translucent white, blurred, over soft brand-coloured
// glows so the blur has something to show through.
export function Footer() {
  return (
    <footer className="relative mt-16 overflow-hidden pb-20 sm:pb-0">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-2 h-40 w-72 rounded-full bg-emerald-400/25 blur-3xl" />
        <div className="absolute right-0 top-10 h-40 w-80 rounded-full bg-sky-400/20 blur-3xl" />
      </div>
      <div className="relative border-t border-slate-200 bg-white/60 backdrop-blur-xl">
        <div aria-hidden="true" className="h-[3px] bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-500" />
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 text-sm text-slate-500">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Logo />
            <nav className="-mx-3 flex flex-wrap gap-1 font-medium text-slate-600">
              <Link href="/privacy" className={navLink}>Privacy</Link>
              <Link href="/terms" className={navLink}>Terms</Link>
              <Link href="/about-bot" className={navLink}>Our crawler</Link>
            </nav>
          </div>
          <p className="max-w-2xl">Offers are collected from public sources and link to the original. Always check terms with the business.</p>
          <div className="flex flex-col gap-3 border-t border-slate-200/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} OfferFinder</p>
            <p className="flex items-center gap-2">
              <span>Crafted by</span>
              <RibpyLogo />
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
