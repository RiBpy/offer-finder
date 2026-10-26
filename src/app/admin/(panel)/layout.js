import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import LogoutButton from "./LogoutButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }) {
  const session = verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/login");
  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/admin" className="font-semibold">OfferFinder admin</Link>
          <nav className="flex gap-4 text-sm font-medium text-slate-600">
            <Link href="/admin" className="hover:text-slate-900">Offers</Link>
            <Link href="/admin/offers/new" className="hover:text-slate-900">Add offer</Link>
            <Link href="/admin/sources" className="hover:text-slate-900">Sources &amp; jobs</Link>
            <Link href="/" className="hover:text-slate-900">View site</Link>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-slate-500">
            <span>{session.sub}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
