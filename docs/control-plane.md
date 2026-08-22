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

## Enrol a node

An organization owner or admin first creates a one-time registration token:

```text
POST /organizations/{orgSlug}/nodes/registration-tokens
{ "expiresInSeconds": 3600 }
```

The raw registration token is returned once. Configure the agent on the node:

```bash
export DEVION_API_URL=https://devion.example
export DEVION_AGENT_REGISTRATION_TOKEN='one-time-token'
export DEVION_AGENT_NAME='node-fra-01'
export DEVION_AGENT_DATA_DIR=/var/lib/devion-agent
bun run --cwd apps/agent start
```

After registration, the agent stores only its own identity at
`DEVION_AGENT_DATA_DIR/identity.json` with restrictive file permissions. The
one-time registration token is no longer needed.

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
