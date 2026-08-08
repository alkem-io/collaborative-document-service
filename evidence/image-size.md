# Image size — `collaborative-document-service`

workspace#036-distroless-wave-1 (W1b) · measured 2026-08-05, linux/amd64.

| | `docker images` (uncompressed) | `docker save \| wc -c` |
|---|---|---|
| before — single-stage + `pnpm prune --prod`, distroless **debian12** | **267 MB** | 58,200,576 B (55.5 MiB) |
| after — 3-stage + prod-deps stage, distroless **debian13** | **275 MB** | 60,212,224 B (57.4 MiB) |
| delta | **+8 MB (+3.0%)** | **+2,011,648 B (+3.46%)** |

(`036-multiarch` reports 335 MB because that tag holds *both* architectures' layers;
the per-architecture size is the 275 MB figure.)

## The image grew slightly, and that is the expected outcome

The task file (CDS-13) anticipated "the wave's clearest size win from the prod-deps
split". **That did not happen, and the premise turns out not to hold for this repo.**

Measured directly rather than assumed: dev-only packages were probed inside the
**before** image and were *already absent* —

```
absent  vitest      absent  eslint     absent  typescript
absent  rimraf      absent  @nestjs/cli  absent  @swc/core
absent  vite        absent  ts-loader  absent  tsx
```

`pnpm prune --prod` was already doing its job correctly. The prod-deps split therefore
produces the **same** runtime dependency tree; it does not remove anything that was
previously shipping.

The +3% is the runtime base moving **debian12 → debian13**, whose distroless layer is
slightly larger. That is the cost of clearing 7 fixable HIGH/CRITICAL `libssl3`
findings — a good trade, and outside this repo's control.

## So what did the split buy, if not size?

1. **Correctness by construction.** The runtime tree is now *built* production-only
   from the lockfile rather than *reduced* to it by mutating a dev tree in place. The
   previous shape was correct but only incidentally — it depended on `prune` reliably
   reversing a full install. A `postinstall` side effect or a `prune` regression would
   have shipped silently; now dev packages are never present in the stage that is
   copied from.
2. **Cache independence.** Production dependencies no longer invalidate when a
   devDependency changes, and vice versa.
3. **A verified invariant.** `.docker/distroless-image-smoke.sh` asserts the absence of
   13 dev-only packages (each first confirmed to be a pure `devDependency` in
   `package.json`, so the assertion cannot silently pass against a moved dependency).
   The property is now enforced, not assumed.

## Size gate

`.docker/distroless-image-smoke.sh` gates **no-regression** (+5% tolerance), not a
reduction target. workspace#026's ≥40%-reduction budget applied to repos moving *off* a
fat `node:slim` runtime; this repo was already distroless before this wave, so a large
reduction was never available. Measured delta +3.46% passes.
