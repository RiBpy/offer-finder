import { notFound } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/lib/db/mongo";
import { getPublicOfferBySlug, getRelatedOffers, incrementViews } from "@/lib/offers/repository";
import { effectiveStatus, STATUS_LABELS } from "@/lib/offers/status";
import { CATEGORIES, categoryLabel, sourceTypeLabel } from "@/lib/constants";
import { AVAILABILITY_LABELS, discountLabel, formatDateTime, formatMoney, timeAgo } from "@/lib/format";
import { SimpleHeader, Footer, BottomNav } from "@/components/SiteChrome";
import { BookmarkButton } from "@/components/OfferCard";
import OfferPicture from "@/components/OfferPicture";
import RelatedCarousel from "@/components/RelatedCarousel";
import { BackToListLink } from "@/components/ReturnLink";

export const dynamic = "force-dynamic";

const getOffer = cache(async (slug) => getPublicOfferBySlug(await getDb(), slug));

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const offer = await getOffer(slug);
  if (!offer) return { title: "Offer not found", robots: { index: false } };
  const status = effectiveStatus(offer);
  return {
    title: offer.title,
    description: offer.description?.slice(0, 160) || `${offer.title} from ${offer.brandName || offer.businessName || offer.sourceName}`,
    alternates: { canonical: `/offers/${offer.slug}` },
    robots: status === "active" ? undefined : { index: false },
    openGraph: { title: offer.title, description: offer.description?.slice(0, 200), type: "website", url: `/offers/${offer.slug}` },
  };
}

function jsonLd(offer) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Offer",
    name: offer.title,
    description: offer.description || undefined,
    url: offer.sourceUrl,
    category: categoryLabel(offer.primaryCategory),
    validFrom: offer.startDate || undefined,
    validThrough: offer.endDate || undefined,
    price: offer.discountedPrice ?? undefined,
    priceCurrency: offer.discountedPrice != null ? offer.currency : undefined,
    offeredBy: offer.brandName || offer.businessName ? { "@type": "Organization", name: offer.businessName || offer.brandName } : undefined,
  };
  // Escape "<" so the JSON cannot close the script tag.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

const ICONS = {
  status: "M5 12.5 9.5 17 19 7.5",
  start: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  end: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  published: "M4 4h16v16H4zM8 8h8M8 12h8M8 16h5",
  verified: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Zm-3.5 9 2.5 2.5L16 10",
  source: "M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
  where: "M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
};

// One fact about the offer, as a small tile with an icon.
function Fact({ icon, label, children }) {
  if (children == null || children === false || children === "") return null;
  return (
    <div className="flex gap-3 rounded-xl border border-slate-200/80 bg-white/70 p-3">
      <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-ink">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={ICONS[icon]} />
        </svg>
      </span>
      <div className="min-w-0 text-sm">
        <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
        <dd className="mt-0.5 text-slate-900">{children}</dd>
      </div>
    </div>
  );
}

// What the "You may also like" carousel needs of each offer.
const stackFields = (o) => ({
  id: o.id,
  slug: o.slug,
  title: o.title,
  imageUrl: o.imageUrl,
  businessName: o.businessName,
  brandName: o.brandName,
  sourceName: o.sourceName,
  primaryCategory: o.primaryCategory,
  discountType: o.discountType,
  discountValue: o.discountValue,
  discountText: o.discountText,
  discountedPrice: o.discountedPrice,
  currency: o.currency,
  startDate: o.startDate,
  endDate: o.endDate,
});

