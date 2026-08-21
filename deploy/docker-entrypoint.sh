#!/usr/bin/env bash
set -euo pipefail

echo "==> Running database migrations..."
bunx prisma migrate deploy
echo "==> Starting Roadtrip4me API..."
exec bun apps/api/dist/main.js