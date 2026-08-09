# Roadtrip4me API — production image.
# Build from the repo root: docker build -f apps/api/Dockerfile .
# On boot it applies migrations, then starts the built server.

FROM oven/bun:1 AS build
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile \
  && bunx prisma generate \
  && bun run --cwd apps/api build

FROM oven/bun:1 AS runtime
WORKDIR /app
COPY --from=build /app /app
EXPOSE 3000
CMD ["sh", "-c", "bunx prisma migrate deploy && bun run --cwd apps/api start"]
