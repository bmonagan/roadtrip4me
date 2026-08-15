# Roadtrip4me API — production image.
# Build from the repo root: docker build -f apps/api/Dockerfile .

FROM oven/bun:1 AS build
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile \
  && bunx prisma generate \
  && bun run --cwd apps/api build

FROM oven/bun:1-slim AS runtime
RUN useradd --create-home --shell /bin/sh appuser
WORKDIR /app
COPY --from=build --chown=appuser:appuser /app /app

USER appuser
EXPOSE 3000
COPY --chown=appuser:appuser deploy/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
ENTRYPOINT ["/docker-entrypoint.sh"]
