// Shared constants used by both server and client code.

export const CATEGORIES = [
  { id: "electronics", label: "Electronics", icon: "📱" },
  { id: "fashion", label: "Clothing & Fashion", icon: "👗" },
  { id: "footwear", label: "Shoes & Footwear", icon: "👟" },
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
