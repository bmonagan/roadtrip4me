# Roadtrip4me 🚗

AI-powered road trip planner: plan a route, discover community stops, get AI
stop recommendations, and find nearby hotels — with optional Premium
subscriptions.

## Stack

| Layer | Technology |
|---|---|
| Runtime | Bun |
| Frontend | React 18 · TypeScript · Vite · Mapbox GL JS · TanStack Query |
| Backend | NestJS · Fastify · TypeScript |
| Database | PostgreSQL 16 + PostGIS · Prisma ORM |
| Auth | Auth0 (Authorization Code + PKCE) |
| Payments | Stripe (Premium subscriptions) |
| Monorepo | Bun workspaces |

> **Note:** Redis/BullMQ are intentionally not used. All state lives in
> PostgreSQL; background jobs (route computation, AI recommendations) run
> in-process with `setImmediate`.

## Project structure

```
roadtrip4me/
├── apps/
│   ├── web/            React + Vite SPA (deployed to Fly.io)
│   │   └── packages/   types/ — shared types copy used by the Docker build
│   └── api/            NestJS backend (deployed to Fly.io)
│       ├── prisma/     schema + migrations
│       └── src/        API source (auth, trips, stops, votes, billing, …)
├── packages/
│   └── types/          Shared TypeScript declarations (source of truth)
├── docs/               Affiliate + operational findings
├── docker-compose.yml  Local Postgres (PostGIS) for development
├── .env.prod.example   Reference list of production env vars (Fly.io secrets)
└── package.json        Bun workspace root
```

> `@roadtrip4me/types` is the single source of truth for shared types
> (`packages/types/src/index.d.ts`). Both apps import it as a workspace package;
> the Docker builds use the repo root as their build context so the same package
> is available without copies.

## Prerequisites

- [Bun](https://bun.sh) >= 1.x
- [Docker](https://docker.com) + Docker Compose (local Postgres only)
- External API keys (see [External APIs](#external-apis-required))

## Getting started

### 1. Install dependencies

```bash
bun install
```

### 2. Set up environment variables

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Fill in the required values. At minimum for local development:
- `VITE_MAPBOX_TOKEN` — [mapbox.com](https://mapbox.com)
- `GOOGLE_MAPS_API_KEY` — [Google Cloud Console](https://console.cloud.google.com)
- Leave `AUTH_DISABLED=true` to use the dev fallback (the API trusts an
  `x-user-id` header for the seeded users instead of Auth0).

### 3. Start local infrastructure (Postgres + PostGIS)

```bash
docker compose up -d
```

Runs Postgres on port 5432.

### 4. Start development servers

```bash
# Both frontend and backend in parallel
bun run dev

# Or individually
bun run dev:web   # http://localhost:5173
bun run dev:api   # http://localhost:3000
```

### 5. Seed the database (optional)

```bash
bunx prisma db seed
```

Seeds two dev users (`alice@example.com` premium/admin, `bob@example.com`),
community stops, votes, and a sample trip.

## Key commands

```bash
bun run build       # Build all apps
bun run typecheck   # Type check all packages
bun run lint        # Lint both apps (ESLint)
bun run test        # Run unit tests (Vitest)
bun run format      # Format with Prettier
bun run start       # Run the built API (apps/api/dist/main.js)
bun run preview     # Serve the built web on port 5173
```

## API health check

```bash
curl http://localhost:3000/api/v1/health
```

## Authentication modes

- **Dev (`AUTH_DISABLED=true`)**: the API trusts the `x-user-id` header. The
  `/login` page lets you pick a seeded identity (Alice/Bob) or a custom id.
- **Production (`AUTH_DISABLED=false`)**: Auth0 access tokens are required.
  Opaque tokens are validated against `/userinfo`; JWT access tokens (when a
  custom API audience is configured) are verified against the tenant JWKS. New
  users are auto-provisioned by email on first login.

## Production deployment (Fly.io)

The app runs on three Fly.io apps in the `ord` (Chicago) region:

| App | What it runs | Machine |
|---|---|---|
| `roadtrip4me-web` | Static SPA behind nginx | shared-cpu-1x |
| `roadtrip4me-api` | NestJS API | shared-cpu-2x |
| `roadtrip4me-db`  | PostgreSQL + PostGIS (flex) | shared-cpu-1x, 10GB volume |

Deploys are automated by GitHub Actions (`.github/workflows/deploy.yml`):
push to `main` → CI (typecheck, lint, test, build) → `flyctl deploy` for the
API and web. The API applies migrations on boot (`prisma migrate deploy`).

**Scale behavior:** the API and web machines scale to zero when idle
(`min_machines_running = 0`) and wake on traffic. The DB stays always-on.

**To deploy manually:**

```bash
# API
cd apps/api && fly deploy --remote-only --app roadtrip4me-api --dockerfile Dockerfile

# Web
cd apps/web && fly deploy --remote-only --app roadtrip4me-web --dockerfile Dockerfile
```

**To stop everything (no compute, keeps the DB volume):**

```bash
fly scale count 0 -a roadtrip4me-api --yes
fly scale count 0 -a roadtrip4me-web --yes
fly machine stop <db-machine-id> -a roadtrip4me-db   # find id: fly machines list -a roadtrip4me-db
```

**Production env vars** are stored as Fly secrets / GitHub Actions secrets
(`AUTH0_DOMAIN`, `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`,
`GOOGLE_MAPS_API_KEY`, `DEEPSEEK_API_KEY`, `VITE_MAPBOX_TOKEN`,
`VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, …). See `.env.prod.example` for the
full reference.

## External APIs required

| Service | Purpose | Link |
|---|---|---|
| Google Maps (Routes) | Driving routes + polylines | [console.cloud.google.com](https://console.cloud.google.com) |
| Google Maps (Places) | Verify AI stop coordinates | [console.cloud.google.com](https://console.cloud.google.com) |
| Mapbox | Map display + geocoding | [mapbox.com](https://mapbox.com) |
| DeepSeek | AI stop recommendations | [platform.deepseek.com](https://platform.deepseek.com) |
| Auth0 | Authentication | [auth0.com](https://auth0.com) |
| Stripe | Premium subscriptions | [dashboard.stripe.com](https://dashboard.stripe.com) |
| Booking.com | Hotel affiliate deeplinks (live inventory opt-in) | [booking.com/affiliate](https://www.booking.com/affiliate) |

See `docs/affiliate-integration.md` for the affiliate plan.
