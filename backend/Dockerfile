# ── Stage 1: install production dependencies ─────────────────────────────────
FROM node:25-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --prefer-offline

# ── Stage 2: final runtime image ─────────────────────────────────────────────
FROM node:25-alpine

# ca-certificates ensures TLS connections to external services work on Alpine
RUN apk add --no-cache ca-certificates

RUN adduser -D -u 1001 app
USER app

WORKDIR /app

# Copy only what is needed at runtime
COPY --chown=app:app --from=deps /app/node_modules ./node_modules
COPY --chown=app:app . .

EXPOSE 5000

CMD ["node", "index.js"]
