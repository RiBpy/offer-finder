# API

All responses are JSON. Validation errors return `400 {"error": "...", "fields": {field: message}}`.
Public endpoints are rate limited per IP (best effort, per instance).

## Public

### `GET /api/offers`

| Param | Default | Notes |
|---|---|---|
| `tz` | `UTC` | IANA timezone of the user; "today" is computed in this zone |
| `date` | today in `tz` | `YYYY-MM-DD` |
| `lat`, `lng` | none | Rounded to 3 decimals server-side |
| `city`, `country` | none | `country` is ISO 3166-1 alpha-2 |
| `radius` | `25` | km (1–500), or `city` / `country` |
| `national` | `1` | `0` excludes nationwide and online-only offers |
| `unverified` | `0` | `1` also returns approved offers marked Unverified |
| `validity` | `today` | `today, starting_today, ending_today, week, ongoing, custom` |
| `from`, `to` | | Required for `validity=custom` (max one year) |
| `q` | | Keyword over title, brand, business, description, tags |
| `category` | | One of the 12 category ids (matches the primary category) |
| `brand` | | Exact brand name, case-insensitive |
| `availability` | `any` | `online` (online or both), `online_only`, `in_store` |
| `minDiscount` | | Percent, 0–100 (percent-type discounts only) |
| `sourceType` | | `official_website, campaign_page, social_media, news, business_submitted, other` |
| `bank` | | `ebl, brac, mtb`: card offers from that bank's own website |
| `section` | | `brand, near, ending, recent` (homepage rows) |
| `sort` | `newest` | `newest, nearest, ending, discount, verified` |
| `page`, `limit` | `1`, `20` | `limit` max 50 |
| `counts` | | `1` adds `counts: { all, brand, categories: { id: n } }`, ignoring `category` and `section=brand` |

Response: `{ items: [offer], total, page, limit, hasMore, staleDays }`. Each item has
`distanceKm` (nearest verified branch) or `null`.

### Other public endpoints

- `GET /api/offers/by-ids?ids=a,b` — bookmarked offers, with `effectiveStatus`.
- `GET /api/brands` — brands that currently have active offers.
- `GET /api/location/config` — `{ google: boolean }`.
- `GET /api/location/autocomplete?q=&session=&lat=&lng=` — Places Autocomplete (New). 501 without a key.
- `GET /api/location/place?id=&session=` — `{ label, lat, lng, city, country }`.
- `GET /api/location/reverse?lat=&lng=` — `{ label, city, country, configured }`.
- `GET /api/health` — `{ ok, db }`.

## Admin (session cookie; mutating calls must send a same-origin `Origin` header)

- `POST /api/admin/login {email, password}` (5 attempts / 15 min / IP), `POST /api/admin/logout`
- `GET /api/admin/offers?tab=pending|active|unverified|expired|rejected|all&q=&page=`
- `POST /api/admin/offers` — create. Body fields as in the admin form; dates are `YYYY-MM-DD`
  in the offer's `timezone` (end dates mean end of that day). `validationStatus: "active"`
  requires `evidenceNote`.
- `GET /api/admin/offers/:id` — record, duplicate candidates, recent checks
- `PUT /api/admin/offers/:id` — update
- `PATCH /api/admin/offers/:id {action, note}` — `approve, reject, mark_active (needs note), mark_unverified, mark_expired, mark_unavailable`
- `POST /api/admin/extract {url}` — fetch the page (robots.txt respected) and return a draft, warnings and duplicates
- `POST /api/admin/merge {primaryId, duplicateId}`
- `GET /api/admin/jobs` — failed verifications, source health, adapters, last batch
- `POST /api/admin/jobs/retry {jobId}`
- `POST /api/admin/revalidate` — run a batch now

## Cron

- `GET /api/cron/revalidate` with `Authorization: Bearer $CRON_SECRET` — expires ended
  offers, marks stale open-ended ones Unverified, re-checks up to 25 offers (ending soonest
  and most viewed first).
