#!/usr/bin/env bash
set -euo pipefail

echo "==> Running database migrations..."
bunx --cwd apps/api prisma migrate deploy

echo "==> Starting Roadtrip4me API..."
exec bun run --cwd apps/api start
