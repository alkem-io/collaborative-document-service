# Smoke-harness output — collaborative-document-service (workspace#036-distroless-wave-1)

Re-run **2026-08-06** against a build of the CURRENT committed Dockerfile (post-build
spec prune) with the CURRENT harness (PATH-directory sweep, NATIVE_COUNT
gate, dist-test-free gate). Renamed from `smoke.log` because this repo
`.gitignore`s `*.log` — the prior filename was silently ignored by git, so the
"persisted evidence" was never actually committed (drift-gate finding
collaborative-document-service-spec-compliance-1).

Note: the earlier build shipped 32 spec/test artifacts in dist/ despite the
Dockerfile's claim that tsconfig.prod.json excluded them — nest's SWC builder
ignores tsconfig excludes. Fixed via post-build prune in the Dockerfile (an .swcrc exclude kills the vitest suite, which transforms specs through the same .swcrc); the harness now asserts 0.

```
== distroless-image-smoke: cds-036:prune ==
-- Dockerfile pins --
PASS: all FROM lines are digest-pinned
PASS: Dockerfile has 3 stages (build + proddeps + runtime)
PASS: runtime base is distroless nodejs22-debian13
PASS: no in-place 'pnpm prune --prod' (prod deps come from their own stage)
-- runtime identity --
PASS: configured user is 'nonroot'
PASS: effective UID is 65532 (non-root)
PASS: entrypoint is the distroless node binary
PASS: CMD is ["dist/main.js"]
PASS: PATH directories are empty (no shell / package manager / any binary)
-- image contents --
PASS: no src/ TypeScript tree
PASS: no test/ tree
PASS: no ts-node / tsx / pnpm in node_modules
PASS: config.yml is present
-- prod-deps split --
PASS: dev-only packages absent from runtime node_modules: vitest eslint rimraf @nestjs/cli @nestjs/testing @swc/core @swc/cli vite ts-loader tsconfig-paths unplugin-swc @types/node @vitest/ui
-- dependency load sentinels --
  native *.node addon count = 0 (0 expected: pure-JS production tree)
PASS: dist/ is test-free (0 spec/test artifacts) and production tree is pure JS (0 native addons)
PASS: runtime dependencies load: yjs, @hocuspocus/server, @nestjs/core, @nestjs/platform-fastify, amqplib, winston, yaml
PASS: dist/main.js is present
-- size --
IMAGE_DIGEST=sha256:1d51d069c4340a99fc579c4edefba014a0f680327e9bb99db8abef039fcf95f6
IMAGE_SIZE_BYTES=60164096
BASELINE_IMAGE_SIZE_BYTES=58200576
SIZE_DELTA_PCT=3.37
PASS: size delta 3.37% is within the +5% tolerance
== distroless-image-smoke: ALL CHECKS PASSED ==
```

Boot check (no sidecars): the app starts and reaches its integration layer,
failing only on ECONNREFUSED 127.0.0.1:5672 (RabbitMQ absent) — expected.
