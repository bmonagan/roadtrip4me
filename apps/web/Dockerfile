# Roadtrip4me web — SPA served by nginx
# Build context is apps/web/ (Fly app root)

FROM oven/bun:1 AS build
RUN useradd --create-home --shell /bin/sh appuser
WORKDIR /app
COPY packages/types ./packages/types
COPY package.docker.json package.json
COPY tsconfig.json vite.config.ts index.html ./
COPY public/ ./public/
COPY src/ ./src/
COPY nginx.conf ./

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