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
bun run format      # Format with Prettier
```

## External APIs required

| Service | Purpose | Link |
|---|---|---|
| Google Maps | Routing + Places | [console.cloud.google.com](https://console.cloud.google.com) |
| Mapbox | Map display | [mapbox.com](https://mapbox.com) |
| DeepSeek | Stop recommendations | [platform.deepseek.com](https://platform.deepseek.com) |
| Yelp Fusion | Restaurant/activity data | [yelp.com/developers](https://www.yelp.com/developers) |
| Auth0 | Authentication | [auth0.com](https://auth0.com) |
| Booking.com | Hotel affiliate | [booking.com/affiliate](https://www.booking.com/affiliate) |
