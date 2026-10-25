import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold text-slate-900">
      <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-700 text-white">%</span>
      <span className="text-lg tracking-tight">OfferFinder</span>
    </Link>
  );
}

export function SimpleHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Logo />
        <nav className="flex gap-4 text-sm font-medium text-slate-600">
          <Link href="/" className="hover:text-slate-900">Offers</Link>
          <Link href="/saved" className="hover:text-slate-900">Saved</Link>
        </nav>
      </div>
    </header>
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
