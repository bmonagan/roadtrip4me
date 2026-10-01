# Deployment (historical reference)

> **Status: decommissioned.** Roadtrip4me is now a portfolio/showcase project.
> The production Fly.io apps, database volume, IPs, TLS certificates, and GitHub
> Actions deploy pipeline have all been destroyed. This document is kept as a
> record of how the project was operated and as a reference for anyone who
> wants to self-host it.

## Architecture

The app ran on three Fly.io apps in the `ord` (Chicago) region:

| App | What it ran | Machine |
|---|---|---|
| `roadtrip4me-web` | Static SPA behind nginx | shared-cpu-1x |
| `roadtrip4me-api` | NestJS API | shared-cpu-2x |
| `roadtrip4me-db`  | PostgreSQL 16 + PostGIS (flex) | shared-cpu-1x, 10 GB volume |

The web app was served at `https://roadtrip4me.com` (and `www`), the API at
`https://api.roadtrip4me.com`. The API applied migrations on boot
(`prisma migrate deploy`).

**Scale behavior:** the API and web machines scaled to zero when idle
(`min_machines_running = 0`) and woke on traffic; the database stayed always-on.

## Pipeline

Deploys were automated by GitHub Actions (`.github/workflows/deploy.yml`, since
removed): push to `main` → CI (typecheck, lint, test, build) → `flyctl deploy`
for the API and web. Production secrets were stored as Fly secrets and GitHub
Actions secrets. See `.env.prod.example` for the full variable reference.

## Manual deploy

Run from the repo root — the build context is the whole monorepo.

```bash
# API
fly deploy . --remote-only --app roadtrip4me-api \
  --config apps/api/fly.toml --dockerfile apps/api/Dockerfile

# Web
fly deploy . --remote-only --app roadtrip4me-web \
  --config apps/web/fly.toml --dockerfile apps/web/Dockerfile
```

`VITE_*` variables are baked into the web bundle at build time and passed as
Docker build args, not runtime secrets.

## Environment variables

Production values are documented in [`.env.prod.example`](../.env.prod.example).
Locally, use `apps/api/.env.example` and `apps/web/.env.example`. In `DEMO_MODE`
the API needs no paid keys — see the README.

## Dependencies of the hosted setup (all external, not in this repo)

- **DNS** — `roadtrip4me.com` (registrar: Porkbun) with `A`/`AAAA` records
  pointing at the Fly ingress IPs.
- **Auth0** — tenant for authentication (Authorization Code + PKCE).
- **Stripe** — Premium subscription product, price, and webhook endpoint.
- **Google Cloud** — Routes + Places API keys.
- **DeepSeek** — AI recommendation API key.
- **Mapbox** — public display token (URL-restricted).
