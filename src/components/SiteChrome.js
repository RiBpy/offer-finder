import Link from "next/link";
import HeaderShell from "./HeaderShell";
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

export function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white pb-20 sm:pb-0">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>Offers are collected from public sources and link to the original. Always check terms with the business.</p>
        <nav className="flex gap-4">
          <Link href="/privacy" className="hover:text-slate-800">Privacy</Link>
          <Link href="/terms" className="hover:text-slate-800">Terms</Link>
          <Link href="/about-bot" className="hover:text-slate-800">Our crawler</Link>
        </nav>
      </div>
    </footer>
  );
}
