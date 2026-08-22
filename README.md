# Devion

Devion is a self-hosted platform for operating applications and Minecraft Java servers across organization-owned infrastructure. It combines project management, deployment desired state, role-based access control, audit-ready operations, domains, TLS routing, and a node-based workload control plane.

> Devion's API is a control plane. It records intent and authorizes actions; node-local agents perform workload operations on their own hosts.

## Highlights

- Multi-organization projects, teams, members, and role-based access control
- Versioned container deployments with scheduling and durable agent commands
- Minecraft Java server management with console, live logs, persistent files, and per-server user/team roles
- Node enrollment, resource reporting, placement constraints, and reconciliation
- Domain routing and automated TLS through Traefik and Let's Encrypt
- Self-hosted PostgreSQL, RustFS, OCI registry, API, and dashboard services

## Architecture

```text
Dashboard / API clients
          |
          v
 Devion API control plane  ---- PostgreSQL
          |
          | durable desired-state commands
          v
    Devion Agent (per node) ---- local Docker Engine
          |
          v
 Applications and Minecraft servers
```

The API never directly starts application or game-server containers. The agent authenticates to the API, reports resources, polls commands, and is the only component that accesses the node's Docker socket.

Read the full design and node enrollment guide in [docs/control-plane.md](docs/control-plane.md).

## Quick start: production installation

### Requirements

- Linux host with Docker Engine and Docker Compose v2
- Git, curl, and OpenSSL
- Ports 80 and 443 available on the host

Install the current main branch:

```bash
curl -fsSL https://raw.githubusercontent.com/Devion-Systems/Devion/main/install.sh | sudo bash
```

The installer clones Devion to `/opt/devion`, generates local secrets, starts the platform services, applies migrations, and verifies the API health check. It displays the dashboard URL based on the host's detected LAN IP.

To install a fork instead:

```bash
curl -fsSL https://raw.githubusercontent.com/Devion-Systems/Devion/main/install.sh | \
  sudo DEVION_REPOSITORY_URL=https://github.com/YOUR_ORG/Devion.git bash
```

For automatic HTTPS, point the relevant DNS A, AAAA, or CNAME record to the host before adding the domain in Devion. Optionally set an ACME contact email:

```bash
curl -fsSL https://raw.githubusercontent.com/Devion-Systems/Devion/main/install.sh | \
  sudo DEVION_ACME_EMAIL=admin@example.com bash
```

### Operating the installation

```bash
cd /opt/devion
docker compose --env-file deploy/docker/.env -f deploy/docker/docker-compose.yml ps
docker compose --env-file deploy/docker/.env -f deploy/docker/docker-compose.yml logs -f api
```

Re-running the installer performs an in-place update. It preserves data and secrets and keeps a timestamped backup of `deploy/docker/.env`.

## Node agents and workloads

Create a one-time node registration token as an organization owner or admin:

```text
POST /organizations/{orgSlug}/nodes/registration-tokens
{ "expiresInSeconds": 3600 }
```

For the Docker host installed by Devion, use the returned token exactly once:

```bash
cd /opt/devion
docker compose --env-file deploy/docker/.env -f deploy/docker/docker-compose.yml run --build --rm --no-deps \
  -e DEVION_AGENT_REGISTRATION_TOKEN='one-time-token' \
  -e DEVION_AGENT_ENROLLMENT_ONLY=true \
  agent
```

The installer starts a resident local agent which waits for this enrollment.
After enrollment it picks up its identity from the persistent agent volume; the registration token is no longer needed.

## Minecraft server management

Minecraft Java servers are project-bound container workloads with a persistent `/data` volume. The dashboard provides:

- Start, stop, and deletion controls
- Live log output and a safe RCON-backed console
- A file browser/editor limited to the server's `/data` volume
- Common version suggestions and support for a custom image-supported version
- Per-server grants for individuals and organization teams

Per-server roles are:

| Role | Permissions |
| --- | --- |
| `viewer` | View logs, file structure, and file contents |
| `operator` | Viewer permissions plus console, start/stop, and file edits |
| `admin` | Operator permissions plus management of server grants and deletion |

Organization owners and admins always retain full access.

## Local development

### Requirements

- Bun `1.3.14`
- Node.js `>=26`
- Docker, for integration services and node-agent workload execution

```bash
bun install
bun run check-types
bun test
bun run --cwd apps/dashboard build
```

Useful commands:

```bash
# Start the API locally
bun run apps/api/src/index.ts

# Run the agent in development mode
bun run agent:dev

# Build or test the isolated builder service
bun run builder:build
bun run builder:test
```

## Database migrations

Apply migrations before running an API version that uses the control plane or Minecraft RBAC:

```bash
bun run --cwd packages/db db:migrate
```

The current control-plane migration is `0012_control_plane`; per-server Minecraft user/team access is added by `0013_game_server_rbac`.

## Current scope

Container applications and Minecraft Java servers are supported through the agent runtime. MicroVM/Firecracker workloads and managed database provisioning intentionally return `501` until their node-agent, networking, ownership, and one-time secret-delivery protocols are defined.

## License

Devion is licensed under the [Apache License 2.0](LICENSE).
