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

The installer detects the server's LAN IP and displays the dashboard URL as
`http://SERVER-IP`. No DNS entry, hosts-file change, or certificate is needed
for first access. The API health endpoint is available at
`http://SERVER-IP/health`; API routes such as `/api/auth` and
`/organizations/...` share that origin.

Add a project domain in the dashboard only after its DNS A/AAAA or CNAME record
points to this host. Devion verifies the record before publishing the HTTPS
route; Traefik then requests its certificate from Let's Encrypt automatically.
Set a contact email for the ACME account during installation, for example:

```bash
curl -fsSL https://raw.githubusercontent.com/Devion-Systems/Devion/main/install.sh | \
  sudo DEVION_ACME_EMAIL=admin@example.com bash
```

## Useful commands

```bash
cd /opt/devion
docker compose --env-file deploy/docker/.env -f deploy/docker/docker-compose.yml ps
docker compose --env-file deploy/docker/.env -f deploy/docker/docker-compose.yml logs -f api
```

To choose a specific bind IP or ports, set `DEVION_HOST_IP`,
`DEVION_HTTP_PORT`, or `DEVION_HTTPS_PORT` before running the installer.

Running the same command again is an update: the installer retains data and
secrets, creates a timestamped backup of `deploy/docker/.env`, migrates legacy
local hostnames to the host-IP URL, refreshes Traefik's routes, and rebuilds
the dashboard with the correct API origin. No manual Traefik or CORS edits are
required.

## Local development

```bash
bun install
bun run --cwd apps/dashboard build
bun run apps/api/src/index.ts
```
