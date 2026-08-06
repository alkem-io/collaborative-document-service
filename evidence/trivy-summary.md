# Trivy summary — `collaborative-document-service`

workspace#036-distroless-wave-1 (W1b)

- **Scanner**: Trivy **0.60.0** (`aquasec/trivy@sha256:91c3a842834563a6860dbaec5af7c1949df5caf988f9632ef5cbb0a5cd59d8f8`)
- **Vulnerability DB**: schema 2, `UpdatedAt` **2026-08-05T07:37:03Z**, downloaded 2026-08-05T09:52:45Z
- **Scanned by digest**, not by tag:
  - before `alkemio/collaborative-document-service@sha256:b4d4617ff2392b21d7c4fe0e80c9b8fd763f4eae28cff2a2d3c26f5560b38a98`
  - after  `alkemio/collaborative-document-service@sha256:787cbf8b7f8a6f408e6997f0f7b8ce98ac4dabd4751545ad8f5168550843ea77`
- Raw output: `trivy-before.json`, `trivy-after.json`

## Result

| | CRITICAL | HIGH | MEDIUM | LOW | **fixable HIGH+CRITICAL** |
|---|---|---|---|---|---|
| before (debian12) | 1 | 9 | 10 | 22 | **10** |
| after (debian13 + overrides) | 0 | 0 | 5 | 7 | **0** |

**Gate: zero fixable HIGH/CRITICAL — met.** Base OS moved `debian 12.13` → `debian 13.6`.

## What cleared the 10, and why it took two changes

**7 of 10 were `libssl3`**, all fixed by the debian12 → debian13 retag: CVE-2026-31789
(CRITICAL), CVE-2026-28387, CVE-2026-28388, CVE-2026-28389, CVE-2026-28390,
CVE-2026-45447, plus the 3.0.18 → 3.0.19/3.0.20 stream. distroless debian13 ships an
already-patched openssl, and the whole `libssl3` package is gone from the scanned set.

**The remaining 3 were npm packages and the retag did nothing for them** — they would
have survived the base swap and left the gate at 4:

| CVE | Package | | Severity |
|---|---|---|---|
| CVE-2026-47219 | `find-my-way` | 9.6.0 → 9.7.0 | HIGH — remotely triggerable DoS via HTTP/2 pseudo-method values indexing the router's tree object |
| CVE-2026-16221 | `fast-uri` | 3.1.3 → 3.1.5 | HIGH — backslash not treated as an authority delimiter (host confusion vs Node's WHATWG parser) |
| CVE-2026-18446 | `fast-uri` | 3.1.3 → 3.1.5, 4.1.1 → 4.1.2 | HIGH — same host-confusion class |

These are **transitive and unreachable by ordinary means**: `pnpm update fastify
fast-uri find-my-way --recursive` was a **no-op**, because
`@nestjs/platform-fastify@11.1.28` declares its dependencies with **exact** versions
(`"fastify": "5.10.0"`, `"find-my-way": "9.6.0"`) rather than ranges, and 11.1.28 is
already the latest published 11.x. Nothing in the dependency graph could move.

Fixed with a minimal `pnpm.overrides` block in `package.json`, each entry a
**patch-level bump inside the range the real consumer declares** — so no consumer gets
a version it did not ask for:

| override | justification |
|---|---|
| `find-my-way@<9.7.0` → `9.7.0` | `fastify@5.10.0` itself declares `find-my-way: ^9.6.0`; only NestJS's exact re-pin blocked it |
| `fast-uri@<3.1.5` → `3.1.5` | `ajv@8.20.0` and `@fastify/ajv-compiler@4.0.5` both declare `fast-uri: ^3.0.0` |
| `fast-uri@>=4.0.0 <4.1.2` → `4.1.2` | the 4.x line resolved alongside; same major |

Post-override gates all pass (lint 0 errors, `typecheck:native` clean, 171/171 tests,
image smoke green), so the bumps are behaviour-safe here.

`overridesRationale` in `package.json` records why the block exists and asks the next
`@nestjs/platform-fastify` bump to re-check and drop entries upstream has caught up
with — the block should not outlive its cause.

## Residual risk — 12 findings, all unfixable, none HIGH/CRITICAL

No fix is available in the debian13 stream for any of these; nothing in this repo can
act on them. Recorded, not waived.

### `libc6` 2.41-12+deb13u3 — 11 findings

| CVE | Severity | Reachability |
|---|---|---|
| CVE-2026-5435 | MEDIUM | glibc internals not on this service's request path |
| CVE-2026-5450 | MEDIUM | as above |
| CVE-2026-5928 | MEDIUM | as above |
| CVE-2026-6238 | MEDIUM | as above |
| CVE-2010-4756 | LOW | `glob(3)` expansion — the service never globs; no shell exists in the image to invoke it |
| CVE-2018-20796 | LOW | regex stack exhaustion in `regcomp`/`regexec`; the service compiles no C-locale regexes from untrusted input (JS regex is V8, not glibc) |
| CVE-2019-1010022 | LOW | disputed upstream; stack-guard bypass requiring an existing memory-corruption primitive |
| CVE-2019-1010023 | LOW | disputed; requires attacker-controlled ELF loading — impossible without a shell or writable exec path |
| CVE-2019-1010024 | LOW | disputed; ASLR side channel, requires local code execution |
| CVE-2019-1010025 | LOW | disputed; heap-address prediction, requires local code execution |
| CVE-2019-9192 | LOW | disputed; same `regexec` class as CVE-2018-20796 |

The five "disputed" entries all presuppose local code execution or attacker-supplied
binaries. The distroless runtime has no shell, no package manager, and runs as
non-root uid 65532 with a read-only application tree, so the precondition is not
reachable from the network surface this service exposes (a WebSocket/Hocuspocus
listener on 4004 and an AMQP client).

### `zlib1g` 1:1.3.dfsg+really1.3.1-1+b1 — 1 finding

| CVE | Severity | Reachability |
|---|---|---|
| CVE-2026-27171 | MEDIUM | zlib is pulled in transitively (Node's own compression). The service does not decompress attacker-supplied archives; Yjs document updates are binary CRDT payloads, not zlib streams. No fix available in debian13. |

**Re-check trigger:** these are base-image findings. Rescan when the distroless
`nodejs22-debian13` digest is next re-resolved — a base refresh, not a code change, is
what will clear them.
