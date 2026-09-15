# Affiliate / Referral Integration — Findings & Implementation Plan

Status: **partner application submitted, awaiting approval.** The full code path
(deeplinks + live-inventory provider + UI) is in place and tested; going live is
a secrets-only change. Until `BOOKING_COM_AFFILIATE_ID` is set the "Where to
stay" sections render nothing.

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

Endpoints:

- `GET /api/v1/trips/:id/accommodations` → cards for the trip's stop cities
  (deduped by city; auth required, must be able to view the trip).
- `GET /api/v1/accommodations/nearby?city=&lat=&lng=` → cards for an arbitrary
  destination (public, used by the Stops page). `city` is required — reverse
  geocoding would add a paid Google call.

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

## Options to get real inventory + commission

### Option A — Booking.com affiliate program (simplest)
- Sign up: **Booking.com Affiliate Partner Programme**
  (https://www.booking.com/affiliate-program.html → get an `aid`).
- No API key needed to start: keep using the search-results deeplinks; you earn
  commission when users book after clicking through.
- To show real prices on-site: **Booking.com Affiliate API**
  (`/searchresults` / hotel search) — partner approval + a signed request
  (X-Metadata signature). That enables filling `pricePerNight`/`rating`/etc.
- Env: `BOOKING_COM_AFFILIATE_ID` (have), optional `BOOKING_COM_SID`.

### Option B — Expedia Group Travel Redirect API (referral deeplinks, no inventory)
- Expedia's "referral" product: travelers search on your site, then get a
  signed link to complete the booking on Expedia. No inventory API needed.
- Requires an **Expedia Partner Solutions (EPS) account** + Travel Redirect API
  credentials (client id/secret) to generate signed links.
- Env: `EXPEDIA_AFFILIATE_ID` (have as `affcid`), `EXPEDIA_TRAVELER_ID`, plus
  Travel Redirect `EXPEDIA_REDIRECT_CLIENT_ID` / `EXPEDIA_REDIRECT_CLIENT_SECRET`.

### Option C — Expedia Group Rapid API (full inventory, heaviest)
- Real-time hotel search + availability + pricing (`/properties/availabilities`).
- Requires Rapid API application via Expedia Group developer hub, likely paid /
  revenue-share terms. Overkill until traffic justifies it.

## Recommendation

Start with **Booking.com affiliate deeplinks (Option A)** — zero API work, the
existing `affiliateUrl` already carries the `aid`. Once approved for the
**Affiliate API**, set `BOOKING_COM_API_ENABLED=true`, `BOOKING_COM_API_URL` and
`BOOKING_COM_API_TOKEN`; `BookingProvider.search()` then populates
`imageUrl`, `pricePerNight`, `currency`, `rating`, `reviewCount` automatically.
Confirm the exact endpoint/auth scheme (the plan doc mentions an `X-Metadata`
signature) against the onboarding pack and adjust `fetchHotels()` in
`apps/api/src/affiliate/booking.provider.ts` — it is the single integration point.

## TODO when implementing

1. ~~Provider abstraction + deeplink fallback~~ **DONE**
   (`booking.provider.ts`, `expedia.provider.ts`).
2. ~~Populate pricing fields + render them in the UI~~ **DONE**
   (`AccommodationList.tsx`); verify against real API once approved.
3. ~~In-process TTL cache (no Redis)~~ **DONE** (`common/ttl-cache.ts`, 6h TTL).
4. ~~`GET /accommodations/nearby` search-by-coordinates~~ **DONE** (requires a
   `city`; live API also receives lat/lng).
5. **Remaining (credential-gated):**
   - Obtain `aid`; set `BOOKING_COM_AFFILIATE_ID` (+ optional `SID`) as Fly
     secrets and verify commissionable deeplinks end-to-end.
   - On Affiliate API approval, set `BOOKING_COM_API_ENABLED` / `_URL` /
     `_TOKEN` and validate `fetchHotels()` against the real response shape.
   - Consider per-hotel deeplinks (currently the fallback URL is a city search)
     and a daily cap / monitoring on live API calls.
