import { test } from "node:test";
import assert from "node:assert/strict";
import { dayRangeInZone, endOfDayInZone, startOfDayInZone, todayYmd, isYmd } from "../src/lib/dates.js";
import { canonicalizeUrl, titleSimilarity } from "../src/lib/dedupe.js";
import { classifyOffer } from "../src/lib/classify.js";
import { normalizeOfferInput, ValidationError } from "../src/lib/offers/model.js";
import { parseOfferQuery } from "../src/lib/offers/query.js";
import { effectiveStatus } from "../src/lib/offers/status.js";
import { extractFromHtml, detectEndedLanguage } from "../src/lib/extract/html.js";
import { parseRobots, isAllowedByRobots, isPrivateIp } from "../src/lib/sources/fetcher.js";
import { decideVerification } from "../src/lib/verify/verifier.js";
import { hashPassword, verifyPassword, createSessionToken, verifySessionToken } from "../src/lib/auth/session.js";
import { haversineKm } from "../src/lib/geo.js";

process.env.SESSION_SECRET = "x".repeat(40);

test("day boundaries respect timezone and DST", () => {
  assert.equal(startOfDayInZone("2026-10-25", "Asia/Dhaka").toISOString(), "2026-10-24T18:00:00.000Z");
  assert.equal(startOfDayInZone("2026-10-25", "UTC").toISOString(), "2026-10-25T00:00:00.000Z");
  // Europe/London leaves BST on 2026-10-25: the day is 25 hours long.
  const r = dayRangeInZone("2026-10-25", "Europe/London");
  assert.equal(r.start.toISOString(), "2026-10-24T23:00:00.000Z");
  assert.equal(r.end.toISOString(), "2026-10-26T00:00:00.000Z");
  assert.equal(endOfDayInZone("2026-10-31", "Asia/Dhaka").toISOString(), "2026-10-31T17:59:59.999Z");
  assert.equal(todayYmd("Asia/Dhaka", new Date("2026-10-24T19:00:00Z")), "2026-10-25");
  assert.ok(isYmd("2026-02-28"));
  assert.ok(!isYmd("2026-02-30"));
});

test("canonical URLs drop tracking params, fragments and trailing slashes", () => {
  assert.equal(
    canonicalizeUrl("https://Shop.Example.com:443/sale/?utm_source=fb&b=2&a=1#top"),
    "https://shop.example.com/sale?a=1&b=2",
  );
  assert.equal(canonicalizeUrl("not a url"), null);
});

test("title similarity flags near-duplicates", () => {
  assert.ok(titleSimilarity("Lotto Eid Sale: 30% off all shoes", "30% off all shoes - Lotto Eid sale") > 0.8);
  assert.ok(titleSimilarity("Pizza buffet Friday", "Laptop clearance") < 0.2);
});

test("classifier picks sensible categories and brand-wide flag", () => {
  const c = classifyOffer({ title: "Apex storewide sale: 20% off sneakers and sandals", brandName: "Apex" });
  assert.equal(c.primaryCategory, "footwear");
  assert.equal(c.isBrandOffer, true);
  assert.equal(classifyOffer({ title: "Weekend buffet dinner at Sky Restaurant" }).primaryCategory, "food");
  assert.equal(classifyOffer({ title: "Staycation package at Ocean Resort" }).primaryCategory, "hotels");
});

const validInput = {
  title: "20% off all laptops",
  sourceUrl: "https://example.com/laptop-sale?utm_source=x",
  sourceType: "official_website",
  primaryCategory: "electronics",
  availabilityType: "both",
  scope: "national",
  country: "bd",
  timezone: "Asia/Dhaka",
  discountType: "percent",
  discountValue: "20",
  endDate: "2026-10-31",
  validationStatus: "active",
  reviewState: "approved",
  evidenceNote: "Page states valid until 31 October 2026",
};

test("offer input is normalised", () => {
  const { fields } = normalizeOfferInput(validInput, { now: new Date("2026-10-25T08:00:00Z") });
  assert.equal(fields.country, "BD");
  assert.equal(fields.discountValue, 20);
  assert.equal(fields.endDate.toISOString(), "2026-10-31T17:59:59.999Z");
  assert.equal(fields.canonicalUrl, "https://example.com/laptop-sale");
  assert.deepEqual(fields.categories, ["electronics"]);
});

test("offer input rejects invented or inconsistent data", () => {
  const now = new Date("2026-10-25T08:00:00Z");
  const bad = (patch) => {
    try {
      normalizeOfferInput({ ...validInput, ...patch }, { now });
      return null;
    } catch (e) {
      assert.ok(e instanceof ValidationError);
      return e.errors;
    }
  };
  assert.ok(bad({ evidenceNote: "" }).evidenceNote, "active needs evidence");
  assert.ok(bad({ endDate: "2026-10-20" }).validationStatus, "past end date cannot be active");
  assert.ok(bad({ originalPrice: "100", discountedPrice: "120", currency: "BDT" }).discountedPrice);
  assert.ok(bad({ scope: "local" }).eligibleLocations, "local offers need coordinates");
  assert.ok(bad({ eligibleLocations: [{ latitude: 200, longitude: 0 }] })["eligibleLocations.0"]);
  assert.ok(bad({ discountValue: "" }).discountValue, "percent discount needs a value");
  assert.ok(bad({ startDate: "2026-11-05" }).endDate, "end before start");
});

