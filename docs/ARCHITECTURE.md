# Offer Finder: architecture, data sources, costs and risks

This document answers spec §17 steps 1–5 before any code. It describes what the
Phase 1 MVP in this repository actually does, and what later phases need.

## 1. Architecture and data flow

```
Browser (Next.js client components)
  │  date + timezone computed locally, location from Geolocation API or manual search
  │  bookmarks kept in localStorage (no account)
  ▼
Next.js Route Handlers (server, Node.js runtime)
  ├─ /api/offers ............ public read API: location, radius, dates, filters, sort, paging
  ├─ /api/offers/by-ids ..... resolve bookmarked ids
  ├─ /api/location/* ........ Google Places (New) autocomplete + details, Geocoding reverse
  │                           (API key stays on the server)
  ├─ /api/admin/* ........... protected: create/edit/approve offers, extract from URL,
  │                           merge duplicates, retry jobs
  └─ /api/cron/revalidate ... scheduled job (Vercel Cron), protected by CRON_SECRET
          │
          ▼
src/lib (plain JavaScript modules, unit-testable with node:test)
  ├─ db/ ............ MongoDB client, $jsonSchema validator, indexes
  ├─ offers/ ........ input validation, status rules, query builder, repository
  ├─ location/ ...... Google Places / Geocoding wrappers
  ├─ sources/ ....... polite fetcher (robots.txt, SSRF guard, timeouts, backoff),
  │                   adapter registry, manual-URL adapter
  ├─ extract/ ....... HTML metadata + schema.org JSON-LD extraction
  ├─ classify.js .... keyword category classifier (admin can override)
  ├─ dedupe.js ...... canonical URL normalisation + fuzzy title matching
  ├─ verify/ ........ revalidation of one offer against its source
  └─ jobs/ .......... batch revalidation + expiry sweep
          │
          ▼
MongoDB: offers · sources (health per host) · jobs (verification attempts)
```

### Request flow for the homepage

1. The client computes today's date in the browser's timezone (`Intl`).
2. If no location is saved, it shows a short explanation and calls
   `navigator.geolocation.getCurrentPosition` (browser permission prompt).
   Granted: coordinates are rounded to 3 decimals (~100 m) and reverse geocoded
   to a city/country label. Denied, unavailable or timed out (10 s): the manual
   location picker opens.
3. The client calls `/api/offers` with `lat,lng,city,country,radius,date,tz` and
   filters. The server converts the user's local day into UTC bounds and runs one
   aggregation: `$geoNear` (distance for offers with verified branch
   coordinates), filtered to the radius or to nationwide/city scope, then
   `$unionWith` for offers that have no coordinates (online or nationwide),
   then sort and paginate with `$facet`.
4. The homepage only reads stored offers. Collection and revalidation run in the
   admin tools and the cron job, never in the page request.

### Offer lifecycle

```
admin submits URL → server fetches (robots.txt respected) → extracted fields +
suggested category + duplicate candidates → admin confirms dates/evidence →
saved as Active (approved) or Unverified
        │
        ▼ cron (daily on Vercel Hobby, more often on Pro)
endDate passed → Expired          source 404/410 → Unavailable
open-ended & not re-verified within OFFER_STALE_DAYS → Unverified
page says "offer ended" → Unverified + flagged for review
structured validThrough on the page in the future → lastVerifiedAt refreshed
page merely still online → lastCheckedAt only (never counts as verification)
```

The public feed shows an offer only when `reviewState = approved`,
`validationStatus = active`, it is not merged into another record, its
`endDate` is in the future (or absent and verified within `OFFER_STALE_DAYS`),
and it matches the date filter. Expiry is enforced at query time, so an offer
disappears the moment its validity ends, even before the cron job runs.

## 2. Data sources: what can actually be accessed

| Source | Access | Conditions | In this MVP |
|---|---|---|---|
| Admin-submitted URLs of official brand/business pages | Direct HTTP fetch | Respect robots.txt and site terms; store a short summary and link, not full copy; many pages are JS-rendered and expose little server-side HTML | **Yes**, tested against live pages |
| schema.org `Offer` / `Event` / `SaleEvent` JSON-LD on those pages | Same fetch | Only where the site publishes it; the best machine-readable evidence of validity | **Yes** (extractor) |
| RSS/Atom feeds of publishers and brands | Direct fetch | Usually permitted for headlines + links; do not republish full articles | Phase 2 adapter |
| Affiliate networks (Awin, CJ, Impact, Rakuten, Admitad) | Official APIs with coupon/deal feeds | Publisher account approval per network and per advertiser; feeds include explicit start/end dates; mostly online offers | Phase 2, recommended for online deals |
| Business-submitted offers | Own form + moderation | Needs business verification | Phase 3 |
| Facebook Pages | Graph API | Reading other pages' public posts needs *Page Public Content Access*, which requires Meta App Review and business verification; often refused for this use | Not included |
| Instagram | Graph API | Only business accounts connected to your app, or hashtag search after App Review; no general public search | Not included |
| X (Twitter) | X API | Paid tiers for meaningful read volume | Not included |
| TikTok | Research API | Academic/non-commercial only | Not included |
| News search APIs (NewsAPI, GNews, GDELT) | API key | Free tiers forbid production use or are delayed; paid tiers start at roughly $50–$450/month; GDELT is free but noisy | Phase 2 |
| Google Places | API key | Finds businesses and coordinates, **not** offers | Used for location only |

