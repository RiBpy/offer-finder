// Duplicate detection: exact match on a normalised canonical URL, plus fuzzy
// matching on title/brand for offers republished under different URLs.

const TRACKING_PARAMS = /^(utm_[a-z]+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|ref|ref_src|_ga|yclid)$/i;

export function canonicalizeUrl(input) {
  if (!input) return null;
  let u;
  try {
    u = new URL(input);
  } catch {
    return null;
  }
  u.hash = "";
  u.hostname = u.hostname.toLowerCase();
  if ((u.protocol === "https:" && u.port === "443") || (u.protocol === "http:" && u.port === "80")) u.port = "";
  const kept = [...u.searchParams.entries()].filter(([k]) => !TRACKING_PARAMS.test(k));
  kept.sort(([a], [b]) => a.localeCompare(b));
  u.search = kept.length ? "?" + new URLSearchParams(kept).toString() : "";
  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "");
  return u.toString();
}

const STOP = new Set(["the", "a", "an", "and", "or", "of", "on", "in", "at", "for", "to", "with", "get", "now", "off", "up", "your", "all"]);

export function titleTokens(s) {
  return new Set(
    String(s || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9%]+/g, " ")
      .split(" ")
      .filter((t) => t && !STOP.has(t)),
  );
}

// Jaccard similarity of title token sets, 0..1.
export function titleSimilarity(a, b) {
  const A = titleTokens(a);
  const B = titleTokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

/**
 * Finds likely duplicates of `fields` among existing offers. Returns
 * [{ _id, title, slug, reason, score }], best first.
 */
export async function findDuplicateCandidates(db, fields, { excludeId } = {}) {
  const out = new Map();
  const base = excludeId ? { _id: { $ne: excludeId } } : {};
  const projection = { title: 1, slug: 1, brandName: 1, canonicalUrl: 1, validationStatus: 1, reviewState: 1 };

  if (fields.canonicalUrl) {
    const same = await db
      .collection("offers")
      .find({ ...base, canonicalUrl: fields.canonicalUrl }, { projection })
      .limit(5)
      .toArray();
    for (const d of same) out.set(String(d._id), { ...d, reason: "Same canonical URL", score: 1 });
  }

  if (fields.title) {
    const recent = await db
      .collection("offers")
      .find(
        {
          ...base,
          mergedInto: null,
          ...(fields.brandKey ? { brandKey: fields.brandKey } : {}),
          createdAt: { $gte: new Date(Date.now() - 180 * 24 * 3600 * 1000) },
        },
        { projection },
      )
      .sort({ createdAt: -1 })
      .limit(300)
      .toArray();
    for (const d of recent) {
      if (out.has(String(d._id))) continue;
      const score = titleSimilarity(fields.title, d.title);
      if (score >= 0.6) out.set(String(d._id), { ...d, reason: "Similar title", score: Math.round(score * 100) / 100 });
    }
  }
  return [...out.values()].sort((a, b) => b.score - a.score).slice(0, 10);
}
