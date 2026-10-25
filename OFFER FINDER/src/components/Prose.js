import { SimpleHeader, Footer, BottomNav } from "./SiteChrome";

export default function ProsePage({ title, updated, children }) {
  return (
    <>
      <SimpleHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 pb-24 sm:pb-10">
        <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
        {updated && <p className="mt-1 text-sm text-slate-500">Last updated {updated}</p>}
        <div className="mt-6 space-y-4 text-slate-700 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-slate-900 [&_li]:ml-5 [&_li]:list-disc">
          {children}
        </div>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
