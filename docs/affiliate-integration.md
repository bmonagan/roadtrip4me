# Affiliate / Referral Integration — Findings & Implementation Plan

Status: **Booking.com direct affiliate application was denied (no reason
given).** Rather than block on that, the app now monetizes through two
aggregators that need no direct partner approval:

- **Stay22 "Allez"** — a universal affiliate redirect across Booking.com,
  Expedia, Hotels.com, Vrbo, Agoda and GetYourGuide. Sign up free, get an
  `AID`, and the existing cards become commissionable. This is the primary
  path and it restores Booking.com coverage despite the denial.
- **Travelpayouts** — a template-configured deeplink provider (paste the
  dashboard "full link"), dormant until configured.

The Booking.com direct `aid` path (`booking.provider.ts`) is kept as a
fallback for when/if the direct program approves us.

## Current state

`apps/api/src/affiliate/` is split into providers orchestrated by
`affiliate.service.ts`:

- `booking.provider.ts` — Booking.com. Two modes:
  - **Deeplink** (default): an affiliate-tagged `searchresults.html` URL.
  - **Live API** (opt-in via `BOOKING_COM_API_ENABLED=true` + URL/token): real
    hotels with `pricePerNight`, `currency`, `rating`, `reviewCount`,
    `imageUrl`. Any error/timeout falls back to the deeplink, and responses are
    cached in-process for 6h (`common/ttl-cache.ts`, no Redis).
- `expedia.provider.ts` — Expedia referral deeplinks (no inventory API).
- `stay22.provider.ts` — Stay22 Allez deeplinks (`/allez/roam`) covering the
  major OTAs. No API key; just `STAY22_AID`. Coordinates are passed (preferred
  by Allez) alongside the address.
- `travelpayouts.provider.ts` — template-driven deeplinks. Set
  `TRAVELPAYOUTS_HOTEL_URL_TEMPLATE` (a search URL containing `{destination}`,
  optionally `{marker}`/`{subid}`) plus `TRAVELPAYOUTS_MARKER`; dormant until
  configured, so no request shape is guessed.

Endpoints:

- `GET /api/v1/trips/:id/accommodations` → cards for the trip's stop cities
  (deduped by city; auth required, must be able to view the trip).
- `GET /api/v1/accommodations/nearby?city=&lat=&lng=` → cards for an arbitrary
  destination (public, used by the Stops page). `city` is required — reverse
  geocoding would add a paid Google call.
- `POST /api/v1/affiliate/click` → records an outbound click (public, 204).
  The web fires it alongside opening the link; rows land in `affiliate_clicks`
  with provider/category/destination (plus `tripId` when clicked from a trip).
  This is the on-site signal for which cards get clicked — actual revenue is
  reconciled from the partner dashboards.

Web:

- `Accommodations.tsx` (trip detail) and `NearbyAccommodations.tsx` (Stops page)
  both render `AccommodationList.tsx`, which shows image/price/rating when the
  live provider returns them and a plain deeplink card otherwise.
- Links carry `rel="noopener noreferrer sponsored"` (FTC disclosure).

### What was improved in earlier runs
- Cards deduped by destination city.
- Booking.com `sid` sub-account id and Expedia Travel Redirect `tenant` id are
  configurable via env.
- `affiliate.service.spec.ts`, `booking.provider.spec.ts`, `ttl-cache.spec.ts`.

### What was improved this run
- Provider abstraction with live-inventory support behind a feature flag and
  deeplink fallback; bounded in-process TTL cache + in-flight request dedupe.
- `GET /accommodations/nearby` and the Stops-page "Where to stay" search.
- The UI now renders price/rating/review/image (previously ignored).

### What was added after the Booking.com denial
- `stay22.provider.ts` (Allez) and `travelpayouts.provider.ts`, wired into
  `AffiliateService` with tests; new provider ids in `@roadtrip4me/types` and
  labels in `AccommodationList.tsx`.
- Phase 2: `category` on `AffiliateCard`, Stay22 activities (GetYourGuide),
  multi-vertical Travelpayouts (hotel/activity/car), and category sections in
  the UI (`AffiliateCardSections.tsx`).
- Affiliate click tracking: `affiliate_clicks` table (migration `0004`),
  `POST /affiliate/click`, and a fire-and-forget `trackClick` call from
  `AccommodationList.tsx` (also carries `destination` on the card).

## Monetization paths