test("query parsing validates and defaults", () => {
  const now = new Date("2026-10-25T08:00:00Z");
  const { params } = parseOfferQuery(new URLSearchParams("lat=23.81234&lng=90.41256&tz=Asia/Dhaka"), now);
  assert.equal(params.date, "2026-10-25");
  assert.equal(params.location.lat, 23.812);
  assert.equal(params.radiusKm, 25);
  assert.equal(params.mode, "today");
  assert.equal(params.includeNational, true);
  assert.ok(parseOfferQuery(new URLSearchParams("lat=999&lng=1"), now).errors.location);
  assert.ok(parseOfferQuery(new URLSearchParams("validity=custom&from=2026-10-10"), now).errors.range);
  assert.ok(parseOfferQuery(new URLSearchParams("radius=city"), now).errors.radius);
  assert.ok(parseOfferQuery(new URLSearchParams("category=nope"), now).errors.category);
});

test("effective status hides expired and stale offers", () => {
  const now = new Date("2026-10-25T08:00:00Z");
  assert.equal(effectiveStatus({ validationStatus: "active", endDate: new Date("2026-10-25T07:00:00Z") }, now), "expired");
  assert.equal(effectiveStatus({ validationStatus: "active", endDate: null, lastVerifiedAt: new Date("2026-10-01") }, now), "unverified");
  assert.equal(effectiveStatus({ validationStatus: "active", endDate: null, lastVerifiedAt: new Date("2026-10-24") }, now), "active");
});

test("HTML extraction reads JSON-LD and Open Graph without guessing", () => {
  const html = `<html><head><title>Ignored &amp; title</title>
    <meta property="og:title" content="Big Eid Sale &amp; More">
    <meta name="description" content="Up to 40% off.">
    <meta property="og:image" content="/img/sale.jpg">
    <link rel="canonical" href="https://shop.example.com/eid-sale">
    <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Product","name":"Shoes","brand":{"@type":"Brand","name":"Lotto"},
      "offers":{"@type":"Offer","price":"1,990","priceCurrency":"bdt","validFrom":"2026-10-20","validThrough":"2026-11-02T23:59:00+06:00"}}]}</script>
    </head><body><h1>Sale</h1><script>var x = "offer has expired";</script></body></html>`;
  const x = extractFromHtml(html, "https://shop.example.com/eid-sale?utm_source=x");
  assert.equal(x.title, "Big Eid Sale & More");
  assert.equal(x.brandName, "Lotto");
  assert.equal(x.price, 1990);
  assert.equal(x.currency, "BDT");
  assert.equal(x.validThrough.toISOString(), "2026-11-02T17:59:00.000Z");
  assert.equal(x.imageUrl, "https://shop.example.com/img/sale.jpg");
  assert.equal(x.canonicalUrl, "https://shop.example.com/eid-sale");
  assert.equal(x.endedLanguage, null, "script contents are not visible text");
  const plain = extractFromHtml("<title>Hello</title><p>Nothing here</p>", "https://a.example/");
  assert.equal(plain.validThrough, null);
  assert.equal(plain.structuredData, false);
  assert.equal(detectEndedLanguage("Sorry, this promotion has ended."), "this promotion has ended");
});

test("robots.txt parsing", () => {
  const rules = parseRobots(`User-agent: *\nDisallow: /private\nAllow: /private/offers\n\nUser-agent: BadBot\nDisallow: /`);
  assert.ok(isAllowedByRobots(rules, "/offers"));
  assert.ok(!isAllowedByRobots(rules, "/private/x"));
  assert.ok(isAllowedByRobots(rules, "/private/offers/1"));
  const own = parseRobots(`User-agent: *\nAllow: /\nUser-agent: OfferFinderBot\nDisallow: /`);
  assert.ok(!isAllowedByRobots(own, "/anything"));
  assert.ok(isAllowedByRobots(parseRobots("User-agent: *\nDisallow:"), "/x"));
});

test("private addresses are blocked", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.1.1", "172.20.0.1", "169.254.169.254", "::1", "fd00::1", "::ffff:127.0.0.1"])
    assert.ok(isPrivateIp(ip), ip);
  assert.ok(!isPrivateIp("93.184.216.34"));
});

test("verification never treats a reachable page as proof of validity", () => {
  const now = new Date("2026-10-25T08:00:00Z");
  const offer = { validationStatus: "active", endDate: null, lastVerifiedAt: new Date("2026-10-10") };
  const reachable = decideVerification(offer, { httpStatus: 200, extracted: {} }, now);
  assert.equal(reachable.set.validationStatus, "unverified");
  assert.equal(reachable.set.lastVerifiedAt, undefined);
  assert.equal(decideVerification(offer, { httpStatus: 404 }, now).set.validationStatus, "unavailable");
  assert.equal(decideVerification({ ...offer, endDate: new Date("2026-10-24") }, {}, now).set.validationStatus, "expired");
  const structured = decideVerification(offer, { httpStatus: 200, extracted: { validThrough: new Date("2026-11-01") } }, now);
  assert.equal(structured.set.lastVerifiedAt, now);
  assert.equal(decideVerification(offer, { error: "timeout", errorCode: "TIMEOUT" }, now).failed, true);
  assert.equal(decideVerification(offer, { httpStatus: 200, extracted: { endedLanguage: "offer has expired" } }, now).set.validationStatus, "unverified");
});

test("passwords and sessions", () => {
  const h = hashPassword("correct horse");
  assert.ok(verifyPassword("correct horse", h));
  assert.ok(!verifyPassword("wrong", h));
  const t = createSessionToken("a@b.c");
  assert.equal(verifySessionToken(t).sub, "a@b.c");
  assert.equal(verifySessionToken(t.slice(0, -2) + "xx"), null);
  assert.equal(verifySessionToken(createSessionToken("a@b.c", Date.now() - 9 * 3600 * 1000)), null);
});

test("haversine distance", () => {
  // Dhaka (Shahbag) to Gulshan is roughly 6 km.
  const d = haversineKm(23.7383, 90.3958, 23.7925, 90.4078);
  assert.ok(d > 5.5 && d < 6.5, String(d));
});
