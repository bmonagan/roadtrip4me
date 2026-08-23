# Affiliate / Referral Integration — Findings & Implementation Plan

Status: **research + scaffolding done** (run-time fix #1). Integration requires
partner approval and API keys before real inventory/pricing can be shown.

## Current state

`apps/api/src/affiliate/affiliate.service.ts` generates **deeplinks only**:

- `GET /api/v1/trips/:id/accommodations` → list of `AffiliateCard`s.
- Each card links to a Booking.com or Expedia **search-results page** for the
  stop's city, tagged with the configured affiliate id.
- `pricePerNight`, `rating`, `reviewCount`, `imageUrl` are all `null` — no real
  inventory is fetched.

Rendered by `apps/web/src/components/Accommodations.tsx` ("Where to stay"
section on the trip detail page, visible to any user who can view the trip).

### What was improved this run
- Cards are now **deduped by destination city** (a trip visiting the same city
  multiple times no longer shows N×2 duplicate hotel links).
- Booking.com links accept an optional `sid` sub-account id; Expedia links
  accept an optional Travel Redirect `tenant` id — both configurable via env.
- Added `affiliate.service.spec.ts` (dedupe + link params + config fallbacks).

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
**Affiliate API**, replace the deeplink builders in `affiliate.service.ts` with
a hotel-search call and populate:

- `imageUrl`, `pricePerNight`, `currency`, `rating`, `reviewCount`
- keep `affiliateUrl` (now a per-hotel or search-result link)

The `AffiliateCard` type already has all these fields (see
`packages/types/src/index.ts:146`).

## TODO when implementing

1. Obtain `aid` (Booking) and/or EPS Travel Redirect credentials.
2. Set the new env vars on the API app (Fly secrets):
   `BOOKING_COM_SID`, `EXPEDIA_TRAVELER_ID`, and any API/redirect secrets.
3. Extend `AffiliateService` to call the provider API and populate the pricing
   fields (Option A/B/C above).
4. Optionally cache provider responses (they change hourly) — note: the repo
   intentionally avoids Redis, so use an in-process TTL cache or DB.
5. Consider adding `GET /api/v1/accommodations` search-by-coordinates (not just
   by trip) so the map page can show nearby hotels.
