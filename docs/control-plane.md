# Devion Control Plane V1

Devion runs a modular control plane. The API persists desired state; it does
not start application or game-server containers itself. A node-local Devion
Agent authenticates with the API, reports resources, polls durable commands,
and accesses its local Docker Engine socket.

## Apply the schema

Apply the database migration before starting an API version that uses nodes,
workloads, or deployments:

```bash
bun run --cwd packages/db db:migrate
```

`0012_control_plane` adds node enrollment, workload, deployment, and command
state. It also adds project/application references to new game servers.
`0013_game_server_rbac` adds per-server user and team grants. Existing
game-server records are deliberately left without an invented project
assignment.

## Local host and extra nodes

The Devion installation itself automatically enrolls a local, shared runtime.
It runs applications and Minecraft servers without a separate Node. Use the
following flow only for additional hardware.

## Enrol an additional node

An organization owner or admin first creates a one-time registration token:

```text
POST /organizations/{orgSlug}/nodes/registration-tokens
{ "expiresInSeconds": 3600 }
```

The raw registration token is returned once. Run the enrollment command on the
additional Docker host:

```bash
cd /opt/devion
docker compose --env-file deploy/docker/.env -f deploy/docker/docker-compose.yml run --build --rm --no-deps \
  -e DEVION_AGENT_REGISTRATION_TOKEN='one-time-token' \
  -e DEVION_AGENT_ENROLLMENT_ONLY=true \
  agent
```

After enrollment the agent reads its identity from its persistent data volume.
The one-time registration token is no longer needed.

## Supported V1 workload path

Container Applications and newly created Minecraft Java game servers are
scheduled to nodes advertising the `container` runtime. The agent handles
`workload.start`, `workload.stop`, and `workload.delete` using the Docker
Engine API. Scheduling applies status, runtime, architecture, region, label,
CPU, memory, and storage constraints before scoring eligible nodes.

## Intentionally unavailable

- MicroVM / Firecracker workloads return `501`. Their agent protocol,
  networking, and volume contracts are not defined yet.
- Managed database operations return `501`. They require a project-scoped
  ownership model and an encrypted one-time secret-delivery contract for
  agents before provisioning can be enabled safely.

## Operational notes

The API's deployment controller runs every 15 seconds and creates durable,
idempotent commands. Agents may safely poll a command repeatedly until they
report a result. Resource reservations are recomputed from unfinished
workloads, preventing independent deployments from overcommitting a node.
