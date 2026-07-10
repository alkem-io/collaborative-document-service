# Stage 1: Build the application
# Runs on the builder's native arch (avoids QEMU segfaults when cross-building arm64).
# Safe because the build output and all production dependencies are pure JS.
FROM --platform=$BUILDPLATFORM node:22-slim AS build

WORKDIR /usr/src/app

COPY package.json pnpm-lock.yaml .npmrc ./

# Use pnpm with the lockfile to install all dependencies for building
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# Copy the rest of the source code
COPY . .

# Build the application and trim dev dependencies out of node_modules
RUN pnpm run build && pnpm prune --prod

# Stage 2: Create the production image
FROM gcr.io/distroless/nodejs22-debian12:nonroot

WORKDIR /usr/src/app

# Copy compiled artifacts and production dependencies
COPY --from=build --chown=nonroot:nonroot /usr/src/app/dist ./dist
COPY --from=build --chown=nonroot:nonroot /usr/src/app/node_modules ./node_modules
COPY --from=build --chown=nonroot:nonroot /usr/src/app/config.yml ./config.yml
COPY --from=build --chown=nonroot:nonroot /usr/src/app/package.json ./package.json

ENV NODE_ENV=production

USER nonroot

EXPOSE 4004

CMD ["dist/main.js"]
