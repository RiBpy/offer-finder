# OfferFinder

A location-based website for currently valid offers, discounts and promotions. Every
offer links to its original source. Only offers with evidence that they are active are
shown by default. Built with Next.js 16 (App Router, JavaScript only), Tailwind CSS 4
and MongoDB.

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) first. It covers architecture, which
data sources are actually accessible, keys and costs, and the main risks.
[docs/API.md](docs/API.md) documents the endpoints.

## Status (Phase 1 MVP)

| Feature | State |
|---|---|
| Offer database, schema validator, indexes, dedupe | Done, integration-tested on MongoDB 8.0 |
| Validation statuses, query-time expiry, staleness rule | Done, tested |
| Public feed: location/radius, nationwide/online toggle, dates, categories, Brand Offers, search, filters, sorts, pagination | Done, tested via API and in a headless browser |
| Homepage sections (Brand Offers, Near You, Ending Soon, Recently Added), skeletons, empty and error states | Done, checked in the browser |
| Browser geolocation (granted and denied flows) | Done, checked in the browser |
| Manual location without Google (city + country) | Done, checked in the browser |
| Google Places autocomplete, place details, reverse geocoding | **Written, not tested.** No API key was available |
| Offer details page (JSON-LD, canonical URL), saved offers (localStorage) | Done, checked in the browser |
| Admin: login, add from URL with extraction, review, approve/reject, status changes, edit, merge, source health, failed-job retry, manual revalidation | Done, checked in the browser |
| Fetching real business websites | Fetcher, robots.txt and extraction are tested against a local test server. **Not tested against live sites**, because the build sandbox blocks outbound traffic to them |
| Scheduled revalidation (Vercel Cron) | Route tested locally with the secret; the cron schedule itself only runs on Vercel |
| Phase 2 (feeds, news, social, automatic discovery) and Phase 3 (map, accounts, alerts) | Not started |

No sample or mock offers ship with the app. The database starts empty; offers are added
by an administrator from real source URLs.

## Folder structure

```
src/
  proxy.js                     admin route gate (Next 16 "proxy", formerly middleware)
  app/
    page.js, HomeClient.js     homepage: location, filters, sections, feed
    offers/[slug]/page.js      offer details (server-rendered, JSON-LD, canonical)
    saved/                     locally bookmarked offers
    privacy/, terms/, about-bot/
    admin/login/               admin sign-in
    admin/(panel)/             protected dashboard: list, add, edit, sources & jobs
    api/
      offers/                  GET public search; offers/by-ids for bookmarks
      brands/                  brand names with active offers
      location/                config, autocomplete, place, reverse (Google, server-side key)
      admin/                   login, logout, offers, offers/[id], extract, merge, jobs, jobs/retry, revalidate
      cron/revalidate/         scheduled revalidation (Bearer CRON_SECRET)
      health/                  liveness + DB ping
  components/                  OfferCard, Filters, LocationPicker, SiteChrome, hooks
  lib/
    constants.js, dates.js, geo.js, text.js, format.js, log.js
    db/          mongo.js (client), setup.js ($jsonSchema validator + indexes)
    offers/      model.js (input validation), query.js (search pipeline), repository.js,
                 status.js (visibility rules), discover.js (URL → draft)
    sources/     fetcher.js (robots.txt, SSRF guard, retries), registry.js, adapters/, health.js
    extract/     html.js (Open Graph + schema.org JSON-LD)
    verify/      verifier.js (re-check one offer)
    jobs/        revalidate.js (expiry sweep + batch), run.js
    location/    google.js
    auth/        session.js (scrypt hash, HMAC session cookie)
    http/        respond.js (errors, admin guard, CSRF origin check), rate-limit.js
scripts/       init-db.js, hash-password.js
tests/         unit.test.js, db.test.js (real MongoDB)
```

## Offer schema (MongoDB `offers`)

Required: `title, slug, dedupeKey, sourceUrl, sourceType, primaryCategory, categories,
validationStatus, reviewState, availabilityType, scope, createdAt, updatedAt`.

