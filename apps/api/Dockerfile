# Roadtrip4me API — production image.
# Build context is apps/api/ (Fly app root)

FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock packages/ ./
COPY prisma.config.js ./
COPY prisma/ ./prisma/
COPY src/ ./src/
COPY tsconfig.json ./
RUN bun install --frozen-lockfile \
  && bunx prisma generate \
  && bun run build

FROM oven/bun:1-slim AS runtime
RUN useradd --create-home --shell /bin/sh appuser
WORKDIR /app
COPY --from=build --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=build --chown=appuser:appuser /app/dist ./dist
COPY --from=build --chown=appuser:appuser /app/prisma ./prisma
COPY --from=build --chown=appuser:appuser /app/package.json ./package.json

USER appuser
EXPOSE 3000
COPY --chown=appuser:appuser docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
ENTRYPOINT ["/docker-entrypoint.sh"]
