import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/lib/db/mongo";
import { getPublicOfferBySlug, incrementViews } from "@/lib/offers/repository";
import { effectiveStatus, STATUS_LABELS } from "@/lib/offers/status";
import { categoryLabel, sourceTypeLabel } from "@/lib/constants";
import { AVAILABILITY_LABELS, discountLabel, formatDateTime, formatMoney, timeAgo } from "@/lib/format";
import { SimpleHeader, Footer, BottomNav } from "@/components/SiteChrome";
import { BookmarkButton } from "@/components/OfferCard";

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

function Row({ label, children }) {
  if (children == null || children === false || children === "") return null;
  return (
    <div className="grid grid-cols-3 gap-3 py-2.5 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="col-span-2 text-slate-900">{children}</dd>
    </div>
  );
}

export default async function OfferPage({ params }) {
  const { slug } = await params;
  const offer = await getOffer(slug);
  if (!offer) notFound();
  incrementViews(await getDb(), offer.slug).catch(() => {});

  const status = effectiveStatus(offer);
  const discount = discountLabel(offer);
  const tz = offer.timezone || undefined;
  const lastEvidence = offer.verificationEvidence?.[0];

  return (
    <>
      <SimpleHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 pb-24 sm:pb-10">
        <nav className="mb-4 text-sm">
          <Link href="/" className="text-emerald-700 hover:underline">← All offers</Link>
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

        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {offer.imageUrl && (
            <img src={offer.imageUrl} alt="" referrerPolicy="no-referrer" className="aspect-[16/9] w-full bg-[#fff] object-contain" />
          )}
          <div className="space-y-4 p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">{categoryLabel(offer.primaryCategory)}</span>
              {offer.isBrandOffer && <span className="rounded-full bg-violet-50 px-2.5 py-1 font-medium text-violet-800">Brand offer</span>}
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{AVAILABILITY_LABELS[offer.availabilityType]}</span>
              {offer.tags?.map((t) => (
                <span key={t} className="rounded-full bg-slate-50 px-2.5 py-1 text-slate-500">#{t}</span>
              ))}
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold leading-tight text-slate-900">{offer.title}</h1>
                {(offer.brandName || offer.businessName) && (
                  <p className="mt-1 text-slate-600">{[offer.brandName, offer.businessName].filter(Boolean).join(" · ")}</p>
                )}
              </div>
              <BookmarkButton id={offer.id} title={offer.title} />
            </div>
            {discount && <p className="inline-block rounded-lg bg-emerald-700 px-3 py-1.5 text-lg font-semibold text-white">{discount}</p>}
            {offer.originalPrice != null && offer.discountedPrice != null && (
              <p>
                <span className="mr-2 text-slate-400 line-through">{formatMoney(offer.originalPrice, offer.currency)}</span>
                <span className="text-lg font-semibold">{formatMoney(offer.discountedPrice, offer.currency)}</span>
                <span className="ml-2 text-xs text-slate-500">(prices as stated by the source)</span>
              </p>
            )}
            {offer.description && <div className="whitespace-pre-line text-slate-700">{offer.description}</div>}

            <a
              href={offer.sourceUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 active:scale-95 dark:text-slate-50"
            >
              View original offer ↗
            </a>

            <dl className="divide-y divide-slate-100 border-t border-slate-100 pt-2">
              <Row label="Status">{STATUS_LABELS[status]}</Row>
              <Row label="Starts">{offer.startDate && formatDateTime(offer.startDate, tz)}</Row>
              <Row label="Ends">{offer.endDate ? formatDateTime(offer.endDate, tz) : "No end date stated by the source"}</Row>
              <Row label="Published">{offer.publishedAt && formatDateTime(offer.publishedAt, tz)}</Row>
              <Row label="Last verified">
                {offer.lastVerifiedAt ? (
                  <>
                    {formatDateTime(offer.lastVerifiedAt)} ({timeAgo(offer.lastVerifiedAt)})
                    {lastEvidence?.method === "structured_data" && <span className="block text-xs text-slate-500">Confirmed from the source page&apos;s structured data</span>}
                    {lastEvidence?.method === "admin" && <span className="block text-xs text-slate-500">Confirmed by our team against the source</span>}
                  </>
                ) : (
                  "Not verified"
                )}
              </Row>
              <Row label="Source">
                {sourceTypeLabel(offer.sourceType)} · {offer.sourceName}
              </Row>
              <Row label="Where">
                {offer.scope === "online"
                  ? "Online"
                  : offer.scope === "national"
                    ? `Nationwide${offer.country ? ` (${offer.country})` : ""}`
                    : offer.scope === "city"
                      ? `Across ${offer.city}`
                      : null}
              </Row>
            </dl>

            {offer.scope === "local" && offer.eligibleLocations?.length > 0 && (
              <div>
                <h2 className="mb-2 font-semibold text-slate-900">Participating locations</h2>
                <ul className="space-y-2 text-sm">
                  {offer.eligibleLocations.map((l, i) => (
                    <li key={i} className="rounded-lg bg-slate-50 p-3">
                      <div className="font-medium">{l.name || l.address}</div>
                      {l.name && l.address && <div className="text-slate-600">{l.address}</div>}
                      {l.city && <div className="text-slate-500">{l.city}</div>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {offer.terms && (
              <div>
                <h2 className="mb-2 font-semibold text-slate-900">Terms</h2>
                <p className="whitespace-pre-line text-sm text-slate-700">{offer.terms}</p>
              </div>
            )}

            {offer.alternateSources?.length > 0 && (
              <div>
                <h2 className="mb-2 font-semibold text-slate-900">Also reported by</h2>
                <ul className="list-inside list-disc text-sm">
                  {offer.alternateSources.map((s) => (
                    <li key={s.url}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="text-emerald-700 hover:underline">
                        {s.sourceName || new URL(s.url).hostname}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-slate-500">
              Summary written from the original source. Terms, availability and participating branches can change; always confirm with the business.
            </p>
          </div>
        </article>
      </main>
      {status === "active" && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(offer) }} />}
      <Footer />
      <BottomNav />
    </>
  );
}