Optional (null or absent when unknown): `description, terms, brandName, brandKey,
businessName, isBrandOffer, tags, discountType, discountValue, discountText,
originalPrice, discountedPrice, currency, startDate, endDate, timezone, publishedAt,
canonicalUrl, sourceName, sourceOfferId, sourcePublicationDate, lastVerifiedAt,
lastCheckedAt, statusReason, verificationEvidence[{at, method, note}],
eligibleLocations[{name, address, city, country, latitude, longitude}],
geo (GeoJSON MultiPoint, only for verified branch coordinates), latitude, longitude,
country, city, cityKey, address, imageUrl, alternateSources, mergedInto, viewCount`.

- `validationStatus`: `active | unverified | expired | unavailable`
- `reviewState`: `pending | approved | rejected` (public only sees `approved`)
- `scope`: `local` (branches) `| city | national | online`
- `dedupeKey` (unique) = normalised canonical URL, plus `#sourceOfferId` when one page lists several offers

The full validator is in `src/lib/db/setup.js`. Other collections: `sources` (fetch
health per host) and `jobs` (verification attempts and batch runs). Bookmarks never
touch the database.

**Visibility rule:** an offer appears in the default feed only if it is approved,
active, not merged, its `endDate` is in the future (or it has none and was verified
within `OFFER_STALE_DAYS`), and it matches the selected date filter. A page that is
merely still online never counts as verification.

## Local setup

Requirements: Node.js 20.9+ (22 recommended) and MongoDB 7+ (local or Atlas).

```bash
npm install
cp .env.example .env.local
npm run hash-password -- 'a long admin password'   # paste into ADMIN_PASSWORD_HASH
openssl rand -base64 48                             # paste into SESSION_SECRET
npm run db:init                                     # creates validator + indexes
npm run dev                                         # http://localhost:3000
```

Sign in at `/admin/login`, then use **Add offer from URL**.

### Tests

```bash
npm test   # unit tests + integration tests against MONGODB_TEST_URI (default mongodb://127.0.0.1:27017)
```

The integration tests create and drop a throwaway database and skip themselves if no
MongoDB is reachable.

## Deployment (Vercel + MongoDB Atlas)

1. Create an Atlas cluster (M0 is fine to start), a database user, and allow access from
   anywhere (`0.0.0.0/0`) or use Vercel's static IPs on a paid plan. Copy the connection string.
2. Push this repository to GitHub and import it in Vercel (framework: Next.js).
3. Set environment variables in Vercel → Settings → Environment Variables: everything in
   `.env.example` except `FETCH_ALLOW_PRIVATE_HOSTS` (never set that in production).
   Set `NEXT_PUBLIC_SITE_URL` to your production URL.
4. Deploy. `vercel.json` registers a daily cron at 03:00 UTC calling
   `/api/cron/revalidate`; Vercel sends `CRON_SECRET` automatically. On Pro you can
   make it more frequent.
5. Run `npm run db:init` once against the production database (or just open the site:
   the app creates the validator and indexes on first connection).
6. Google (optional): enable **Places API (New)** and **Geocoding API**, create a key
   restricted to those APIs, set `GOOGLE_MAPS_SERVER_KEY`, and add a budget alert.
   Then test address search on the deployed site; it has not been tested yet.

Other hosts work too (`npm run build && npm start` on Node 20.9+); schedule
`GET /api/cron/revalidate` with the `Authorization: Bearer $CRON_SECRET` header.

## Known limitations

- Rate limiting is in memory per instance. Use a shared store or your host's firewall for strict limits.
- Without a Google key, browser geolocation gives distance-based results but no city
  name, so city-wide offers are not matched until the user picks a city.
- The SSRF guard resolves DNS before fetching; a DNS-rebinding attacker with admin
  access could still race it. Only admins can submit URLs.
- Many promotion pages render with JavaScript and expose little HTML; the admin then fills fields by hand.
