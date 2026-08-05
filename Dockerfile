# syntax=docker/dockerfile:1
#
# collaborative-document-service — distroless runtime image
# workspace#036-distroless-wave-1 (sub-wave W1b) · epic alkem-io/infrastructure-operations#2499
#
# ---------------------------------------------------------------------------
# PINS — all three FROM lines are digest-pinned to a MANIFEST LIST (OCI index),
# never to a per-architecture child manifest. A child digest would break the
# linux/arm64 leg of the release build (build-release-docker-hub.yml builds
# linux/amd64,linux/arm64).
#
#   node:22.23.1-trixie-slim          @sha256:e6d9a389d34ff9678438af985c9913fbd1eb6ed36e80fea56644f4b4f6dd70ba
#   gcr.io/distroless/nodejs22-debian13:nonroot
#                                     @sha256:939d6f1671529d230f50b563578e9b5d206af58f038b10ebd7e1233023d4e167
#
# Resolved 2026-08-05. Digests drift — RE-RESOLVE before relying on them:
#   docker buildx imagetools inspect node:22.23.1-trixie-slim
#   docker buildx imagetools inspect gcr.io/distroless/nodejs22-debian13:nonroot
# The value to copy is the top-level `Digest:` whose MediaType is
# `application/vnd.oci.image.index.v1+json`.
#
# ---------------------------------------------------------------------------
# THREE COUPLED CHANGES in this file (see tasks/collaborative-document-service.md)
#
#  1. DE-FLOAT. The builder was `FROM node:22-slim` — a floating tag. It silently
#     re-resolved on every build (it pointed at a 2026-08-05 rebuild of
#     22.23.x at the time of writing), so builds were not reproducible. It is now
#     a concrete, digest-pinned version.
#
#  2. SPLIT. The image was single-builder with `pnpm prune --prod` mutating
#     node_modules in place. Production dependencies are now resolved in their own
#     `proddeps` stage from the lockfile. The runtime tree is therefore *constructed*
#     as production-only rather than *reduced* to it, and the two installs cache
#     independently.
#
#  3. RETAG. Runtime moves from distroless `nodejs22-debian12` to `nodejs22-debian13`.
#     This is CVE hygiene (it clears 7 fixable HIGH/CRITICAL libssl3 findings that
#     have no fix in the debian12 stream), not an ABI necessity — the Node major and
#     its ABI (127) are unchanged.
#
# ---------------------------------------------------------------------------
# BUILDER / RUNTIME OS PAIRING
#
# Builder and runtime are both Debian trixie (glibc 2.41), so the toolchain glibc
# exactly matches the runtime glibc. `package.json` pins Volta node 22.23.1 and
# `node:22.23.1-trixie-slim` exists as a multi-arch index, so no version drift is
# needed to obtain the match.
#
# `--platform=$BUILDPLATFORM` keeps both build stages on the builder's native
# architecture instead of running them under QEMU for the arm64 leg. This is safe
# and deliberate: the production dependency tree contains zero native addons
# (verified — 0 `*.node` binaries under node_modules), and `dist/` is transpiled
# JavaScript. Only the final runtime stage is architecture-specific, and it is
# resolved per-target from the distroless index. Removing this flag would make the
# arm64 release build run the whole pnpm install + nest build under emulation.
# ---------------------------------------------------------------------------

# Stage 1: compile TypeScript -> dist/
FROM --platform=$BUILDPLATFORM node:22.23.1-trixie-slim@sha256:e6d9a389d34ff9678438af985c9913fbd1eb6ed36e80fea56644f4b4f6dd70ba AS build

WORKDIR /usr/src/app

COPY package.json pnpm-lock.yaml .npmrc ./

# Full dependency set (dev included) — the compiler and Nest CLI live in devDependencies.
RUN corepack enable pnpm && pnpm install --frozen-lockfile

COPY . .

# `build` = `node --run build:clean && nest build --path tsconfig.prod.json`.
# tsconfig.prod.json excludes **/*.spec.ts and **/*.test.ts, so dist/ is test-free.
# NOTE: no `pnpm prune --prod` here any more — see coupled change 2 above.
RUN pnpm run build

# Stage 2: resolve production-only dependencies from the lockfile
FROM --platform=$BUILDPLATFORM node:22.23.1-trixie-slim@sha256:e6d9a389d34ff9678438af985c9913fbd1eb6ed36e80fea56644f4b4f6dd70ba AS proddeps

WORKDIR /usr/src/app

COPY package.json pnpm-lock.yaml .npmrc ./

# --prod resolves the same locked versions as stage 1, minus devDependencies.
# `--ignore-scripts` keeps dependency lifecycle scripts out of the artifact path;
# no production dependency requires a build step (zero native addons).
RUN corepack enable pnpm && pnpm install --frozen-lockfile --prod --ignore-scripts

# Stage 3: distroless runtime
FROM gcr.io/distroless/nodejs22-debian13:nonroot@sha256:939d6f1671529d230f50b563578e9b5d206af58f038b10ebd7e1233023d4e167

WORKDIR /usr/src/app

# Copy compiled artifacts and production dependencies.
# NOTE: this repo uses NAME-based `--chown=nonroot:nonroot` plus an explicit
# `USER nonroot`, unlike notifications / whiteboard-collaboration-service which use
# numeric 65532. That difference is intentional and preserved — do not harmonise.
COPY --from=proddeps --chown=nonroot:nonroot /usr/src/app/node_modules ./node_modules
COPY --from=build    --chown=nonroot:nonroot /usr/src/app/dist ./dist
# config.yml is read at boot by the config loader — it must be in the image.
COPY --from=build    --chown=nonroot:nonroot /usr/src/app/config.yml ./config.yml
COPY --from=build    --chown=nonroot:nonroot /usr/src/app/package.json ./package.json

ENV NODE_ENV=production

USER nonroot

EXPOSE 4004

# The distroless base's ENTRYPOINT is /nodejs/bin/node; CMD is its argument list.
CMD ["dist/main.js"]
