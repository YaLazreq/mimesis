# ── Stage 1: Build Next.js standalone ─────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Next.js reads .env.production automatically during build
# which contains the Cloud Run backend URLs
RUN npm run build

# ── Stage 2: Runtime (minimal) ───────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Cloud Run convention
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
