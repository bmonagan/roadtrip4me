# Security

## Authentication

- **Auth0 (Authorization Code + PKCE)** verifies access tokens via the tenant JWKS
  (`jose`, RS256). Tokens are required on all non-public routes; the `sub`
  claim is resolved to a `User` row via `authId`.
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
  Use `*` only in development. Credentials are only echoed when not `*`.
- Production serves the SPA and `/api` from the same origin behind a reverse
  proxy, which avoids CORS entirely.

## Secrets

- All keys (`GOOGLE_MAPS_API_KEY`, `DEEPSEEK_API_KEY`, database, Redis, Auth0)
  live in gitignored `.env` files. Provide real values via a secret manager in
  production; never commit them.

## Dependency audit

Run `bun audit` regularly. Current posture (after upgrading to Nest 11 / Fastify 5 / Vite 6 and
pinning `fast-uri`, `find-my-way`, `nanoid` via `overrides`): **0 critical, 2 high**.

The 2 remaining high findings are both `lodash` advisories pulled in by
`@babel/core` (a build-time-only tool). `lodash@4.17.21` has **no patched
release** for these advisories, and babel only runs during the web build — the
production bundle does not contain it.

## Known production risks to track

- **Third-party API spend:** AI recommendations (DeepSeek) and Google Routes
  calls are cost-bearing. Rate limits help; add per-account budgets/quota alerts
  before launch.
- **AI stop coordinates** are LLM-provided approximations; validate/reconcile
  with a geocoding pass (Google Places) before trusting them for navigation.
