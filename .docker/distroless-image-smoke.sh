#!/usr/bin/env bash
# workspace#036-distroless-wave-1 (sub-wave W1b) — persisted image regression.
# epic alkem-io/infrastructure-operations#2499
#
# Mechanically asserts the collaborative-document-service runtime-image contract.
# This slice made THREE coupled changes; each has a dedicated assertion group so a
# regression in any one of them fails loudly rather than degrading silently:
#
#   1. DE-FLOAT  -> "Dockerfile pins" group: every FROM carries an @sha256: digest.
#                   This is a HARD FAILURE, not a warning — it is the specific
#                   regression that reintroduces `FROM node:22-slim`.
#   2. SPLIT     -> "prod-deps split" group: dev-only packages are absent from the
#                   runtime node_modules, proving the tree was built production-only
#                   rather than pruned in place.
#   3. RETAG     -> covered by the trivy gate in CI, not here.
#
# Plus the baseline distroless contract: nonroot user, no shell, no package
# manager, no source tree, the process's own dependencies actually load, and
# config.yml (read at boot) is present.
#
# Usage:
#   .docker/distroless-image-smoke.sh <image[:tag]> [baseline_size_bytes]
#
# Baseline default 58200576 bytes = `docker save | wc -c` of the pre-change image
# (single-stage builder on floating node:22-slim + distroless nodejs22-debian12),
# built from this repo at 036 branch point and measured 2026-08-05.
#
# NOTE ON THE SIZE BUDGET: unlike workspace#026 (which moved a fat node:slim
# runtime to distroless and mandated >=40% reduction), this repo was ALREADY
# distroless. The three changes here are reproducibility, build hygiene and CVE
# posture — not size. `pnpm prune --prod` already removed devDependencies, so no
# large reduction is expected or required. The gate below therefore asserts NO
# REGRESSION (image must not grow beyond a small tolerance), which is the property
# that actually matters for this slice.
set -euo pipefail

IMAGE="${1:?usage: distroless-image-smoke.sh <image> [baseline_size_bytes]}"
BASELINE_IMAGE_SIZE_BYTES="${2:-58200576}"
# Allow +5%: the runtime OS moved debian12 -> debian13 and its base layer size is
# not under this repo's control. Growth beyond that is a real regression.
MAX_GROWTH_PCT=5

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DOCKERFILE="$REPO_ROOT/Dockerfile"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

pass() {
  echo "PASS: $*"
}

run_node() {
  docker run --rm --entrypoint /nodejs/bin/node "$IMAGE" "$@"
}

# Returns "true"/"false" for the existence of a path inside the image.
exists_in_image() {
  run_node -e "console.log(require('fs').existsSync(process.argv[1]))" "$1"
}

echo "== distroless-image-smoke: $IMAGE =="

# --- CHANGE 1 (de-float): every FROM must be digest-pinned -----------------
# Hard gate. Checked against the Dockerfile on disk, since a floating base tag is
# not recoverable from the built image's metadata.
echo "-- Dockerfile pins --"
[ -f "$DOCKERFILE" ] || fail "Dockerfile not found at $DOCKERFILE"

UNPINNED="$(grep -E '^\s*FROM ' "$DOCKERFILE" | grep -v '@sha256:' || true)"
if [ -n "$UNPINNED" ]; then
  echo "$UNPINNED" >&2
  fail "every FROM must be digest-pinned (@sha256:) — floating base tag(s) found above"
fi
pass "all FROM lines are digest-pinned"

FROM_COUNT="$(grep -cE '^\s*FROM ' "$DOCKERFILE")"
[ "$FROM_COUNT" -ge 3 ] ||
  fail "expected >=3 stages (build + proddeps + runtime), found $FROM_COUNT"
pass "Dockerfile has $FROM_COUNT stages (build + proddeps + runtime)"

grep -qE '^\s*FROM .*distroless/nodejs22-debian13' "$DOCKERFILE" ||
  fail "runtime stage must be distroless nodejs22-debian13 (change 3: retag)"
pass "runtime base is distroless nodejs22-debian13"

# Match executable instructions only — comment lines legitimately mention the
# removed command when explaining why it is gone.
if grep -E '^\s*(RUN|CMD|ENTRYPOINT)\b' "$DOCKERFILE" | grep -q 'pnpm prune'; then
  fail "'pnpm prune --prod' is back — the prod-deps stage should make it unnecessary (change 2)"
