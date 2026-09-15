# Security

## Authentication

- **Auth0 (Authorization Code + PKCE)**. Tokens are required on all non-public
  routes. The API detects the token format: JWT access tokens (when a custom API
  audience is configured) are verified against the tenant JWKS (`jose`, RS256);
  opaque tokens are validated against Auth0's `/userinfo` endpoint (cached 60s).
  The `sub` claim is resolved to a `User` row via `authId`.
- **Dev fallback:** while `AUTH_DISABLED=true` (default in local `.env`) the API
  trusts the `x-user-id` header for the seeded dev users. **Set
  `AUTH_DISABLED=false` plus `AUTH0_DOMAIN`/`AUTH0_AUDIENCE` in any environment
  that faces real users.** When auth is enabled, the `x-user-id` header is
  ignored.
- The frontend (web) sends the access token as `Authorization: Bearer`. The
  PKCE login flow redirects to `/auth/callback` and never exposes the token.

## HTTP hardening

- Security headers on every response (Fastify `onSend` hook): `X-Content-Type-Options`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, and a CSP
  scoped to the SPA + Mapbox + the API origin.
- `trustProxy` enabled so rate limiting and logging see the real client IP
  behind a reverse proxy.

## Rate limiting

- Global: 300 requests/min/IP.
- Stricter per-controller limits: votes 30/min, AI recommendations 10/min
  (recommendations call a paid LLM).

## CORS

- `CORS_ORIGIN` is a comma-separated allowlist (default `http://localhost:5173`).
  Use `*` only in development. Credentials are only echoed when not `*`. In
  production the SPA (`roadtrip4me.com`) and API (`api.roadtrip4me.com`) are
  different origins, so `CORS_ORIGIN` must list the web origin; the API fails
  closed (throws) when it is unset in production.

## Secrets

- All keys (`GOOGLE_MAPS_API_KEY`, `DEEPSEEK_API_KEY`, `STRIPE_SECRET_KEY`,
  Auth0) live in gitignored `.env` files. Provide real values via a secret
  manager (or Fly.io secrets in production); never commit them.

## Dependency audit

Run `bun audit` regularly. Current posture: **0 critical, 1 high, 2 moderate**.

`fast-uri`, `find-my-way`, `nanoid`, `fastify` and `mysql2` are pinned to
patched versions via root `overrides`. The remaining findings are transitive and
not reachable in production traffic:

- `deepmerge-ts` (high) — pulled in by the `prisma` CLI for config merging
  (build / migration time only); no patched major is compatible with Prisma 7.
- `react-router` (moderate, ×2) — patched only in the v7 major; the app uses
  `react-router-dom` v6 and controls all navigation targets.

## Known production risks to track

- **Third-party API spend:** AI recommendations (DeepSeek) and Google Routes
  calls are cost-bearing. Rate limits help; add per-account budgets/quota alerts
  before launch.
- **AI stop coordinates** are LLM-provided approximations; validate/reconcile
  with a geocoding pass (Google Places) before trusting them for navigation.
