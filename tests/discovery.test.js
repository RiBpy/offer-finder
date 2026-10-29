import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFeed, unwrapBingLink, looksLikeOffer, listingLinks, parseSitemap } from "../src/lib/discovery/feeds.js";
import { SITES } from "../src/lib/discovery/config.js";
import { decidePublication, toOfferInput } from "../src/lib/discovery/publish.js";
import { normalizeOfferInput } from "../src/lib/offers/model.js";

const region = { country: "BD", timezone: "Asia/Dhaka", name: "Bangladesh" };
const now = new Date("2026-10-28T06:00:00Z");

test("parses RSS items with CDATA, entities and Bing source tags", () => {
  const xml = `<rss><channel>
    <item><title><![CDATA[Nagad users get 10% discount on Novoair]]></title>
      <link>http://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;url=https%3a%2f%2fwww.thedailystar.net%2fbusiness%2fnagad-novoair&amp;c=1</link>
      <description>Customers &amp;amp; travellers save</description><pubDate>Sun, 25 Oct 2026 18:00:00 GMT</pubDate>
      <News:Source>The Daily Star</News:Source></item>
    <item><title>No link here</title></item>
  </channel></rss>`;
  const items = parseFeed(xml);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Nagad users get 10% discount on Novoair");
  assert.equal(items[0].sourceName, "The Daily Star");
  assert.equal(items[0].publishedAt.toISOString(), "2026-10-25T18:00:00.000Z");
  assert.equal(unwrapBingLink(items[0].link), "https://www.thedailystar.net/business/nagad-novoair");
  assert.equal(unwrapBingLink("https://example.com/a"), "https://example.com/a");
});

test("offer prefilter matches English and Bangla, skips unrelated news", () => {
  assert.ok(looksLikeOffer("Get 20% off at Pizza Hut"));
  assert.ok(looksLikeOffer("ঈদে ৩০ শতাংশ ছাড়"));
  assert.ok(looksLikeOffer("bKash cashback on recharge"));
  assert.ok(!looksLikeOffer("Parliament session begins", "Lawmakers met on Sunday"));
});

test("listing links keep same-site paths that match the pattern", () => {
  const html = `<a href="/offers/cinnabon-offer">A</a><a href="/en/offers">list</a>
    <a href="https://www.bracbank.com/offers/mana-bay-offer?utm_source=x">B</a><a href="https://other.com/offers/x">C</a>`;
  const links = listingLinks(html, "https://www.bracbank.com/en/offers", /^\/(en\/)?offers\/[a-z0-9-]+$/);
  assert.deepEqual(links.sort(), ["https://www.bracbank.com/offers/cinnabon-offer", "https://www.bracbank.com/offers/mana-bay-offer"]);
});

test("sitemaps and indexes are parsed, and site patterns pick offer pages", () => {
  const index = parseSitemap(`<sitemapindex><sitemap><loc>https://x.com/a.xml</loc></sitemap></sitemapindex>`);
  assert.deepEqual(index, { isIndex: true, urls: ["https://x.com/a.xml"] });
  const map = parseSitemap(`<urlset><url><loc> https://x.com/p?a=1&amp;b=2 </loc></url></urlset>`);
  assert.deepEqual(map, { isIndex: false, urls: ["https://x.com/p?a=1&b=2"] });

  const brac = SITES.find((s) => s.name === "BRAC Bank").sitemapPattern;
  assert.ok(brac.test("/en/page/brac-bank-amazing-discounts-at-numerous-hotels-and-resorts"));
  assert.ok(brac.test("/en/offers/cinnabon-offer"));
  assert.ok(!brac.test("/en/page/financial-literacy-program"));
});

const extracted = {
  title: "15% off at Cinnabon with BRAC Bank cards",
  brandName: "BRAC Bank",
  businessName: "Cinnabon",
  description: "Card holders get up to 15% off.",
  terms: "Visa Infinite and Signature cards get 15%, other cards 10%.",
  primaryCategory: "food",
  discountType: "percent",
  discountValue: 15,
  discountText: "Up to 15% off",
  currency: null,
  startDate: null,
  endDate: null,
  availabilityType: "in_store",
  scope: "local",
  city: "Dhaka",
  country: "BD",
  branches: [{ name: "Banani", address: "Nilufar Heights, Kamal Ataturk Avenue, Banani", city: "Dhaka" }],
  evidenceQuote: "Enjoy Up to 15% Discount at Cinnabon with your BRAC Bank Cards!",
  confidence: 0.9,
};

test("publication decision: confident current offers publish, others are held or skipped", () => {
  const ctx = { sourceType: "official_website", publishedAt: null, now, region };
  assert.equal(decidePublication(extracted, ctx).action, "publish");
  assert.equal(decidePublication({ ...extracted, confidence: 0.4 }, ctx).action, "hold");
  assert.equal(decidePublication({ ...extracted, discountType: "none" }, ctx).action, "hold");
  assert.equal(decidePublication({ ...extracted, endDate: "2026-10-01" }, ctx).action, "skip");
  assert.equal(decidePublication({ ...extracted, endDate: "2026-11-15" }, ctx).action, "publish");
  // Old news without an end date is not trusted; recent news is.
  const news = { sourceType: "news", now, region };
  assert.equal(decidePublication(extracted, { ...news, publishedAt: new Date("2026-08-01T00:00:00Z") }).action, "hold");
  assert.equal(decidePublication(extracted, { ...news, publishedAt: new Date("2026-10-20T00:00:00Z") }).action, "publish");
});

test("extracted offers map to valid offer input", () => {
  const ctx = { url: "https://www.bracbank.com/en/offers/cinnabon-offer", sourceName: "BRAC Bank", sourceType: "official_website", publishedAt: null, region };
  const input = toOfferInput({ ...extracted, endDate: "2026-12-31" }, ctx);
  // Geocoding is done separately; without coordinates the offer is city-wide.
  const { fields } = normalizeOfferInput({ ...input, scope: "city", validationStatus: "active", reviewState: "approved", evidenceNote: "quote" }, { now });
  assert.equal(fields.discountValue, 15);
  assert.equal(fields.endDate.toISOString(), "2026-12-31T17:59:59.999Z");
  assert.equal(fields.sourceOfferId, "15-off-at-cinnabon-with-brac-bank-cards");
  // Amounts without a currency, and percents over 100, fall back to "other".
  assert.equal(toOfferInput({ ...extracted, discountType: "amount", discountValue: 200, currency: null }, ctx).discountType, "other");
  assert.equal(toOfferInput({ ...extracted, discountValue: 150 }, ctx).discountType, "other");
  assert.equal(toOfferInput({ ...extracted, endDate: "31 Oct" }, ctx).endDate, null);
  // Dining at a hotel also counts as a hotel offer.
  const buffet = toOfferInput({ ...extracted, title: "Buffet dinner at The Westin Dhaka", businessName: "The Westin Dhaka", otherCategories: ["bogus"] }, ctx);
  assert.deepEqual(buffet.categories, ["hotels"]);
  assert.deepEqual(toOfferInput(extracted, ctx).categories, []);
});
