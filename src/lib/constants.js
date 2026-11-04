// Shared constants used by both server and client code.

export const CATEGORIES = [
  { id: "electronics", label: "Electronics", icon: "📱" },
  { id: "fashion", label: "Clothing & Fashion", icon: "👗" },
  { id: "footwear", label: "Shoes & Footwear", icon: "👟" },
  { id: "bags", label: "Bags & Accessories", icon: "👜" },
  { id: "food", label: "Restaurants & Food", icon: "🍽️" },
  { id: "hotels", label: "Hotels & Resorts", icon: "🏨" },
  { id: "travel", label: "Travel & Transport", icon: "✈️" },
  { id: "beauty", label: "Beauty & Personal Care", icon: "💄" },
  { id: "groceries", label: "Groceries & Supermarkets", icon: "🛒" },
  { id: "entertainment", label: "Entertainment & Activities", icon: "🎟️" },
  { id: "home", label: "Home & Furniture", icon: "🛋️" },
  { id: "health", label: "Health & Fitness", icon: "💪" },
  { id: "services", label: "Services & Other", icon: "🧰" },
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

// Who an offer is for. An offer that names nobody (a store-wide sale, a
// restaurant discount) is for everyone and shows under each of these.
export const AUDIENCES = [
  { id: "men", label: "Men", icon: "👔" },
  { id: "women", label: "Women", icon: "👠" },
  { id: "kids", label: "Kids", icon: "🧸" },
];
export const AUDIENCE_IDS = AUDIENCES.map((a) => a.id);

// Brands and shops with their own source (discovery/config.js), for the Brands
// filter. `sourceName` matches the site name there; `names` also takes in news
// offers that name the brand (for brands whose site cannot be read).
// Kept in A–Z order: the Brands menu lists them as written here, under their
// `group` (STORE_GROUPS).
export const STORES = [
  { id: "aarong", label: "Aarong", group: "clothing", sourceName: "Aarong", names: ["Aarong", "আড়ং"] },
  { id: "aeroblue", label: "Aeroblue", group: "clothing", sourceName: "Aeroblue" },
  { id: "agora", label: "Agora", group: "supermarket", sourceName: "Agora" },
  { id: "akij", label: "Akij Footwear", group: "footwear", sourceName: "Akij Footwear", names: ["Akij Footwear"] },
  { id: "anjans", label: "Anjan's", group: "clothing", sourceName: "Anjan's" },
  { id: "apex", label: "Apex", group: "footwear", sourceName: "Apex" },
  { id: "arogga", label: "Arogga", group: "beauty", sourceName: "Arogga" },
  { id: "bata", label: "Bata", group: "footwear", sourceName: "Bata" },
  { id: "bay", label: "Bay", group: "footwear", sourceName: "Bay", names: ["Bay Emporium", "Bay Footwear", "Bay shoes"] },
  { id: "cats-eye", label: "Cats Eye", group: "clothing", sourceName: "Cats Eye", names: ["Cats Eye", "Cat's Eye", "Catseye"] },
  { id: "comfystyle", label: "Comfystyle", group: "clothing", sourceName: "Comfystyle" },
  { id: "daraz", label: "Daraz", group: "online", sourceName: "Daraz" },
  { id: "deshal", label: "Deshal", group: "clothing", sourceName: "Deshal", names: ["Deshal", "দেশাল"] },
  { id: "dorjibari", label: "Dorjibari", group: "clothing", sourceName: "Dorjibari" },
  { id: "easy", label: "Easy", group: "clothing", sourceName: "Easy" },
  { id: "ecstasy", label: "Ecstasy", group: "clothing", sourceName: "Ecstasy" },
  { id: "fit-elegance", label: "Fit Elegance", group: "clothing", sourceName: "Fit Elegance" },
  { id: "fortune", label: "Fortune", group: "footwear", sourceName: "Fortune", names: ["Fortune Shoes", "Fortune Gallery"] },
  { id: "gentle-park", label: "Gentle Park", group: "clothing", sourceName: "Gentle Park" },
  { id: "illiyeen", label: "Illiyeen", group: "clothing", sourceName: "Illiyeen" },
  { id: "infinity", label: "Infinity", group: "clothing", sourceName: "Infinity" },
  { id: "jennys", label: "Jennys", group: "footwear", sourceName: "Jennys", names: ["Jennys", "Jenny's"] },
  { id: "kay-kraft", label: "Kay Kraft", group: "clothing", sourceName: "Kay Kraft" },
  { id: "le-reve", label: "Le Reve", group: "clothing", sourceName: "Le Reve" },
  { id: "live-shopping", label: "Live Shopping", group: "clothing", sourceName: "Live Shopping" },
  { id: "lotto", label: "Lotto", group: "footwear", sourceName: "Lotto" },
  { id: "lubnan", label: "Lubnan", group: "clothing", sourceName: "Lubnan" },
  { id: "mens-world", label: "Mens World", group: "clothing", sourceName: "Mens World" },
  { id: "orion", label: "Orion", group: "footwear", sourceName: "Orion" },
  { id: "othoba", label: "Othoba", group: "online", sourceName: "Othoba" },
  { id: "plus-point", label: "Plus Point", group: "clothing", sourceName: "Plus Point" },
  { id: "rang", label: "Rang Bangladesh", group: "clothing", sourceName: "Rang Bangladesh", names: ["Rang Bangladesh", "রং বাংলাদেশ"] },
  { id: "richman", label: "Richman", group: "clothing", sourceName: "Richman" },
  { id: "sara", label: "Sara", group: "clothing", sourceName: "Sara", names: ["Sara Lifestyle"] },
  { id: "shajgoj", label: "Shajgoj", group: "beauty", sourceName: "Shajgoj" },
  { id: "shwapno", label: "Shwapno", group: "supermarket", sourceName: "Shwapno" },
  { id: "step", label: "Step", group: "footwear", sourceName: "Step" },
  { id: "twelve", label: "Twelve", group: "clothing", sourceName: "Twelve" },
  { id: "walkar", label: "Walkar", group: "footwear", sourceName: "Walkar", names: ["Walkar", "ওয়াকার"] },
  { id: "yellow", label: "Yellow", group: "clothing", sourceName: "Yellow" },
];

// The Brands menu's groups, in menu order.
export const STORE_GROUPS = [
  { id: "clothing", label: "Clothing", icon: "👕" },
  { id: "footwear", label: "Shoes & bags", icon: "👟" },
  { id: "online", label: "Online shops", icon: "🛒" },
  { id: "supermarket", label: "Supermarkets", icon: "🧺" },
  { id: "beauty", label: "Beauty & health", icon: "💄" },
];
export const STORE_IDS = STORES.map((s) => s.id);

export function categoryLabel(id) {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export const VALIDATION_STATUSES = ["active", "unverified", "expired", "unavailable"];
export const REVIEW_STATES = ["pending", "approved", "rejected"];

export const SOURCE_TYPES = [
  { id: "official_website", label: "Official Website" },
  { id: "campaign_page", label: "Campaign Page" },
  { id: "social_media", label: "Social Media" },
  { id: "news", label: "News" },
  { id: "business_submitted", label: "Business Submitted" },
  { id: "other", label: "Other Public Source" },
];
export const SOURCE_TYPE_IDS = SOURCE_TYPES.map((s) => s.id);

export function sourceTypeLabel(id) {
  return SOURCE_TYPES.find((s) => s.id === id)?.label ?? id;
}

// Bank and card offers filter: banks' card offers and mobile wallets (MFS).
// An offer belongs to one when it came from its own site (`sourceName` matches
// the site name in discovery/config.js) or its title names it, as news-sourced
// offers and shop pages do ("… with BRAC Bank cards", "bKash cashback").
// City Bank is left out: its offers are only in a JavaScript app
// (americanexpress.com/en-bd), so we cannot show them. bKash's site is behind a
// bot check, so its offers come from news and shop pages.
// The order here is also the order these offers are listed in (query.js).
export const BANKS = [
  { id: "ebl", label: "EBL", group: "bank", sourceName: "EBL", names: ["EBL", "Eastern Bank"] },
  { id: "mbl", label: "Mercantile Bank", group: "bank", sourceName: "Mercantile Bank", names: ["Mercantile Bank", "MBL"] },
  { id: "ific", label: "IFIC Bank", group: "bank", sourceName: "IFIC Bank", names: ["IFIC"] },
  { id: "brac", label: "BRAC Bank", group: "bank", sourceName: "BRAC Bank", names: ["BRAC Bank"] },
  { id: "bank-asia", label: "Bank Asia", group: "bank", sourceName: "Bank Asia", names: ["Bank Asia"] },
  { id: "mtb", label: "MTB", group: "bank", sourceName: "Mutual Trust Bank", names: ["MTB", "Mutual Trust Bank"] },
  { id: "bkash", label: "bKash", group: "mfs", sourceName: "bKash", names: ["bKash", "বিকাশ"] },
];
export const BANK_IDS = BANKS.map((b) => b.id);

// The Bank & card offers menu's groups, in menu order.
export const BANK_GROUPS = [
  { id: "bank", label: "Bank", icon: "🏦" },
  { id: "mfs", label: "MFS", icon: "📱" },
];

/** "EBL card offers", "bKash offers". */
export const bankOffersLabel = (bank) => `${bank.label}${bank.group === "bank" ? " card" : ""} offers`;

// online = online only, in_store = physical only, both = online and in store
export const AVAILABILITY_TYPES = ["online", "in_store", "both"];

// local = specific branches, city = whole city, national = whole country, online = no geography
export const SCOPES = ["local", "city", "national", "online"];

export const DISCOUNT_TYPES = ["none", "percent", "amount", "bogo", "fixed_price", "other"];

export const VALIDITY_MODES = [
  { id: "today", label: "Valid today" },
  { id: "starting_today", label: "Starting today" },
  { id: "ending_today", label: "Ending today" },
  { id: "week", label: "Valid this week" },
  { id: "ongoing", label: "Ongoing (no end date)" },
  { id: "custom", label: "Custom dates" },
];

export const SORTS = [
  { id: "newest", label: "Newest" },
  { id: "nearest", label: "Nearest" },
  { id: "ending", label: "Ending soonest" },
  { id: "discount", label: "Highest discount" },
  { id: "verified", label: "Recently verified" },
];

export const RADIUS_OPTIONS = [
  { id: "5", label: "5 km" },
  { id: "10", label: "10 km" },
  { id: "25", label: "25 km" },
  { id: "50", label: "50 km" },
  { id: "city", label: "Entire city" },
  { id: "country", label: "Entire country" },
];