fi
pass "no in-place 'pnpm prune --prod' (prod deps come from their own stage)"

# --- user / entrypoint / CMD ----------------------------------------------
echo "-- runtime identity --"
USER_ID="$(docker inspect "$IMAGE" --format '{{.Config.User}}')"
# This repo deliberately uses the NAME form (`USER nonroot`), unlike notifications
# and whiteboard-collaboration-service which use numeric 65532. Both are accepted
# here; the distroless `nonroot` account IS uid 65532 (asserted below).
[ "$USER_ID" = "65532" ] || [ "$USER_ID" = "nonroot" ] ||
  fail "expected user 65532/nonroot, got '$USER_ID'"
pass "configured user is '$USER_ID'"

# Assert the EFFECTIVE uid, not just the label — `nonroot` must really be 65532.
EFFECTIVE_UID="$(run_node -e "console.log(process.getuid())")"
[ "$EFFECTIVE_UID" = "65532" ] ||
  fail "expected effective UID 65532, got '$EFFECTIVE_UID'"
pass "effective UID is 65532 (non-root)"

ENTRYPOINT_JSON="$(docker inspect "$IMAGE" --format '{{json .Config.Entrypoint}}')"
echo "$ENTRYPOINT_JSON" | grep -q '/nodejs/bin/node' ||
  fail "expected distroless node entrypoint, got $ENTRYPOINT_JSON"
pass "entrypoint is the distroless node binary"

CMD_JSON="$(docker inspect "$IMAGE" --format '{{json .Config.Cmd}}')"
[ "$CMD_JSON" = '["dist/main.js"]' ] || fail "expected CMD [\"dist/main.js\"], got $CMD_JSON"
pass "CMD is [\"dist/main.js\"]"

# --- no shell / no package manager -----------------------------------------
# Probe for EXISTENCE on the filesystem, not exit status. A bare `docker run
# --entrypoint apk <img>` exits non-zero on an image that HAS a working apk
# (apk with no args is a usage error), so an exit-status test reports present
# binaries as absent — it has no detection power. lstat (not existsSync) so a
# dangling symlink still counts as a hit; Google's :debug variants put the
# shell at /busybox/sh -> /busybox/busybox.
FORBIDDEN="$(run_node -e "
const fs = require('fs');
const paths = [
  '/bin/sh','/bin/bash','/usr/bin/sh','/usr/bin/bash',
  '/busybox/sh','/busybox/busybox','/bin/busybox','/usr/bin/busybox',
  '/sbin/apk','/usr/bin/apk','/usr/bin/apt','/usr/bin/apt-get','/usr/bin/dpkg',
  '/usr/local/bin/npm','/usr/local/bin/npx','/usr/local/bin/yarn','/usr/local/bin/pnpm',
  '/usr/bin/npm','/usr/bin/yarn','/usr/bin/pnpm',
];
const hits = paths.filter(p => { try { fs.lstatSync(p); return true; } catch { return false; } });
console.log(hits.join(','));
")"
[ -z "$FORBIDDEN" ] || fail "shell/package-manager present in runtime image: $FORBIDDEN"
pass "no shell / package manager present on the filesystem"

# --- no source tree, no dev tooling in the image ---------------------------
echo "-- image contents --"
[ "$(exists_in_image /usr/src/app/src)" = "false" ] ||
  fail "expected no src/ TypeScript tree in the runtime image"
pass "no src/ TypeScript tree"

[ "$(exists_in_image /usr/src/app/test)" = "false" ] ||
  fail "expected no test/ tree in the runtime image"
pass "no test/ tree"

for m in ts-node tsx pnpm; do
  [ "$(exists_in_image "/usr/src/app/node_modules/$m")" = "false" ] ||
    fail "expected no $m in node_modules"
done
pass "no ts-node / tsx / pnpm in node_modules"

# config.yml is read at boot by the config loader — its absence is a boot failure.
[ "$(exists_in_image /usr/src/app/config.yml)" = "true" ] ||
  fail "config.yml is missing — the service reads it at startup"
pass "config.yml is present"

