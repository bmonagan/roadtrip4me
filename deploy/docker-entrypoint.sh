#!/usr/bin/env bash
set -euo pipefail

echo "==> Starting Roadtrip4me API..."
exec bun apps/api/dist/main.js