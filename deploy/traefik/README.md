# Traefik domain routing

The API writes one JSON file per project into Traefik's file-provider directory.
Every file contains the internal project subdomain and all custom domains of the
project. Traefik watches the directory and applies changes without a restart.
Seed the mounted directory with `dynamic/security.yml` from this folder; it
enforces TLS 1.2+ and strict SNI for every routed hostname.

Mount the same writable directory into the API and read-only into Traefik:

```yaml
services:
  api:
    volumes:
      - /opt/devion/traefik/dynamic:/opt/devion/traefik/dynamic
      - /opt/devion/traefik/certs:/opt/devion/traefik/certs
  traefik:
    volumes:
      - /opt/devion/traefik/dynamic:/etc/traefik/dynamic:ro
      - /opt/devion/traefik/certs:/etc/traefik/certs:ro
```

Configure the API with values matching `traefik.yml`:

```dotenv
TRAEFIK_ENABLED=true
TRAEFIK_DYNAMIC_CONFIG_DIR=/opt/devion/traefik/dynamic
TRAEFIK_HTTP_ENTRYPOINT=web
TRAEFIK_HTTPS_ENTRYPOINT=websecure
TRAEFIK_CERT_RESOLVER=le-kunden
TRAEFIK_INTERNAL_DOMAIN=devion.local
TRAEFIK_CERTS_DIR=/opt/devion/traefik/certs
TRAEFIK_CERTS_TRAEFIK_DIR=/etc/traefik/certs

# The deployment runtime should populate projects.routing_target_url. Until it
# does, this template resolves Docker service names from a project slug.
TRAEFIK_PROJECT_UPSTREAM_TEMPLATE=http://devion-project-{projectSlug}:3000

# Configure at least one ownership check for the "DNS prüfen" action.
TRAEFIK_CNAME_TARGET=proxy.example.com
# TRAEFIK_PUBLIC_IP=203.0.113.10
```

## Dashboard certificate upload

Platform administrators can upload a PEM certificate and its private key at
`/admin/settings/certificates`. The API validates the certificate/key pair,
stores the key with mode `0600`, and only exposes certificate metadata. Add the
exact public dashboard origin to `BETTER_AUTH_TRUSTED_ORIGINS`; the upload
endpoint rejects requests without a trusted `Origin` header to prevent CSRF.

For a custom hostname such as `app.example.com`, create a CNAME to
`TRAEFIK_CNAME_TARGET` (or an A/AAAA record to `TRAEFIK_PUBLIC_IP`). The API
does not accept upstream URLs from dashboard users; they are deployment-owned
metadata to prevent routing to arbitrary internal services.
