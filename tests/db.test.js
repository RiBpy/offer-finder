// Integration tests against a real MongoDB server. Uses a throwaway database
// that is dropped afterwards. Skips when no server is reachable.
//   MONGODB_TEST_URI=mongodb://127.0.0.1:27017 npm test

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = process.env.MONGODB_TEST_URI || "mongodb://127.0.0.1:27017";
process.env.MONGODB_DB = `offer_finder_test_${process.pid}`;
process.env.FETCH_ALLOW_PRIVATE_HOSTS = "1";

const { getDb, closeDb } = await import("../src/lib/db/mongo.js");
const repo = await import("../src/lib/offers/repository.js");
const { parseOfferQuery, searchOffers } = await import("../src/lib/offers/query.js");
const { draftFromUrl } = await import("../src/lib/offers/discover.js");
const { verifyOffer } = await import("../src/lib/verify/verifier.js");
const { expireOffers } = await import("../src/lib/jobs/revalidate.js");

let db;
let server;
let base;
const NOW = new Date();
const day = 24 * 3600 * 1000;
const ymd = (d) => d.toISOString().slice(0, 10);

// Local stand-in for a business website, so fetch/extract/verify run for real.
const pages = {
  "/robots.txt": [200, "text/plain", "User-agent: *\nDisallow: /blocked\n"],
  "/sale": [200, "text/html", `<html><head><title>Mega Sneaker Sale</title><meta property="og:title" content="Apex Mega Sneaker Sale: 30% off">
    <meta name="description" content="30% off all sneakers storewide."><link rel="canonical" href="/sale">
    <script type="application/ld+json">{"@type":"Offer","validThrough":"${new Date(NOW.getTime() + 5 * day).toISOString()}","priceCurrency":"BDT"}</script></head><body>Sale</body></html>`],
  "/ended": [200, "text/html", "<html><title>Promo</title><body><p>Sorry, this promotion has ended.</p></body></html>"],
  "/blocked": [200, "text/html", "<title>Hidden</title>"],
};

async function reachable() {
  try {
    db = await getDb();
    return true;
  } catch {
    return false;
  }
}

const available = await reachable();
const t = available ? test : test.skip;

