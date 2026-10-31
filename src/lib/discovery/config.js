// Where automatic discovery looks for offers. Edit this list to add sources.
//
// feeds:    RSS feeds; every item whose title/summary mentions an offer is queued.
// searches: Bing News RSS queries (allowed by Bing's robots.txt; links carry the
//           publisher URL). Google News RSS is not used: its robots.txt
//           disallows /rss and its links only resolve with JavaScript.
// sites:    business websites (banks' card offers, hotels, resorts). Each entry
//           can use any of:
//             url + linkPattern        listing page; matching same-site links are queued
//             sitemap + sitemapPattern sitemap (or index); matching URL paths are queued
//             pages                    pages that themselves list many offers
//             recheckDays              re-read already processed pages after N days
//             title                    page title for offer pages that have none
//             note                     extra instruction for the AI reading these pages
//             category                 category every offer from this site goes in
//             adapter                  site-specific reader: "ebl" (ebl.js) or "ific" (ific.js)
//           Only sites that render offers in plain HTML work (no JavaScript is
//           executed), and robots.txt is always respected.

export const DISCOVERY_REGION = {
  country: "BD",
  timezone: "Asia/Dhaka",
  name: "Bangladesh",
};

// Feeds and searches are kept only while they find offers: news is read by the
// AI one article at a time, so a source that yields nothing just uses quota.
// Dropped for finding no offers: The Daily Star (both feeds), The Business
// Standard, Prothom Alo English and Jago News feeds; the "ছাড় অফার" search.
export const FEEDS = [{ url: "https://www.prothomalo.com/feed", name: "Prothom Alo" }];

export const SEARCHES = [
  "discount offer Dhaka",
  "discount Bangladesh restaurant",
  "cashback offer Bangladesh",
  "card offer discount Bangladesh",
  "buy one get one Dhaka",
  "sale offer Bangladesh brand",
  "ডিসকাউন্ট",
  "মূল্যছাড়",
  "ক্যাশব্যাক অফার",
  // City Bank lists its offers only in a JavaScript app, so they are found through news.
  "City Bank Amex offer",
  "City Bank American Express discount",
  "IFIC Bank card offer",
  // kfcbd.com disallows all crawlers in robots.txt, so KFC deals come from news.
  "KFC Bangladesh offer",
  "KFC Dhaka deal",
];

// Bangla searches mostly return Indian (West Bengal) outlets writing about
// Flipkart, Amazon and Indian car deals. Their articles are dropped before the
// AI reads them. Matched against the article's host and its parent domains.
export const SKIPPED_NEWS_HOSTS = [
  "msn.com",
  "news18.com",
  "91mobiles.com",
  "digit.in",
  "abplive.com",
  "aajtak.in",
  "asianetnews.com",
  "bartamanpatrika.com",
  "anandabazar.com",
  "sangbadpratidin.in",
  "eisamay.com",
  "tv9bangla.com",
  "zeenews.india.com",
  "hindustantimes.com",
  "indianexpress.com",
  "thewall.in",
];

// Shop sale pages list dozens of discounted products; one offer per page is
// enough for the directory and keeps the shop from flooding it.
const SHOP_SALE_NOTE =
  "This is an online shop's sale or campaign page listing many discounted products. Return at most ONE offer that summarises the sale (e.g. 'Up to 30% off Dabur products at Shajgoj'), with the highest discount shown as discountValue, not one offer per product.";

// Arogga is mainly a pharmacy; only its beauty and personal care sales are wanted.
const BEAUTY_ONLY_NOTE = `${SHOP_SALE_NOTE} Only consider beauty and personal care products (skincare, haircare, makeup, body care, fragrance, grooming). Ignore medicines, supplements, vitamins, medical devices and baby food, and base the discount only on the beauty products. If the page has no beauty or personal care products on sale, return no offer. Start the title with the sale's own name shown on the page (e.g. 'Beauty Steals: up to 64% off beauty products at Arogga').`;

// Words in a URL that mark hotel, dining and other card-offer pages.
const OFFERISH = "(offer|discount|deal|hotel|resort|buffet|dine|dining|restaurant|cafe|spa|stay|package)";

