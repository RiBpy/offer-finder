import SavedClient from "./SavedClient";
import { SimpleHeader, Footer, BottomNav } from "@/components/SiteChrome";

export const metadata = { title: "Saved offers", robots: { index: false } };

export default function SavedPage() {
  return (
    <>
      <SimpleHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 sm:pb-10">
        <h1 className="mb-1 text-2xl font-bold text-slate-900">Saved offers</h1>
        <p className="mb-6 text-sm text-slate-500">Saved in this browser only. No account needed.</p>
        <SavedClient />
      </main>
      <Footer />
      <BottomNav active="saved" />
    </>
  );
}