before(async () => {
  if (!available) return;
  server = http.createServer((req, res) => {
    const p = pages[req.url.split("?")[0]];
    if (!p) {
      res.writeHead(404, { "Content-Type": "text/html" });
      return res.end("not found");
    }
    res.writeHead(p[0], { "Content-Type": p[1] });
    res.end(p[2]);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (!available) return;
  await db.dropDatabase();
  await closeDb();
  server.close();
});

const DHAKA = { lat: 23.7808, lng: 90.4093 }; // Gulshan/Banani area
const common = {
  sourceType: "official_website",
  availabilityType: "in_store",
  timezone: "Asia/Dhaka",
  validationStatus: "active",
  reviewState: "approved",
  evidenceNote: "Source page states the validity period",
  country: "BD",
};

async function seed() {
  const mk = (o) => repo.createOffer(db, { ...common, ...o });
  return {
    near: await mk({
      title: "Buffet dinner 25% off at Gulshan branch",
      sourceUrl: "https://r.example/buffet",
      primaryCategory: "food",
      scope: "local",
      discountType: "percent",
      discountValue: 25,
      endDate: ymd(new Date(NOW.getTime() + 3 * day)),
      eligibleLocations: [{ name: "Gulshan 2", city: "Dhaka", latitude: 23.7925, longitude: 90.4078 }],
      city: "Dhaka",
    }),
    far: await mk({
      title: "Chattogram resort weekend package",
      sourceUrl: "https://h.example/resort",
      primaryCategory: "hotels",
      scope: "local",
      endDate: ymd(new Date(NOW.getTime() + 20 * day)),
      eligibleLocations: [{ name: "Beach resort", city: "Chattogram", latitude: 22.3569, longitude: 91.7832 }],
      city: "Chattogram",
    }),
    national: await mk({
      title: "Lotto storewide 30% off all shoes",
      sourceUrl: "https://lotto.example/sale",
      primaryCategory: "footwear",
      brandName: "Lotto",
      isBrandOffer: true,
      scope: "national",
      availabilityType: "both",
      discountType: "percent",
      discountValue: 30,
      endDate: ymd(new Date(NOW.getTime() + 10 * day)),
    }),
    online: await mk({
      title: "Laptop flash sale online",
      sourceUrl: "https://shop.example/laptops",
      primaryCategory: "electronics",
      scope: "online",
      availabilityType: "online",
      discountType: "percent",
      discountValue: 10,
      endDate: ymd(new Date(NOW.getTime() + 1 * day)),
    }),
    upcoming: await mk({
      title: "Cinema tickets half price next month",
      sourceUrl: "https://c.example/promo",
      primaryCategory: "entertainment",
      scope: "national",
      startDate: ymd(new Date(NOW.getTime() + 30 * day)),
      endDate: ymd(new Date(NOW.getTime() + 40 * day)),
    }),
    unverified: await mk({
      title: "Unconfirmed grocery deal",
      sourceUrl: "https://g.example/deal",
      primaryCategory: "groceries",
      scope: "national",
      validationStatus: "unverified",
      evidenceNote: "",
    }),
    pending: await mk({
      title: "Pending review gym membership",
      sourceUrl: "https://gym.example/offer",
      primaryCategory: "health",
      scope: "national",
      reviewState: "pending",
      endDate: ymd(new Date(NOW.getTime() + 10 * day)),
    }),
    openEnded: await mk({
      title: "Salon haircut discount, no end date",
      sourceUrl: "https://salon.example/offer",
      primaryCategory: "beauty",
      scope: "city",
      city: "Dhaka",
    }),
  };
}

let s;
const titles = (r) => r.items.map((o) => o.title).sort();
const q = (qs) => {
  const { params, errors } = parseOfferQuery(new URLSearchParams(qs));
  assert.equal(errors, undefined, JSON.stringify(errors));
  return searchOffers(db, params);
};

t("schema validator and indexes exist", async () => {
  s = await seed();
  const idx = await db.collection("offers").indexes();
  for (const name of ["slug_unique", "dedupe_unique", "geo_2dsphere", "status_end"]) assert.ok(idx.some((i) => i.name === name), name);
  await assert.rejects(db.collection("offers").insertOne({ title: "x" }), /Document failed validation/);
});

t("duplicate source URLs are rejected", async () => {
  await assert.rejects(
    repo.createOffer(db, { ...common, title: "Same buffet again", sourceUrl: "https://r.example/buffet?utm_source=fb", primaryCategory: "food", scope: "national", endDate: ymd(new Date(NOW.getTime() + day)) }),
    (e) => Boolean(e.errors?.sourceUrl),
  );
});

t("default feed: nearby, nationwide, online, city-wide; no expired/unverified/pending/upcoming", async () => {
  const r = await q(`lat=${DHAKA.lat}&lng=${DHAKA.lng}&city=Dhaka&country=BD&tz=Asia/Dhaka&radius=10`);
  assert.deepEqual(titles(r), [s.near.title, s.national.title, s.online.title, s.openEnded.title].sort());
  const near = r.items.find((o) => o.title === s.near.title);
  assert.ok(near.distanceKm > 1 && near.distanceKm < 2, String(near.distanceKm));
});

t("radius and nationwide toggle", async () => {
  const r = await q(`lat=${DHAKA.lat}&lng=${DHAKA.lng}&city=Dhaka&country=BD&tz=Asia/Dhaka&radius=10&national=0`);
  assert.deepEqual(titles(r), [s.near.title, s.openEnded.title].sort());
  const wide = await q(`lat=${DHAKA.lat}&lng=${DHAKA.lng}&country=BD&tz=Asia/Dhaka&radius=300&national=0`);
  assert.ok(titles(wide).includes(s.far.title));
  const country = await q(`lat=${DHAKA.lat}&lng=${DHAKA.lng}&country=BD&tz=Asia/Dhaka&radius=country&national=0`);
  assert.ok(titles(country).includes(s.far.title));
});

t("manual city selection without coordinates", async () => {
  const r = await q(`city=dhaka&country=BD&tz=Asia/Dhaka&radius=city`);
  assert.deepEqual(titles(r), [s.near.title, s.national.title, s.online.title, s.openEnded.title].sort());
  const other = await q(`city=Chattogram&country=BD&tz=Asia/Dhaka&radius=city&national=0`);
  assert.deepEqual(titles(other), [s.far.title]);
});

t("filters: category, brand, availability, min discount, keyword, validity modes", async () => {
  const loc = `lat=${DHAKA.lat}&lng=${DHAKA.lng}&city=Dhaka&country=BD&tz=Asia/Dhaka&radius=10`;
  assert.deepEqual(titles(await q(`${loc}&category=footwear`)), [s.national.title]);
  assert.deepEqual(titles(await q(`${loc}&brand=lotto`)), [s.national.title]);
  assert.deepEqual(titles(await q(`${loc}&availability=online_only`)), [s.online.title]);
  assert.deepEqual(titles(await q(`${loc}&minDiscount=20`)), [s.near.title, s.national.title].sort());
  assert.deepEqual(titles(await q(`${loc}&q=BUFFET`)), [s.near.title]);
  assert.deepEqual(titles(await q(`${loc}&validity=ongoing`)), [s.openEnded.title]);
  const from = ymd(new Date(NOW.getTime() + 29 * day));
  const to = ymd(new Date(NOW.getTime() + 35 * day));
  assert.ok(titles(await q(`${loc}&validity=custom&from=${from}&to=${to}`)).includes(s.upcoming.title));
  const unv = await q(`${loc}&unverified=1`);
  assert.ok(titles(unv).includes(s.unverified.title));
});

t("sorting and sections", async () => {
  const loc = `lat=${DHAKA.lat}&lng=${DHAKA.lng}&city=Dhaka&country=BD&tz=Asia/Dhaka&radius=10`;
  assert.equal((await q(`${loc}&sort=nearest`)).items[0].title, s.near.title);
  assert.equal((await q(`${loc}&sort=ending`)).items[0].title, s.online.title);
  assert.equal((await q(`${loc}&sort=discount`)).items[0].title, s.national.title);
  assert.deepEqual(titles(await q(`${loc}&section=brand`)), [s.national.title]);
  assert.deepEqual(titles(await q(`${loc}&section=near`)), [s.near.title]);
  const ending = titles(await q(`${loc}&section=ending`));
  assert.ok(ending.includes(s.online.title) && !ending.includes(s.openEnded.title));
  const page = await q(`${loc}&limit=2&page=2`);
  assert.equal(page.total, 4);
  assert.equal(page.items.length, 2);
  assert.equal(page.hasMore, false);
});

t("no location: only location-independent offers", async () => {
  const r = await q(`tz=Asia/Dhaka`);
  assert.deepEqual(titles(r), [s.national.title, s.online.title].sort());
});

t("expiry is enforced at query time and by the sweep", async () => {
  await db.collection("offers").updateOne({ _id: s.online._id }, { $set: { endDate: new Date(Date.now() - 1000) } });
  const r = await q(`tz=Asia/Dhaka`);
  assert.deepEqual(titles(r), [s.national.title]);
  const sweep = await expireOffers(db);
  assert.equal(sweep.expired, 1);
  assert.equal((await repo.getOfferForAdmin(db, String(s.online._id))).validationStatus, "expired");
});

t("stale open-ended offers drop out of the feed", async () => {
  await db.collection("offers").updateOne({ _id: s.openEnded._id }, { $set: { lastVerifiedAt: new Date(Date.now() - 30 * day) } });
  const r = await q(`city=Dhaka&country=BD&tz=Asia/Dhaka&radius=city`);
  assert.ok(!titles(r).includes(s.openEnded.title));
});

t("quick actions and merge", async () => {
  await assert.rejects(repo.applyQuickAction(db, String(s.pending._id), "mark_active", {}), (e) => Boolean(e.errors?.note));
  const approved = await repo.applyQuickAction(db, String(s.pending._id), "approve");
  assert.equal(approved.reviewState, "approved");
  const merged = await repo.mergeOffers(db, String(s.national._id), String(s.pending._id));
  assert.equal(merged.alternateSources[0].url, s.pending.sourceUrl);
  const dup = await repo.getOfferForAdmin(db, String(s.pending._id));
  assert.ok(dup.mergedInto.equals(s.national._id));
  assert.equal(await repo.getPublicOfferBySlug(db, s.pending.slug), null);
});

t("draft from a live URL: robots.txt, extraction, classification, duplicates", async () => {
  const d = await draftFromUrl(db, `${base}/sale?utm_source=x`);
  assert.equal(d.ok, true);
  assert.equal(d.draft.title, "Apex Mega Sneaker Sale: 30% off");
  assert.equal(d.draft.primaryCategory, "footwear");
  assert.ok(d.draft.endDate instanceof Date);
  assert.equal(d.draft.canonicalUrl, `${base}/sale`);
  const blocked = await draftFromUrl(db, `${base}/blocked`);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, "ROBOTS_DISALLOWED");
  const missing = await draftFromUrl(db, `${base}/nope`);
  assert.equal(missing.ok, false);
  const host = await db.collection("sources").findOne({ host: "127.0.0.1" });
  assert.ok(host.successCount >= 1 && host.failureCount >= 2);
});

t("verification against a live URL", async () => {
  const mk = (path, extra = {}) =>
    repo.createOffer(db, { ...common, title: `Verify ${path}`, sourceUrl: `${base}${path}`, primaryCategory: "services", scope: "national", ...extra });
  const structured = await mk("/sale");
  const d1 = await verifyOffer(db, structured);
  assert.equal(d1.outcome, "verified_structured");
  const ended = await mk("/ended");
  assert.equal((await verifyOffer(db, ended)).outcome, "ended_language");
  assert.equal((await repo.getOfferForAdmin(db, String(ended._id))).validationStatus, "unverified");
  const gone = await mk("/gone");
  assert.equal((await verifyOffer(db, gone)).outcome, "unavailable");
  const jobs = await db.collection("jobs").countDocuments({ type: "verify" });
  assert.equal(jobs, 3);
});
