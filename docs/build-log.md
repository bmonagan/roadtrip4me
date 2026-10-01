# Build log

A condensed history of how Roadtrip4me was built and hardened. It's here as a
record of the engineering process — what broke, what the fix was, and why.

## Foundations

- Monorepo on Bun workspaces: React + Vite SPA (`apps/web`), NestJS on Fastify
  (`apps/api`), shared declaration-only types package.
- PostgreSQL + PostGIS via Prisma; local development through Docker Compose.
- Deliberate constraint: **no Redis / no external queue** — background work runs
  in-process, all state in Postgres.

## Features

- Trip planner with origin/destination/waypoints and a Mapbox-rendered route.
- Community stops with search, voting, and per-user vote state.
- AI stop recommendations (DeepSeek) with Places-verified coordinates.
- Affiliate accommodation cards (Booking.com, Expedia, Stay22, Travelpayouts)
  with a deeplink fallback and live-inventory opt-in.
- Stripe Premium subscriptions with webhook-driven entitlement.
- Admin user management (premium/admin grants, deletion).

## Correctness & concurrency

- Vote recalculations lock the stop row (`SELECT … FOR UPDATE`) so concurrent
  votes don't lose updates.
- Free-tier trip/stop limits enforced inside transactions that lock the user or
  trip row; stop/waypoint ordering serialized to protect the unique
  `(tripId, order)` constraint.
- AI budget enforcement is a single atomic conditional `UPDATE` (no
  read-modify-write race).
- Stop and trip geography writes made transactional to avoid orphan rows.

## Reliability & cost

- Route computation and recommendations run as retried, deduped background jobs;
  reading an unrouted trip re-enqueues computation so a mid-job restart can't
  leave a trip polyline-less forever.
- Stale recommendation jobs are surfaced as failed so the UI can retry.
- Machine counts scale to zero when idle; the database was downsized and its
  volume shrunk 50 GB → 10 GB after measuring real usage (~100 MB).

## Auth & billing edge cases

- Auth0 can issue opaque *or* JWT access tokens; the API detects the format and
  validates accordingly (tenant JWKS or `/userinfo`, cached with timeouts).
- New users are auto-provisioned and linked by email on first login.
- Stripe webhooks use the async signature verification path (required on Bun),
  and downgrade on `past_due`/`unpaid`/`payment_failed`.
- Centralized 401 handling clears the session and redirects to login on token
  expiry.

## Performance

- Route computation moved off the write path (writes return immediately; the
  web app polls).
- Code-split all routes and lazy-loaded the ~1 MB Mapbox bundle; initial JS
  dropped from ~2.1 MB (607 KB gzip) to ~222 KB (72 KB gzip).

## Quality

- 100+ unit tests (API + web) run in CI alongside typecheck, lint, build, and a
  secret scan.
- Demo mode (`DEMO_MODE=true`) swaps paid integrations for fixtures so the app
  runs and can be explored with no credentials.
