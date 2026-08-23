# Overnight Run — Phase 4 Findings

## 1. Auth0 email branding shows "auth0" instead of the app name

**Problem** (todo in `current.md`): Emails triggered by Auth0 (e.g. verification
emails after signing up with a Google account) display "auth0" as the sender /
branding instead of "Roadtrip4me".

**Root cause**: this is a tenant-level Auth0 **branding** setting, not a code
issue. Auth0's default email templates use the tenant name (`dev-t5c7ke25qk6ebvx4`)
or generic "Auth0" branding until you customize it.

**Fix (dashboard-side, in Auth0 dashboard → Branding / Emails)**:
1. **Branding → General**: set the display name to "Roadtrip4me", upload a logo
   (`public/favicon.svg`), and set a favicon. This changes the Universal Login
   page and email footer.
2. **Emails → Templates**: for each enabled template (Verification Email,
   Welcome, Password Reset), the default "auth0" sender name can be changed.
   Set the sender name/from to "Roadtrip4me" and enable the "Branding" footer.
   (Email verification is auto-sent on Google signup — that's the email the user
   saw.)
3. Optionally configure a **custom domain** (`login.roadtrip4me.com`) so the
   sender domain is not the `dev-*.auth0.com` sandbox domain — this also avoids
   emails landing in spam.

No application code change is required; the SPA/app already uses the correct
client id and callback URLs.

## 2. Async job architecture (in-process `setImmediate`)

Route computation and AI recommendations both run as fire-and-forget
`setImmediate` jobs inside the API process.

**Current behavior**:
- Writes (`create/update/addStop/...`) queue `computeRoute`; the web polls for
  the polyline.
- `POST /trips/:id/recommendations` writes a `recommendationRequest` row, runs
  DeepSeek + Places in the background, then updates the row; the web polls.
- Recommendation rows older than 10 min are treated as stale and retryable
  (added this run).

**Risks**:
- A process restart mid-job loses the work: route polyline never appears (the
  write already returned), or the recommendation row stays `processing`.
- Multiple API instances would each run jobs independently (no coordination);
  two instances polling the same trip could compute the route twice.
- No retry/backoff on transient Google/DeepSeek failures.

**Options to harden later**:
1. **Retry on failure** (cheapest): wrap `computeRoute` / recommendation work in
   a small retry loop (e.g. 2 retries with backoff) and log the final failure.
2. **Re-enqueue on read**: in the route-poll GET path, if a trip has no polyline
   and no job is marked in-flight, re-queue computation (with a short guard to
   avoid loops).
3. **Persistent queue**: reintroduce a durable job store. Note AGENTS.md forbids
   Redis; a Postgres-backed outbox table + worker would fit the existing stack.
4. **Dedupe**: add an `inFlight` timestamp on the trip so two instances don't
   both compute the same route.

Recommendation: implement (1) + (2) as low-risk; defer (3)/(4) until multi-instance
scaling is needed.

## 3. Other notes from the audit

- **Opaque `/userinfo` tokens**: every request was an external Auth0 call.
  Added a 60s TTL in-memory cache + 5s fetch timeout (this run). If Auth0 rate
  limits become a concern, request a custom-API audience so tokens are JWTs and
  verify locally via JWKS (removes per-request external calls entirely).
- **Rate limits**: now enforced globally (300/min) with per-controller limits
  (votes 30/min, AI recs 10/min). Values may need tuning once real traffic
  arrives.
