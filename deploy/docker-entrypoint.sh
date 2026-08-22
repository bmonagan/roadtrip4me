#!/usr/bin/env bash
set -euo pipefail

echo "==> Running database migrations..."
cd /app/apps/api
bunx prisma migrate deploy
echo "==> Starting Roadtrip4me API..."
cd /app
exec bun apps/api/src/main.ts