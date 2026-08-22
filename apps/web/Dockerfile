# Roadtrip4me web — SPA served by nginx
# Build context is apps/web/ (Fly app root)

FROM oven/bun:1 AS build
RUN useradd --create-home --shell /bin/sh appuser
WORKDIR /app
COPY packages/types ./packages/types
COPY tsconfig.json vite.config.ts index.html ./
COPY src/ ./src/
COPY nginx.conf ./

# Create a Docker-specific package.json without workspace config
RUN cat > package.json << 'EOF'
{
  "name": "@roadtrip4me/web",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "vite build"
  },
  "dependencies": {
    "@googlemaps/polyline-codec": "^1.0.28",
    "@roadtrip4me/types": "file:./packages/types",
    "@tanstack/react-query": "^5.56.2",
    "@tanstack/react-query-devtools": "^5.56.2",
    "mapbox-gl": "^3.7.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^7.0.0",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.3",
    "@types/mapbox-gl": "^3.4.0",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "jsdom": "^30.0.1",
    "typescript": "^5.5.4",
    "vite": "^6",
    "vitest": "^4.1.10"
  }
}
EOF

RUN --mount=type=cache,target=/root/.bun/install/cache bun install

# Vite env types for import.meta.env (CI runs tsc separately)
RUN cat > src/vite-env.d.ts << 'EOF'
/// <reference types="vite/client" />
EOF

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