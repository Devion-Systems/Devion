# Devion Builder

> Beta `0.1.0-beta.1`: standalone OCI build and Firecracker deployment control
> plane. Validate image boot compatibility and host networking in a staging
> environment before production use.

Standalone TypeScript image-builder application. It uses Bun and Hono for the
control-plane API, PostgreSQL as a durable queue, and a separate worker that
checks out Git repositories and invokes rootless BuildKit through `buildctl`.
It has no runtime, build, or package dependency on Devion: copy this directory
to another system and start the included Compose stack. The older
`services/builder` tree is reference material only.

## Run

```bash
bun install
cp apps/builder/.env.example apps/builder/.env
bun run builder:typecheck
bun run builder:test
bun run builder:up
```

Outside this monorepo, run the same service directly from this directory:

```bash
cp .env.example .env
docker compose up --build -d
```

`WORKER_CONCURRENCY` controls the number of simultaneous jobs per worker
container (default: `2`). Scale horizontally with `docker compose up --scale worker=3`.

The API exposes `/health/live` for process liveness and `/health/ready` for
PostgreSQL readiness. Worker jobs use expiring leases and heartbeats, so a job
whose worker crashes returns to the queue after its lease expires.

The API is available at `http://127.0.0.1:3010`. Every `/v1` request requires
`Authorization: Bearer $BUILDER_API_TOKEN`; `/health/live` is public.

## API

- `POST /v1/workflows/validate` validates YAML or JSON and its dependency DAG.
- `POST /v1/runs` queues a workflow with `source`, `inputs`, and `secrets`.
- `GET /v1/runs` and `GET /v1/runs/:id` return build state without secrets.
- `GET /v1/runs/:id/logs?after=<id>` returns incremental, redacted logs.
- `POST /v1/runs/:id/cancel` requests cancellation.

Use an `Idempotency-Key` header when creating a run. Repeating that key returns
the original run instead of queuing a duplicate.

See [`examples/workflow.yml`](examples/workflow.yml) for the initial workflow
format. Steps can execute shell commands, BuildKit image builds, or immutable
registry-to-Firecracker deployments, form a DAG
with `needs`, run concurrently, retry, time out, and continue on errors.

## Firecracker deployment workflow

A `deploy` step resolves the image tag through Registry HTTP API V2 and sends
the returned SHA-256 manifest digest to a dedicated Firecracker host agent. The
agent verifies that its host allowlist permits the registry, pulls exactly that
digest with `skopeo`, unpacks the OCI image with `umoci`, creates an ext4 root
filesystem, and starts a Firecracker VM. The builder has no KVM, root, TAP, or
Firecracker socket access.

The host agent is deliberately not included in Docker Compose. Install
Firecracker, `skopeo`, `umoci`, `e2fsprogs`, and `iproute2` on a Linux host with
KVM enabled; configure a bridge such as `br0`, then run it with the restricted
host configuration:

```bash
cp .agent.env.example .agent.env
set -a && source .agent.env && set +a
bun run start:agent
```

Set `FIRECRACKER_AGENT_URL` in the builder worker environment and provide the
workflow secret `FIRECRACKER_AGENT_TOKEN`. For private registries, additionally
provide the named registry credential secrets. In production, expose the agent
only via private networking or an mTLS-terminating proxy; the builder refuses a
plain-HTTP agent URL except for localhost.

The host agent exposes authenticated lifecycle endpoints:
`GET /v1/deployments` lists managed deployments and
`DELETE /v1/deployments/:id` stops an instance and removes its generated route.

OCI images must be Firecracker-compatible: their root filesystem needs a usable
init process and kernel-compatible userspace. A normal container entrypoint is
not by itself a Firecracker boot process. The agent writes configured deployment
variables to `/etc/devion-builder.env` inside the guest filesystem.

### Automatic and manual hosting

`mode: automatic` is the default. After a BuildKit step, the worker reads the
Dockerfile's numeric `EXPOSE` instructions and stores the discovered ports in
the build-run metadata in PostgreSQL. When exactly one port is found, that port
is used for Traefik. Otherwise the host's `defaultServicePort` applies. The
agent takes its resource defaults and named templates from
[`hosting-settings.example.json`](hosting-settings.example.json), copied to
`FIRECRACKER_SETTINGS_FILE` on the Firecracker host.

```yaml
deploy:
  mode: automatic
  image: registry.example.internal/team/api:${{ git.sha }}
  instanceName: api
  resourceTemplate: standard
```

For `mode: manual`, a workflow must explicitly set `domain`, `servicePort`,
`vcpuCount`, `memoryMiB`, and `rootfsSizeMiB`. The domain has to be a subdomain
of `TRAEFIK_BASE_DOMAIN`.

```yaml
deploy:
  mode: manual
  image: registry.example.internal/team/api:stable
  instanceName: api-preview
  domain: preview.api.apps.example.com
  servicePort: 3000
  vcpuCount: 2
  memoryMiB: 1024
  rootfsSizeMiB: 4096
```

### Automatic service domains

Every Firecracker deployment gets the stable hostname
`<instanceName>.<TRAEFIK_BASE_DOMAIN>`. A base domain such as `apps.example.com`
therefore supports both subdomains and sub-subdomains, for example
`api.apps.example.com`. The host agent allocates a guest IP from its configured
pool and atomically writes `firecracker-<instanceName>.yml` into
`TRAEFIK_DYNAMIC_CONFIG_DIR`. Traefik's file provider detects the route without
a restart and forwards HTTPS traffic to the declared `servicePort`.

Point a wildcard DNS record such as `*.apps.example.com` to Traefik, and ensure
the configured ACME resolver can issue a certificate for that wildcard or for
each host. The Firecracker bridge, gateway, and guest IP prefix are host-network
settings and must be configured consistently before deployments start.

## Security model

The worker never mounts `/var/run/docker.sock`. Build paths are constrained to
the per-run checkout, process arguments do not pass through a shell except for
explicit `run` steps, BuildKit secrets use temporary mode-0600 files, log lines
are redacted, and persisted secrets are erased when the run terminates.
