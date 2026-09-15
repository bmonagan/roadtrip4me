# Roadtrip4me web — SPA served by nginx
# Build context is the repo root (see .github/workflows/deploy.yml), so the
# shared @roadtrip4me/types package is available.

FROM oven/bun:1 AS build
RUN useradd --create-home --shell /bin/sh appuser
WORKDIR /app
COPY packages/types ./packages/types
COPY apps/web/package.docker.json ./package.json
COPY apps/web/tsconfig.json apps/web/vite.config.ts apps/web/index.html ./
COPY apps/web/public/ ./public/
COPY apps/web/src/ ./src/
COPY apps/web/nginx.conf ./

RUN --mount=type=cache,target=/root/.bun/install/cache bun install

ARG VITE_MAPBOX_TOKEN
ARG VITE_AUTH0_DOMAIN
ARG VITE_AUTH0_CLIENT_ID
ARG VITE_AUTH0_AUDIENCE
ARG VITE_API_URL
ENV VITE_MAPBOX_TOKEN=${VITE_MAPBOX_TOKEN} \
    VITE_AUTH0_DOMAIN=${VITE_AUTH0_DOMAIN} \
    VITE_AUTH0_CLIENT_ID=${VITE_AUTH0_CLIENT_ID} \
    VITE_AUTH0_AUDIENCE=${VITE_AUTH0_AUDIENCE} \
    VITE_API_URL=${VITE_API_URL}

RUN bun run build

FROM nginx:alpine
COPY --from=build /app/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
