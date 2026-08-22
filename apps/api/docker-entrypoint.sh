#!/usr/bin/env bash
set -euo pipefail

echo "==> Running database migrations..."
cd /app
bunx prisma migrate deploy
echo "==> Starting Roadtrip4me API..."
exec bun dist/main.js