import Link from "next/link";
import { SimpleHeader, Footer } from "@/components/SiteChrome";

export default function NotFound() {
  return (
    <>
      <SimpleHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Page not found</h1>
        <p className="mt-2 text-slate-600">This offer may have been removed or merged with another listing.</p>
        <Link href="/" className="mt-6 inline-block font-medium text-emerald-700 hover:underline">Browse current offers</Link>
      </main>
      <Footer />
    </>
  );
}
