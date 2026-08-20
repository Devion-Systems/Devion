# Devion

Devion is a self-hosted platform for organisations, projects, access control,
databases, domains, AI features, audit logs, and TLS-managed application routing.

## Install with curl

Requirements: a Linux host with Docker Engine, Docker Compose v2, Git, curl,
and OpenSSL. Ports 80 and 443 must be available.

```bash
curl -fsSL https://raw.githubusercontent.com/Devion-Systems/Devion/main/install.sh | sudo bash
```

The installer clones the project to `/opt/devion`, creates unique local
secrets, starts PostgreSQL, RustFS, the OCI registry, the API, dashboard, and
Traefik, applies database migrations, and verifies the API health endpoint.

For a fork, override the source:

```bash
curl -fsSL https://raw.githubusercontent.com/Devion-Systems/Devion/main/install.sh | \
  sudo DEVION_REPOSITORY_URL=https://github.com/YOUR_ORG/Devion.git bash
```

Local defaults are `https://dashboard.devion.local` and
`https://api.devion.local/health`. The installer adds those names to
`/etc/hosts` when using the default local IP address. Traefik uses HTTPS; the
local certificate is intentionally accepted by the install health check with
`--insecure`. Upload a trusted certificate through the Admin Center for a
public deployment.

## Useful commands

```bash
cd /opt/devion
docker compose --env-file deploy/docker/.env -f deploy/docker/docker-compose.yml ps
docker compose --env-file deploy/docker/.env -f deploy/docker/docker-compose.yml logs -f api
```

To change hostnames or ports, set `DEVION_API_HOST`,
`DEVION_DASHBOARD_HOST`, `DEVION_HTTP_PORT`, or `DEVION_HTTPS_PORT` before
running the installer.

## Local development

```bash
bun install
bun run --cwd apps/dashboard build
bun run apps/api/src/index.ts
```
