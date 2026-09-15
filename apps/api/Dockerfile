# Roadtrip4me API — production image.
# Build context is the repo root (see .github/workflows/deploy.yml), so the
# shared @roadtrip4me/types package is available.

FROM oven/bun:1 AS build
WORKDIR /app
COPY packages/types ./packages/types
COPY apps/api/package.docker.json ./package.json
COPY apps/api/prisma.config.js ./
COPY apps/api/prisma/ ./prisma/
COPY apps/api/src/ ./src/
COPY apps/api/tsconfig.json ./
RUN bun install \
  && bunx prisma generate \
  && bun run build

FROM oven/bun:1-slim AS runtime
RUN useradd --create-home --shell /bin/sh appuser
WORKDIR /app
COPY --from=build --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=build --chown=appuser:appuser /app/dist ./dist
COPY --from=build --chown=appuser:appuser /app/prisma ./prisma
COPY --from=build --chown=appuser:appuser /app/prisma.config.js ./prisma.config.js
COPY --from=build --chown=appuser:appuser /app/package.json ./package.json

USER appuser
EXPOSE 3000
COPY --chown=appuser:appuser docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
ENTRYPOINT ["/docker-entrypoint.sh"]