Scraping social platforms, logging in, or bypassing CAPTCHAs/anti-bot measures is
out of scope and not implemented. The app does not claim to search every website
or social network: every offer comes from a URL an admin submitted (Phase 1) or
from a configured, permitted adapter (Phase 2).

## 3. API keys, expected costs, configuration

| Variable | Needed for | Cost (check current pricing before launch) |
|---|---|---|
| `MONGODB_URI`, `MONGODB_DB` | Everything | MongoDB Atlas M0 free (512 MB) is enough for an MVP; M10 dedicated ≈ $57/month |
| `GOOGLE_MAPS_SERVER_KEY` | Location autocomplete, place details, reverse geocoding | Since March 2025 Google gives a monthly free allowance per SKU (≈10,000 Essentials calls). Autocomplete requests are not billed when the session ends in a Place Details call; Place Details Essentials and Geocoding are ≈ $5 per 1,000 after the free allowance. A few thousand users/month typically stays near $0 |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET` | Admin dashboard | Free |
| `CRON_SECRET` | Scheduled revalidation | Free; Vercel Hobby allows daily cron jobs, Pro ($20/month) allows more frequent ones |
| `NEXT_PUBLIC_SITE_URL` | Canonical URLs, bot User-Agent | Free |

Google setup: create a Cloud project, enable **Places API (New)** and
**Geocoding API**, create an API key restricted to those two APIs (and to your
server's egress if your host supports static IPs), set a budget alert.

Hosting: Vercel Hobby is free for non-commercial use; commercial use needs Pro.

## 4. Works immediately vs. needs external setup

Works with only MongoDB configured:
- Offer database, schema validation, indexes, deduplication.
- Admin dashboard: login, manual entry by URL with live extraction, review,
  approve/reject, edit, mark expired/unavailable/unverified, merge duplicates,
  source health, failed-job retry.
- Public feed: categories, Brand Offers, Near You, Ending Soon, Recently Added,
  keyword search, all filters and sorts, validity handling, details pages,
  bookmarks, privacy/terms pages, responsive UI.
- Browser geolocation (radius filtering by coordinates).
- Manual location without Google: city + country form (city/country filtering).
- Revalidation job (run manually from admin or via cron).

Needs a Google key (code written to Google's documented API, **not yet tested
here because no key was available**):
- Address/landmark autocomplete, place details, reverse geocoding to a city name.

Needs approval or paid access (Phase 2+): affiliate feeds, news APIs, any
social media integration, map view with pins (Maps JavaScript API browser key).

## 5. Biggest risks

1. **Offer freshness.** Most promotion pages do not publish machine-readable end
   dates, and pages often stay online after a promotion ends. Mitigation: only
   admin-confirmed or structured-data-backed offers are Active; open-ended
   offers drop to Unverified after `OFFER_STALE_DAYS` (default 7); expiry is
   enforced at query time. Cost: the feed will be small until there are
   reliable feeds. That is intentional.
2. **Social media access.** Realistically unavailable for third-party discovery.
   Plan on business submissions and affiliate feeds instead.
3. **Location accuracy.** Browser geolocation can be off by kilometres on
   desktops (IP/Wi-Fi based). Coordinates are rounded and the label is shown so
   users can correct it. Offers only get map coordinates when an admin enters
   verified branch locations; online and nationwide offers never get fake
   coordinates.
4. **Operating cost.** Google calls are the main variable cost; the server proxy
   adds rate limiting and session tokens to keep autocomplete in the cheapest
   billing mode. Collection at scale (fetching many sites) needs a worker queue
   rather than serverless functions with short timeouts.
5. **Legal.** Copyright (store short summaries, link out), image hotlinking
   (images are shown only when an admin keeps the source's `og:image`; turn this
   off per site if prohibited), platform terms, and privacy (no precise
   coordinates stored server-side).
6. **In-memory rate limiting** resets per serverless instance. Fine for an MVP;
   use Upstash/Redis or Vercel's firewall for production traffic.
