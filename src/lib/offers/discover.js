// Turns an admin-submitted URL into a prefilled offer draft.

import { classifyOffer } from "../classify.js";
import { canonicalizeUrl, findDuplicateCandidates } from "../dedupe.js";
import { getAdapter } from "../sources/registry.js";
import { recordSourceResult } from "../sources/health.js";
import { normalizeKey } from "../text.js";

export async function draftFromUrl(db, url, { now = new Date() } = {}) {
  const adapter = getAdapter("manual-url");
  let result;
  try {
    result = await adapter.fetchCandidate(url);
    await recordSourceResult(db, url, { ok: true, status: result.status, now });
  } catch (err) {
    await recordSourceResult(db, url, { ok: false, status: err.status ?? null, error: err.message, now });
    const canonicalUrl = canonicalizeUrl(url);
    return {
      ok: false,
      error: err.message,
      code: err.code ?? null,
      draft: { sourceUrl: url, canonicalUrl },
      duplicates: await findDuplicateCandidates(db, { canonicalUrl }),
    };
  }

  const x = result.extracted;
  const classification = classifyOffer({ title: x.title, description: x.description, brandName: x.brandName });
  const canonicalUrl = canonicalizeUrl(x.canonicalUrl || result.finalUrl);
  const draft = {
    title: x.title,
    description: x.description,
    imageUrl: x.imageUrl,
    sourceUrl: result.finalUrl,
    canonicalUrl,
    sourceName: x.siteName,
    brandName: x.brandName,
    publishedAt: x.publishedAt,
    // Dates are only prefilled from explicit structured data on the page.
    startDate: x.validFrom,
    endDate: x.validThrough,
    currency: x.currency,
    discountedPrice: x.price,
    primaryCategory: classification.primaryCategory,
    categories: classification.categories,
    isBrandOffer: classification.isBrandOffer,
  };
  const duplicates = await findDuplicateCandidates(db, { canonicalUrl, title: x.title, brandKey: normalizeKey(x.brandName) });
  const warnings = [];
  if (!x.structuredData) warnings.push("No machine-readable offer dates were found. Confirm dates from the page text before marking Active.");
  if (x.endedLanguage) warnings.push(`The page contains "${x.endedLanguage}". The offer may have ended.`);
  if (x.validThrough && x.validThrough <= now) warnings.push("The page's structured data says this offer has already ended.");
  return { ok: true, draft, duplicates, warnings, textSample: x.textSample };
}
