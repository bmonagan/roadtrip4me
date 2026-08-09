# Roadtrip4me 🚗

AI-powered road trip planner with community stop recommendations and travel affiliate integration.

## Stack

| Layer | Technology |
|---|---|
| Runtime | Bun |
| Frontend | React 18 · TypeScript · Vite · Mapbox GL JS · TanStack Query |
| Backend | NestJS · Fastify · TypeScript |
| Database | PostgreSQL 16 + PostGIS · Prisma ORM |
| Cache / Queue | Redis · BullMQ |
| Auth | Auth0 |
| Monorepo | Bun workspaces |

## Project structure

```
roadtrip4me/
├── apps/
│   ├── web/          React + Vite frontend
│   └── api/          NestJS backend
├── packages/
│   └── types/        Shared TypeScript interfaces (Trip, Stop, Vote, etc.)
├── docker-compose.yml  Local Postgres + Redis
└── package.json       Bun workspace root
```

## Prerequisites

- [Bun](https://bun.sh) >= 1.x
- [Docker](https://docker.com) + Docker Compose

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

Fill in the required values in both `.env` files. At minimum you need:
- `VITE_MAPBOX_TOKEN` — from [mapbox.com](https://mapbox.com)
- `GOOGLE_MAPS_API_KEY` — from [Google Cloud Console](https://console.cloud.google.com)

### 3. Start local infrastructure

```bash
docker compose up -d
```

This starts:
- PostgreSQL + PostGIS on port 5432
- Redis on port 6379

### 4. Start development servers

```bash
# Both frontend and backend in parallel
bun run dev

# Or individually
bun run dev:web   # http://localhost:5173
bun run dev:api   # http://localhost:3000
```

## API health check

```bash
curl http://localhost:3000/api/v1/health
```

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

## Production deployment

The stack deploys as three containers behind one origin (nginx serves the SPA
and reverse-proxies `/api` to the API — no CORS exposure):

```bash
cp .env.prod.example .env.prod    # fill in real values
docker compose -f docker-compose.prod.yml up -d --build
```

The API container applies migrations (`prisma migrate deploy`) on boot, then
starts the compiled bundle. The web container bakes `VITE_MAPBOX_TOKEN` and the
Auth0 config into the static build.

**Production checklist:**

- Set `AUTH_DISABLED=false` and configure `AUTH0_DOMAIN`/`AUTH0_AUDIENCE` (see
  `SECURITY.md`) — never leave the dev `x-user-id` fallback enabled in prod.
- Provision a real Postgres (PostGIS) + Redis, or attach volumes for the
  compose services; take regular backups of `postgres_data`.
- Point a domain at the web container and terminate TLS (Caddy/Let's Encrypt or
  a load balancer) in front of it.
- Keep API keys in a secret manager / `.env.prod`; never commit them.

## External APIs required

| Service | Purpose | Link |
|---|---|---|
| Google Maps (Routes) | Driving routes + polylines | [console.cloud.google.com](https://console.cloud.google.com) |
| Google Maps (Places) | Verify AI stop coordinates | [console.cloud.google.com](https://console.cloud.google.com) |
| Mapbox | Map display + geocoding | [mapbox.com](https://mapbox.com) |
| DeepSeek | Stop recommendations | [platform.deepseek.com](https://platform.deepseek.com) |
| Auth0 | Authentication | [auth0.com](https://auth0.com) |
| Booking.com | Hotel affiliate | [booking.com/affiliate](https://www.booking.com/affiliate) |
