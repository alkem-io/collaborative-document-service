# --- Builder stage ---
FROM node:22.22.0-alpine AS builder
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (dev + prod)
RUN corepack enable && pnpm install

# Copy source code
COPY . .

# Build app (includes tsc-esm-fix if in your scripts)
RUN pnpm run build

# Optional: prune dev dependencies for production
RUN pnpm prune --prod

# --- Runtime stage ---
FROM node:22.22.0-alpine
WORKDIR /app

# Copy compiled app and production dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/config.yml ./config.yml
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production
EXPOSE 4004

# Start the app
CMD ["node", "dist/main.js"]
