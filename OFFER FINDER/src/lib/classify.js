// Keyword-based category classifier. It only suggests categories; an admin
// confirms or corrects them before an offer is published.

const KEYWORDS = {
  electronics: ["phone", "smartphone", "mobile", "laptop", "notebook", "tablet", "tv", "television", "headphone", "earbuds", "camera", "electronics", "gadget", "appliance", "refrigerator", "fridge", "air conditioner", "washing machine", "monitor", "console", "smartwatch", "iphone", "samsung galaxy", "charger"],
  fashion: ["clothing", "apparel", "fashion", "shirt", "t-shirt", "dress", "jeans", "saree", "panjabi", "kurta", "jacket", "wear", "outfit", "denim", "boutique", "handbag", "accessories", "eid collection"],
  footwear: ["shoe", "shoes", "footwear", "sneaker", "sneakers", "sandal", "sandals", "boots", "slipper", "loafer", "heels", "running shoes"],
  food: ["restaurant", "food", "meal", "buffet", "pizza", "burger", "dining", "dinner", "lunch", "breakfast", "cafe", "coffee", "delivery", "biryani", "kfc", "iftar", "dessert", "bakery", "combo"],
  hotels: ["hotel", "resort", "room", "staycation", "suite", "accommodation", "stay", "spa resort", "night stay", "booking"],
  travel: ["flight", "airline", "air ticket", "bus", "train", "travel", "tour", "trip", "holiday package", "visa", "ride", "taxi", "uber", "pathao", "transport", "cruise"],
  beauty: ["beauty", "skincare", "skin care", "cosmetic", "makeup", "salon", "spa", "grooming", "haircut", "perfume", "fragrance", "lipstick", "serum"],
  groceries: ["grocery", "groceries", "supermarket", "household", "essentials", "rice", "oil", "vegetables", "detergent", "hypermarket", "mart"],
  entertainment: ["cinema", "movie", "ticket", "concert", "event", "amusement", "theme park", "festival", "gaming", "bowling", "show", "museum", "water park"],
  home: ["furniture", "sofa", "bed", "mattress", "decor", "home", "kitchen", "cookware", "curtain", "lighting", "table", "chair", "wardrobe"],
  health: ["gym", "fitness", "yoga", "wellness", "sports", "workout", "membership", "pharmacy", "health", "clinic", "diagnostic", "swimming"],
  services: ["service", "insurance", "bank", "card", "cashback", "repair", "cleaning", "education", "course", "internet", "subscription", "telecom"],
};

const BRAND_WIDE = ["storewide", "store-wide", "sitewide", "site-wide", "all products", "entire collection", "everything", "brand sale", "flat", "bogo", "buy one get one", "buy 1 get 1", "all items", "season sale", "mega sale"];

function countHits(text, words) {
  let n = 0;
  for (const w of words) {
    const re = new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?([^a-z]|$)`, "g");
    const m = text.match(re);
    if (m) n += m.length;
  }
  return n;
}

/**
 * @returns {{ primaryCategory: string, categories: string[], isBrandOffer: boolean, scores: object }}
 */
export function classifyOffer({ title = "", description = "", brandName = "", tags = [] }) {
  const titleText = ` ${String(title).toLowerCase()} `;
  const bodyText = ` ${[description, brandName, ...(tags || [])].join(" ").toLowerCase()} `;
  const scores = {};
  for (const [cat, words] of Object.entries(KEYWORDS)) {
    // Title matches weigh more than body matches.
    const s = countHits(titleText, words) * 3 + countHits(bodyText, words);
    if (s > 0) scores[cat] = s;
  }
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const primaryCategory = ranked[0]?.[0] ?? "services";
  const top = ranked[0]?.[1] ?? 0;
  const categories = ranked.filter(([, s]) => s >= Math.max(2, top / 2)).map(([c]) => c);
  if (!categories.includes(primaryCategory)) categories.unshift(primaryCategory);
  const all = titleText + bodyText;
  const isBrandOffer = Boolean(brandName) && BRAND_WIDE.some((w) => all.includes(w));
  return { primaryCategory, categories: categories.slice(0, 3), isBrandOffer, scores };
}