# --- CHANGE 2 (prod-deps split): dev-only packages must be absent ----------
# Every name below is verified to live in devDependencies in package.json before
# being asserted absent, so this cannot silently pass against a moved dependency.
echo "-- prod-deps split --"
DEV_ONLY_CHECKED=()
for m in vitest eslint rimraf "@nestjs/cli" "@nestjs/testing" "@swc/core" "@swc/cli" \
         vite ts-loader tsconfig-paths unplugin-swc "@types/node" "@vitest/ui"; do
  if node -e "
    const p = require('$REPO_ROOT/package.json');
    const dev = Object.keys(p.devDependencies || {});
    const prod = Object.keys(p.dependencies || {});
    if (!dev.includes('$m') || prod.includes('$m')) process.exit(1);
  " 2>/dev/null; then
    [ "$(exists_in_image "/usr/src/app/node_modules/$m")" = "false" ] ||
      fail "dev-only package '$m' is present in the runtime node_modules — the prod-deps split did not take effect"
    DEV_ONLY_CHECKED+=("$m")
  else
    echo "  note: skipping '$m' — not a pure devDependency in package.json"
  fi
done
[ "${#DEV_ONLY_CHECKED[@]}" -ge 5 ] ||
  fail "verified too few dev-only packages (${#DEV_ONLY_CHECKED[@]}); the assertion is not meaningful"
pass "dev-only packages absent from runtime node_modules: ${DEV_ONLY_CHECKED[*]}"

# --- dependency load sentinels --------------------------------------------
# `bufferutil` and `utf-8-validate` are ws's OPTIONAL native accelerators. They are
# NOT installed in this image (verified: the production tree contains zero *.node
# binaries), so asserting them would be a false gate. Per CDS-8 we substitute the
# real runtime-critical dependencies and record the substitution here.
echo "-- dependency load sentinels --"
NATIVE_COUNT="$(run_node -e "
  const fs=require('fs'), p=require('path');
  let n=0;
  (function w(d){ for (const e of fs.readdirSync(d,{withFileTypes:true})) {
    const f=p.join(d,e.name);
    if (e.isDirectory()) w(f); else if (e.name.endsWith('.node')) n++;
  }})('/usr/src/app/node_modules');
  console.log(n);
")"
echo "  native *.node addon count = $NATIVE_COUNT (0 expected: pure-JS production tree)"

for m in yjs @hocuspocus/server @nestjs/core @nestjs/platform-fastify amqplib winston yaml; do
  OUT="$(run_node -e "
    const { createRequire } = require('module');
    const r = createRequire('/usr/src/app/');
    r(process.argv[1]);
    console.log('ok');
  " "$m" 2>&1)" || fail "dependency '$m' failed to load: $OUT"
  [ "$OUT" = "ok" ] || fail "dependency '$m' failed to load: $OUT"
done
pass "runtime dependencies load: yjs, @hocuspocus/server, @nestjs/core, @nestjs/platform-fastify, amqplib, winston, yaml"

# --- the built artifact is loadable ----------------------------------------
[ "$(exists_in_image /usr/src/app/dist/main.js)" = "true" ] ||
  fail "dist/main.js is missing"
pass "dist/main.js is present"

# --- size: assert NO REGRESSION (see header note) --------------------------
echo "-- size --"
IMAGE_DIGEST="$(docker inspect "$IMAGE" --format '{{.Id}}')"
IMAGE_SIZE_BYTES="$(docker save "$IMAGE" | wc -c)"
echo "IMAGE_DIGEST=$IMAGE_DIGEST"
echo "IMAGE_SIZE_BYTES=$IMAGE_SIZE_BYTES"
echo "BASELINE_IMAGE_SIZE_BYTES=$BASELINE_IMAGE_SIZE_BYTES"

DELTA_PCT="$(awk -v new="$IMAGE_SIZE_BYTES" -v old="$BASELINE_IMAGE_SIZE_BYTES" \
  'BEGIN { printf "%.2f", ((new / old) - 1) * 100 }')"
echo "SIZE_DELTA_PCT=$DELTA_PCT"

awk -v d="$DELTA_PCT" -v max="$MAX_GROWTH_PCT" 'BEGIN { exit !(d <= max) }' ||
  fail "image grew ${DELTA_PCT}% vs baseline, above the ${MAX_GROWTH_PCT}% tolerance"
pass "size delta ${DELTA_PCT}% is within the +${MAX_GROWTH_PCT}% tolerance"

echo "== distroless-image-smoke: ALL CHECKS PASSED =="