export default async function OfferPage({ params }) {
  const { slug } = await params;
  const offer = await getOffer(slug);
  if (!offer) notFound();
  const db = await getDb();
  incrementViews(db, offer.slug).catch(() => {});
  const related = await getRelatedOffers(db, offer).catch(() => []);

  const status = effectiveStatus(offer);
  const discount = discountLabel(offer);
  const tz = offer.timezone || undefined;
  const lastEvidence = offer.verificationEvidence?.[0];
  const category = CATEGORIES.find((c) => c.id === offer.primaryCategory);
  const seller = [...new Set([offer.brandName, offer.businessName].filter(Boolean))].join(" · ");
  const sellerName = offer.businessName || offer.brandName;
  const fromSameSeller = sellerName && related.some((r) => r.businessName === sellerName || r.brandName === sellerName);

  return (
    <>
      <SimpleHeader />
      {/* Clipped sideways: the glow and a card flung off the stack must not widen the page. */}
      <main className="relative isolate mx-auto w-full max-w-6xl flex-1 overflow-x-clip px-4 py-6 pb-24 sm:pb-10">
        {/* Soft brand-coloured light behind the top of the page. */}
        <div aria-hidden="true" className="offer-aurora" />

        <nav className="mb-4 text-sm">
          <BackToListLink className="font-medium text-brand-ink hover:underline" />
        </nav>

        {status !== "active" && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
            <strong>{STATUS_LABELS[status]}.</strong>{" "}
            {status === "expired"
              ? "This offer's validity period has ended."
              : status === "unavailable"
                ? "The original offer page is no longer available."
                : "We could not confirm that this offer is still valid. Check the original source before relying on it."}
          </div>
        )}

        {/* Hero: the picture and the offer's headline in one card. */}
        <section className="offer-hero grid overflow-hidden rounded-3xl lg:grid-cols-2">
          <div className="relative aspect-[16/9] lg:aspect-auto lg:min-h-[340px]">
            <OfferPicture
              offer={{ imageUrl: offer.imageUrl, businessName: offer.businessName, brandName: offer.brandName, sourceName: offer.sourceName, primaryCategory: offer.primaryCategory }}
              variant="hero"
            />
          </div>
          <header className="offer-headline relative flex flex-col justify-center gap-4 overflow-hidden p-5 text-white sm:p-7">
            <div className="relative flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="rounded-full bg-white/15 px-2.5 py-1 font-medium ring-1 ring-white/25 ring-inset">
                    {category?.icon && <span aria-hidden="true">{category.icon} </span>}
                    {categoryLabel(offer.primaryCategory)}
                  </span>
                  {offer.isBrandOffer && <span className="rounded-full bg-white/15 px-2.5 py-1 font-medium ring-1 ring-white/25 ring-inset">Brand offer</span>}
                  <span className="rounded-full bg-white/15 px-2.5 py-1 ring-1 ring-white/25 ring-inset">{AVAILABILITY_LABELS[offer.availabilityType]}</span>
                </div>
                <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{offer.title}</h1>
                {seller && <p className="text-sm font-medium text-white/80">{seller}</p>}
              </div>
              <BookmarkButton id={offer.id} title={offer.title} className="border-white/30! bg-white/15! text-white! backdrop-blur" />
            </div>
            <div className="relative flex flex-wrap items-center gap-3">
              {discount && (
                <p className="rounded-2xl bg-white px-4 py-2 text-2xl font-extrabold uppercase tracking-tight text-brand-ink shadow-lg shadow-black/10">{discount}</p>
              )}
              {offer.originalPrice != null && offer.discountedPrice != null && (
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-2xl font-bold">{formatMoney(offer.discountedPrice, offer.currency)}</span>
                  <span className="text-white/60 line-through">{formatMoney(offer.originalPrice, offer.currency)}</span>
                </p>
              )}
            </div>
            <a
              href={offer.sourceUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="relative inline-flex w-fit items-center gap-2 rounded-xl bg-white/15 px-5 py-3 font-semibold text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-white/25 active:scale-95"
            >
              View original offer ↗
            </a>
          </header>
        </section>

        {/* Details: one full-width panel; the description, branches and terms on the
            left, the key facts in a column on the right (stacked on phones). */}
        <article className="mt-6 grid gap-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/5 sm:p-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-10 lg:p-8">
          <div className="min-w-0 space-y-6">
            {offer.description && (
              <section>
                <h2 className="mb-2 text-lg font-semibold text-slate-900">About this offer</h2>
                <div className="whitespace-pre-line leading-relaxed text-slate-700">{offer.description}</div>
                {offer.originalPrice != null && offer.discountedPrice != null && <p className="mt-2 text-xs text-slate-500">Prices as stated by the source.</p>}
              </section>
            )}
            {offer.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 text-xs">
                {offer.tags.map((t) => (
                  <span key={t} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">#{t}</span>
                ))}
              </div>
            )}

            {offer.scope === "local" && offer.eligibleLocations?.length > 0 && (
              <section>
                <h2 className="mb-2 font-semibold text-slate-900">Participating locations</h2>
                <ul className="grid gap-2 text-sm sm:grid-cols-2">
                  {offer.eligibleLocations.map((l, i) => (
                    <li key={i} className="rounded-xl border border-slate-200/80 bg-slate-50 p-3">
                      <div className="font-medium">{l.name || l.address}</div>
                      {l.name && l.address && <div className="text-slate-600">{l.address}</div>}
                      {l.city && <div className="text-slate-500">{l.city}</div>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {offer.terms && (
              <section>
                <h2 className="mb-2 font-semibold text-slate-900">Terms</h2>
                <p className="whitespace-pre-line rounded-xl border-l-4 border-brand-600 bg-brand-50 p-4 text-sm text-slate-700">{offer.terms}</p>
              </section>
            )}

            {offer.alternateSources?.length > 0 && (
              <section>
                <h2 className="mb-2 font-semibold text-slate-900">Also reported by</h2>
                <ul className="list-inside list-disc text-sm">
                  {offer.alternateSources.map((s) => (
                    <li key={s.url}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="text-brand-ink hover:underline">
                        {s.sourceName || new URL(s.url).hostname}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <p className="text-xs text-slate-500">
              Summary written from the original source. Terms, availability and participating branches can change; always confirm with the business.
            </p>
          </div>

          <aside aria-labelledby="facts-title" className="min-w-0 lg:border-l lg:border-slate-100 lg:pl-10">
            <h2 id="facts-title" className="mb-3 text-lg font-semibold text-slate-900">Offer details</h2>
            <dl className="grid gap-2">
              <Fact icon="status" label="Status">{STATUS_LABELS[status]}</Fact>
              <Fact icon="start" label="Starts">{offer.startDate && formatDateTime(offer.startDate, tz)}</Fact>
              <Fact icon="end" label="Ends">{offer.endDate ? formatDateTime(offer.endDate, tz) : "No end date stated by the source"}</Fact>
              <Fact icon="published" label="Published">{offer.publishedAt && formatDateTime(offer.publishedAt, tz)}</Fact>
              <Fact icon="verified" label="Last verified">
                {offer.lastVerifiedAt ? (
                  <>
                    {formatDateTime(offer.lastVerifiedAt)} ({timeAgo(offer.lastVerifiedAt)})
                    {lastEvidence?.method === "structured_data" && <span className="block text-xs text-slate-500">Confirmed from the source page&apos;s structured data</span>}
                    {lastEvidence?.method === "admin" && <span className="block text-xs text-slate-500">Confirmed by our team against the source</span>}
                  </>
                ) : (
                  "Not verified"
                )}
              </Fact>
              <Fact icon="source" label="Source">
                {sourceTypeLabel(offer.sourceType)} · {offer.sourceName}
              </Fact>
              <Fact icon="where" label="Where">
                {offer.scope === "online"
                  ? "Online"
                  : offer.scope === "national"
                    ? `Nationwide${offer.country ? ` (${offer.country})` : ""}`
                    : offer.scope === "city"
                      ? `Across ${offer.city}`
                      : null}
              </Fact>
            </dl>
          </aside>
        </article>

        {/* "You may also like": a full-width row with the chosen card big in the centre. */}
        {related.length > 0 && (
          <section aria-labelledby="related-title" className="related-panel mt-10 rounded-3xl border border-brand-100 px-0 py-8 sm:py-10">
            <div className="mb-6 px-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-ink">{fromSameSeller ? `More from ${sellerName}` : "Similar offers"}</p>
              <h2 id="related-title" className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">You may also like</h2>
              <p className="mt-1 text-sm text-slate-500">
                {fromSameSeller ? `More from ${sellerName}, and similar offers` : `More ${categoryLabel(offer.primaryCategory).toLowerCase()} offers`} · drag or use the arrows
              </p>
            </div>
            <RelatedCarousel offers={related.map(stackFields)} />
          </section>
        )}
      </main>
      {status === "active" && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(offer) }} />}
      <Footer />
      <BottomNav />
    </>
  );
}