### 1 — Aggregators (live now, no approval)
- **Stay22 Allez** (`stay22.provider.ts`): one `AID` covers Booking.com,
  Expedia, Hotels.com, Vrbo, Agoda and GetYourGuide via `/allez/roam`, which
  picks the best-converting OTA per request. Env: `STAY22_AID`, optional
  `STAY22_CAMPAIGN`. This is how Booking.com coverage is recovered after the
  direct denial.
- **Travelpayouts** (`travelpayouts.provider.ts`): 100+ brands including car
  rentals and Viator/GetYourGuide feeds. Links are generated in their dashboard,
  so the URL shape is configured via `TRAVELPAYOUTS_HOTEL_URL_TEMPLATE` +
  `TRAVELPAYOUTS_MARKER` (dormant until set).

### 2 — Direct programs (revisit later)
- **Booking.com direct**: denied. Reapply after building traffic; keep
  `BOOKING_COM_AFFILIATE_ID` as the fallback path.
- **Expedia Group Travel Redirect / Rapid API**: requires an EPS account and,
  for Rapid, paid/revenue-share terms. Overkill until traffic justifies it.
- **Live inventory** stays credential-gated behind `BOOKING_COM_API_ENABLED` /
  `_URL` / `_TOKEN`; `BookingProvider.search()` populates `imageUrl`,
  `pricePerNight`, `currency`, `rating`, `reviewCount` automatically. Confirm
  the exact endpoint/auth scheme (the onboarding pack mentions an `X-Metadata`
  signature) and adjust `fetchHotels()` — the single integration point.

### 3 — Road-trip-native partners (Phase 2) — DONE
`AffiliateCard` now carries a `category` (`accommodation` | `activity` |
`car_rental`), and the UI groups cards into "Where to stay" / "Things to do" /
"Getting around".

- **Stay22** emits an activities card via `/allez/getyourguide` alongside the
  accommodation `/allez/roam` link (same `AID`).
- **Travelpayouts** is now multi-vertical: set `TRAVELPAYOUTS_HOTEL_URL_TEMPLATE`
  / `_ACTIVITY_URL_TEMPLATE` / `_CAR_URL_TEMPLATE` (plus `_MARKER`) for Viator,
  Discover Cars / Rentalcars, etc. Each vertical is independent and dormant
  until its template is set.

Still open: RV/camping (Outdoorsy, RVshare, Hipcamp) — add as another
Travelpayouts vertical or a dedicated provider once approved.

### 4 — Grow the asset
Traffic/SEO, Stripe Premium as the primary revenue line, sponsored community
stops, and display ads only once traffic justifies it.

## Recommendation

Ship the Stay22 deeplinks now (zero API work, restores Booking.com + more),
keep Travelpayouts ready behind its template, then diversify into car
rentals/activities. Reapply to Booking.com in 3–6 months with traffic numbers.

## TODO when implementing

1. ~~Provider abstraction + deeplink fallback~~ **DONE**
   (`booking.provider.ts`, `expedia.provider.ts`).
2. ~~Populate pricing fields + render them in the UI~~ **DONE**
   (`AccommodationList.tsx`); verify against a real API once one is available.
3. ~~In-process TTL cache (no Redis)~~ **DONE** (`common/ttl-cache.ts`, 6h TTL).
4. ~~`GET /accommodations/nearby` search-by-coordinates~~ **DONE**.
5. ~~Stay22 Allez provider~~ **DONE** (`stay22.provider.ts`).
6. ~~Travelpayouts template provider~~ **DONE** (`travelpayouts.provider.ts`).
7. **Remaining (credential-gated):**
   - Create a free Stay22 account; set `STAY22_AID` (+ optional
     `STAY22_CAMPAIGN`) as Fly secrets and verify commissionable links.
   - Register with Travelpayouts, generate the hotel "full link", set
     `TRAVELPAYOUTS_HOTEL_URL_TEMPLATE` / `_MARKER` and verify.
   - Reapply to Booking.com once traffic metrics exist; on Affiliate API
     approval set `BOOKING_COM_API_ENABLED` / `_URL` / `_TOKEN` and validate
     `fetchHotels()`.
   - ~~Phase 2: add car-rental / activities providers~~ **DONE** (Stay22
     GetYourGuide + multi-vertical Travelpayouts + UI category sections).
     Remaining: RV/camping providers (Outdoorsy, RVshare, Hipcamp).