export const SITES = [
  // Banks: card discounts at restaurants, hotels, resorts and shops.
  {
    name: "BRAC Bank",
    url: "https://www.bracbank.com/en/offers",
    linkPattern: /^\/(en\/)?offers\/[a-z0-9-]+$/,
    sitemap: "https://www.bracbank.com/sitemap.xml",
    sitemapPattern: new RegExp(`^/(en/offers/[a-z0-9-]+|en/page/[a-z0-9-]*${OFFERISH}[a-z0-9-]*)$`),
  },
  {
    name: "Mutual Trust Bank",
    sitemap: "https://www.mutualtrustbank.com/discountpartners-sitemap.xml",
    sitemapPattern: /^\/discount-partners\/[a-z0-9-]+\/?$/,
    pages: [
      "https://www.mutualtrustbank.com/cards/card-offers-for-coxs-bazar/",
      "https://www.mutualtrustbank.com/cards/complimentary-companion-dining/",
    ],
  },
  {
    name: "Mutual Trust Bank",
    sitemap: "https://www.mutualtrustbank.com/privilegepartners-sitemap.xml",
    sitemapPattern: /^\/privilege-partners\/[a-z0-9-]+\/?$/,
  },
  {
    // Partner details load with a form post, so a dedicated reader handles them.
    name: "EBL",
    url: "https://www.ebl.com.bd/retail/ebl-discount-partners",
    adapter: "ebl",
    recheckDays: 14,
  },
  {
    // One page lists every IFIC card discount (about 60 merchants), too many
    // for one AI answer, so each table row is read on its own.
    name: "IFIC Bank",
    pages: ["https://ificbank.com.bd/discount-offers"],
    adapter: "ific",
    recheckDays: 7,
  },
  // Mercantile Bank: each tab lists offer links whose detail pages are bare
  // fragments without a <title>, so `title` says what the page is.
  {
    name: "Mercantile Bank",
    url: "https://www.mblbd.com/cards-offer",
    linkPattern: /^\/home\/offerdetails\/\d+$/,
    title: "Mercantile Bank (MBL) card discount offer",
    recheckDays: 14,
  },
  {
    name: "Mercantile Bank",
    url: "https://www.mblbd.com/bogo-offers",
    linkPattern: /^\/home\/offerdetails\/\d+$/,
    title: "Mercantile Bank (MBL) card buy-one-get-one offer",
    recheckDays: 14,
  },
  {
    name: "Mercantile Bank",
    url: "https://www.mblbd.com/simplePay",
    linkPattern: /^\/home\/offerdetails\/\d+$/,
    title: "Mercantile Bank (MBL) SimplePay 0% EMI card offer",
    recheckDays: 14,
  },
  {
    // Store-wide sales only (11.11, Eid, Puja, payday Mega Deals), read from the
    // home page banners and their images; product and brand banners are skipped.
    name: "Daraz",
    url: "https://www.daraz.com.bd/",
    adapter: "daraz",
    recheckDays: 1,
    note: "These are banners from Daraz's home page for ONE store-wide sale campaign. Return at most ONE offer for the campaign as a whole (e.g. 'Daraz 11.11 Sale: up to 90% off'), using what the banner images say: the biggest discount, vouchers, free delivery and dates. Title it with Daraz and the sale's name. Use availabilityType online and scope online. A store-wide sale covers everything, so use primaryCategory electronics with otherCategories fashion, home and beauty, unless the banners are about one kind of product only. If the banners only promote a single product or brand, or nothing says there is a sale, return no offer.",
  },
  // Beauty and personal care shops: the brand and campaign sale pages linked
  // from their home pages.
  {
    name: "Shajgoj",
    url: "https://shop.shajgoj.com/",
    linkPattern: /^\/([a-z0-9-]+-deals|product-category\/(offers|[a-z0-9-]*(deal|sale|bogo|buy-1-get-1)[a-z0-9-]*))$/,
    note: SHOP_SALE_NOTE,
    category: "beauty",
    recheckDays: 3,
  },
  {
    name: "Arogga",
    url: "https://www.arogga.com/",
    linkPattern: /^\/category-home\/[a-z0-9-]*campaign$/,
    note: BEAUTY_ONLY_NOTE,
    category: "beauty",
    recheckDays: 3,
  },
  {
    name: "LankaBangla Finance",
    url: "https://www.lankabangla.com/",
    linkPattern: /^\/[a-z0-9-]*offer\/?$/,
    recheckDays: 7,
  },
  // Hotels and resorts.
  {
    name: "Sayeman Beach Resort",
    pages: ["https://www.sayemanresort.com/special-offer-package-deal-dicount-honeymoon-couple-family-low-rate-best-rate/"],
  },
  {
    name: "Grand Sultan Tea Resort & Golf",
    url: "https://www.grandsultanresort.com/special-offers/",
    linkPattern: /^\/(grandsultan\/)?(special-)?offers\/[a-z0-9-]+\/?$/,
    pages: ["https://www.grandsultanresort.com/special-offers/"],
    recheckDays: 14,
  },
];
