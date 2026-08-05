# Manifest-consumer inventory — `collaborative-document-service`

workspace#036-distroless-wave-1 (W1b) · epic alkem-io/infrastructure-operations#2499
Reproduced 2026-08-05.

## How this was reproduced (and a warning about the documented command)

The command in the task file under-reports. Inside a Claude Code shell, `grep` is a
**shell function** that wraps the harness binary with `--ignore-files`, so it honours
`.gitignore`. Every sibling repo is gitignored at the workspace root, therefore a
recursive `grep` from `/home/vyanakiev/source/alkemio` **silently skips
`dev-orchestration/`, `infrastructure-operations/`, and the sibling clones** and
returns only matches inside `specs/`. It exits 0, so it looks like a clean, complete
result.

This is a plausible mechanism for the workspace#026 miss that caused the dev outage
(server#6335): the survey command reports "no other consumers" rather than erroring.

Use the real binary and explicit paths:

```bash
/usr/bin/grep -rn --include='*.yml' --include='*.yaml' -E \
  '(alkemio/collaborative-document-service|rg\.nl-ams\.scw\.cloud/alkemio/alkemio-collaborative-document-service)' \
  /home/vyanakiev/source/alkemio
```

Both reference forms were searched. Both are in live use — they are **not**
interchangeable spellings of one consumer:

- `rg.nl-ams.scw.cloud/alkemio/alkemio-collaborative-document-service` — Scaleway
  registry, used by the Hetzner dev/test/sandbox path.
- `alkemio/collaborative-document-service` — Docker Hub, used by acc/prod.

## The three image-setting consumers

| # | Path | Surface | Image ref | Sets `command`/`args`/`securityContext`/`runAsUser`/`volumes`/initContainer? | Action |
|---|------|---------|-----------|------------------------------------------------------------------------------|--------|
| 1 | `dev-orchestration/01-alkemio-platform/base/alkemio/collaboration-platform/backend/collaborative-document-service/11-collaborative-document-service-deployment.yml:23` | dev-orchestration | `rg.nl-ams.scw.cloud/...:64dfb1e6554664b38b22374e979fa90bca230c3c` | **No** to all. Sets `env`, `envFrom`, `ports` (`hocuspocus`/4004), `resources`, `imagePullSecrets`, `affinity`. | No change needed |
| 2 | `collaborative-document-service/manifests/collaborative-document-service-deployment-dev.yaml:21` | in-repo | `rg.nl-ams.scw.cloud/...:latest` | **No** to all. Sets `env`, `envFrom` only — no `ports`, no `resources`. | No change needed |
| 3 | `infrastructure-operations/orchestration/base/alkemio/collaboration-platform/backend/collaborative-document-service/11-collaborative-document-service-deployment.yml:21` | infra-ops | `alkemio/collaborative-document-service:v0.4.0` | **No** to all. Sets `env`, `envFrom`, `ports`, `resources`, `affinity`. | No change needed |

**Why no manifest change is required.** The image swap preserves every interface a
manifest depends on: `ENTRYPOINT` stays the distroless `/nodejs/bin/node`, `CMD` stays
`["dist/main.js"]`, the listening port stays 4004, `WORKDIR` stays `/usr/src/app`, and
the user stays `nonroot` (uid 65532). No consumer overrides the entrypoint or command,
so there is no bare-`node`-on-PATH exposure of the kind workspace#026 hit; none pins a
`runAsUser` that could conflict with the image's own user; and none mounts a volume
over `/usr/src/app`.

### Consumer #2 is the one the pre-survey missed

`manifests/collaborative-document-service-deployment-dev.yaml` was absent from the
operator's pre-survey. It is applied by **all three** Hetzner deploy workflows —
`build-deploy-k8s-dev-hetzner.yml` (`push: [develop]`, so it fires on merge),
`build-deploy-k8s-test-hetzner.yml`, and `build-deploy-k8s-sandbox-hetzner.yml` — via
`Azure/k8s-deploy@v7.0.0`, whose `images:` input rewrites the tag to the built SHA.
This is the manifest that authors the running dev Deployment.

Two things make it easy to miss:

1. **Non-standard filename.** Sibling repos use a `25-`-prefixed name; this one has no
   numeric prefix, so filename-pattern sweeps skip it.
2. It is inside the service repo, not in either orchestration repo.

### Non-image-setting references (verified, no action)

Reviewed and left alone: `10-collaborative-document-service.yml` (Service),
`392-ws-hocuspocus-ingress-route.yml` (Traefik IngressRoute, base + dev/test/sandbox/
acceptance/production overlays), the Oathkeeper access rules pointing at
`http://alkemio-collaborative-document-service:4004`, five infra-ops NetworkPolicies
selecting the app label, and the `acceptance-v3-dark` / `production-v3-dark` overlays
which set `replicas: 0` by deployment name. None references an image tag.

Also present but out of scope: `server/quickstart-services.yml` and
`server/.devcontainer/docker-compose.yml` pull published Docker Hub tags
(`v0.4.0` / `v0.0.1`) for local development. They consume releases, not this build.

## Ruling C4 — the commented-out probe block (follow-up F2)

A fully written `readinessProbe`/`livenessProbe` pair is present but **commented out**.
The task file records it in dev-orchestration only; it is in fact in **both**
orchestration repos, byte-identical:

- `dev-orchestration/.../11-collaborative-document-service-deployment.yml` — **lines 65–85**
- `infrastructure-operations/.../11-collaborative-document-service-deployment.yml` — **lines 63–83**

Both target `httpGet: path: /health, port: 4005`, with
`initialDelaySeconds: 5`, `periodSeconds: 10`, `failureThreshold: 3`, and a
`Host: '127.0.0.1'` header.

**The discrepancy is real, but it is not simply "wrong port".** It has three
independent causes, and F2 must fix all three or the probes will still fail. Verified
by running the newly built image, not by reading alone:

1. **4005 is a real port, but it is not declared to Kubernetes.** `config.yml` defines
   two ports: `ws_port: 4004` (Hocuspocus) and `rest_port: 4005`. `src/main.ts` calls
   `app.listen(rest_port)` — so the NestJS HTTP app genuinely listens on **4005**,
   while Hocuspocus serves **4004**. Every manifest declares only
   `containerPort: 4004`. So the probe's port choice matches the code; what is missing
   is the `ports:` entry for 4005.

2. **`/health` is not routed.** `src/services/health/health.controller.ts` defines
   `@Controller('/health')` and `health.module.ts` registers it — but **`HealthModule`
   is never imported by `AppModule`** (`AppModule` imports only `ConfigModule`,
   `WinstonModule` and `HocuspocusModule`). The route therefore does not exist at
   runtime. Confirmed live: `GET :4004/` returns **200**, `GET :4005/health` returns
   nothing.

3. **4005 is bound to loopback.** `app.listen(port)` without a host argument binds
   `127.0.0.1`, so 4005 is unreachable from outside the container even once routed —
   note `config.yml` has an `address: 0.0.0.0` setting that `main.ts` does not pass to
   `listen()`. A kubelet probe originates outside the container's loopback, so it would
   fail regardless. (The `Host: '127.0.0.1'` header in the commented block only sets an
   HTTP header; it does not change the connection target.)

Uncommenting as written would fail every probe, and the liveness probe would then
restart-loop the pod — consistent with someone having tried it and reverted.

**Left untouched, deliberately.** Enabling probes is out of scope for this wave and is
tracked as follow-up **F2**. F2 must: import `HealthModule` into `AppModule`; bind
4005 to `0.0.0.0` (wire up the existing `address` setting); add `containerPort: 4005`
to the manifests; and only then uncomment — changing **both** orchestration copies
together.
