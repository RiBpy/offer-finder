// Small string helpers.

export function slugify(input) {
  return String(input)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function cleanText(s, max) {
  if (s == null) return null;
  const t = String(s).replace(/\s+/g, " ").trim();
  if (!t) return null;
  return max && t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

// Keeps paragraph breaks but collapses other whitespace.
export function cleanMultiline(s, max) {
  if (s == null) return null;
  const t = String(s)
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
  if (!t) return null;
  return max && t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

export function normalizeKey(s) {
  const t = cleanText(s);
  return t ? t.toLowerCase() : null;
}

// Words that say who an offer is for, in English and Bangla. "Boys" and
// "girls" are children's wear in shop listings.
const AUDIENCE_WORDS = {
  men: /\b(men|men's|mens|gents?|gentlemen|male)\b|পুরুষ/i,
  women: /\b(women|women's|womens|ladies|lady|lady's|ladys|female)\b|নারী|মহিলা/i,
  kids: /\b(kids?|kid's|children|child|baby|babies|boys?|girls?|toddlers?|infants?)\b|শিশু|বাচ্চা/i,
};

/** Who a text is about (["men", "women", "kids"] subset); empty when it names nobody. */
export function inferAudience(text) {
  const t = text || "";
  return Object.entries(AUDIENCE_WORDS)
    .filter(([, re]) => re.test(t))
    .map(([id]) => id);
}
