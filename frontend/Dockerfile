# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:25-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline

COPY . .
ARG VITE_CDN_BASE
ARG VITE_CDN_ADMIN_TOKEN
RUN npm run build

# ── Stage 2: serve static files with Caddy ────────────────────────────────────
FROM caddy:alpine

RUN apk add --no-cache wget

# Copy built SPA assets — Caddy serves them via file_server in the Caddyfile
COPY --from=builder /app/dist /srv
