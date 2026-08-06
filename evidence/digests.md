# Base-image digests — `collaborative-document-service`

workspace#036-distroless-wave-1 (W1b) · resolved **2026-08-05** on this host.
Digests drift; re-resolve before reuse.

## Before

| Stage | Reference | Pinned? |
|---|---|---|
| builder | `node:22-slim` | **No — floating tag** |
| runtime | `gcr.io/distroless/nodejs22-debian12:nonroot` | **No — floating tag** |

At resolution time `node:22-slim` pointed at index
`sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436`
(created `2026-08-05T00:48:47Z`, i.e. rebuilt the same day) and
`gcr.io/distroless/nodejs22-debian12:nonroot` at
`sha256:13593b7570658e8477de39e2f4a1dd25db2f836d68a0ba771251572d23bb4f8e`.
Both are recorded only to give the before/after comparison a fixed point — neither was
pinned in the Dockerfile, so neither was stable.

**This is what US2-AS1 exists for.** `node:22-slim` re-resolved silently on every build:
two builds of the same commit, days apart, could ship different toolchains and
different OS packages with no diff to show for it.

## After — both pins are manifest-list (OCI index) digests

| Stage | Reference |
|---|---|
| builder (`build`, `proddeps`) | `node:22.23.1-trixie-slim@sha256:e6d9a389d34ff9678438af985c9913fbd1eb6ed36e80fea56644f4b4f6dd70ba` |
| runtime | `gcr.io/distroless/nodejs22-debian13:nonroot@sha256:939d6f1671529d230f50b563578e9b5d206af58f038b10ebd7e1233023d4e167` |

Both verified as `application/vnd.oci.image.index.v1+json` (an OCI **index**, not a
per-architecture child manifest). This matters: this repo's release workflow builds
`linux/amd64,linux/arm64`, and a child digest would pin one architecture and break the
other leg.

```
$ docker buildx imagetools inspect node:22.23.1-trixie-slim
MediaType: application/vnd.oci.image.index.v1+json
Digest:    sha256:e6d9a389d34ff9678438af985c9913fbd1eb6ed36e80fea56644f4b4f6dd70ba
  linux/amd64, linux/arm64/v8, linux/ppc64le, linux/s390x

$ docker buildx imagetools inspect gcr.io/distroless/nodejs22-debian13:nonroot
MediaType: application/vnd.oci.image.index.v1+json
Digest:    sha256:939d6f1671529d230f50b563578e9b5d206af58f038b10ebd7e1233023d4e167
  linux/amd64, linux/arm64, linux/arm, linux/s390x, linux/ppc64le
```

Re-resolve with those two commands; copy the top-level `Digest:` whose MediaType is
`...image.index.v1+json`.

## Builder choice — a documented deviation from the task file

The task file (CDS-2) instructs pinning **`node:22.17.0-slim`** (bookworm), on the
stated grounds that Volta pins `22.17.0` and `node:22.17.0-trixie-slim` "does not
exist (trixie tags start at 22.22.0; verified `ERROR: not found`)".

Both premises are stale as of 2026-08-05:

- `package.json` pins Volta **`node: 22.23.1`**, not `22.17.0`.
- **`node:22.23.1-trixie-slim` exists** and is a multi-arch index (amd64 + arm64 among
  others) — consistent with the task file's own note that trixie tags begin at 22.22.0,
  since 22.23.1 > 22.22.0.

So the constraint that forced a bookworm builder is gone, and honouring the *intent*
(match the Volta pin) yields trixie for free. The builder is therefore
`node:22.23.1-trixie-slim`, which gives a stronger property than the task file settled
for:

| | builder glibc | runtime glibc |
|---|---|---|
| task file's `22.17.0-slim` (bookworm) | 2.36 | 2.41 (trixie) — **mismatch, relies on backward compat** |
| chosen `22.23.1-trixie-slim` | **2.41** | **2.41** — **exact match** |

Verified: `ldd (Debian GLIBC 2.41-12+deb13u3) 2.41` in the builder, and trivy reports
`debian 13.6` for the runtime. Node major and ABI (127) are unchanged either way. The
Volta pin was **not** modified — the task file's "do not bump the Volta pin" constraint
is respected; the pin already said 22.23.1.

## `--platform=$BUILDPLATFORM` retained (deviation from the task file's sketch)

The proposed Dockerfile in CDS-4 drops the `--platform=$BUILDPLATFORM` that the
original build stage carried. It is **kept** on both builder stages.

Without it, the arm64 leg of the release build runs the entire `pnpm install` plus
`nest build` under QEMU emulation — far slower, and the original file's own comment
records that this previously caused QEMU segfaults.

It is safe here for the reason that comment gives, re-verified rather than assumed:
the production dependency tree contains **zero native addons** (`0` `*.node` binaries
found by walking `node_modules` inside the built image), and `dist/` is transpiled
JavaScript. `bufferutil` and `utf-8-validate` — ws's optional native accelerators — are
**not** installed. Only the final runtime stage is architecture-specific, and it is
resolved per-target from the distroless index.
