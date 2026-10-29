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
//           Only sites that render offers in plain HTML work (no JavaScript is
//           executed), and robots.txt is always respected.

export const DISCOVERY_REGION = {
  country: "BD",
  timezone: "Asia/Dhaka",
  name: "Bangladesh",
};

export const FEEDS = [
  { url: "https://www.thedailystar.net/rss.xml", name: "The Daily Star" },
  { url: "https://www.thedailystar.net/business/rss.xml", name: "The Daily Star" },
  { url: "https://www.tbsnews.net/rss.xml", name: "The Business Standard" },
  { url: "https://en.prothomalo.com/feed", name: "Prothom Alo English" },
  { url: "https://www.prothomalo.com/feed", name: "Prothom Alo" },
  { url: "https://www.jagonews24.com/rss/rss.xml", name: "Jago News 24" },
];

export const SEARCHES = [
  "discount offer Dhaka",
  "discount Bangladesh restaurant",
  "cashback offer Bangladesh",
  "card offer discount Bangladesh",
  "buy one get one Dhaka",
  "sale offer Bangladesh brand",
  "ছাড় অফার",
  "মূল্যছাড়",
  "ক্যাশব্যাক অফার",
];

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
