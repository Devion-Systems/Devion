#!/usr/bin/env bash
set -Eeuo pipefail

REPOSITORY_URL="${DEVION_REPOSITORY_URL:-https://github.com/Devion-Systems/Devion.git}"
VERSION="${DEVION_VERSION:-main}"
INSTALL_DIR="${DEVION_INSTALL_DIR:-/opt/devion}"
HOST_IP="${DEVION_HOST_IP:-127.0.0.1}"
API_HOST="${DEVION_API_HOST:-api.devion.local}"
DASHBOARD_HOST="${DEVION_DASHBOARD_HOST:-dashboard.devion.local}"
AUTH_COOKIE_DOMAIN="${DEVION_AUTH_COOKIE_DOMAIN:-${API_HOST#*.}}"
HTTP_PORT="${DEVION_HTTP_PORT:-80}"
HTTPS_PORT="${DEVION_HTTPS_PORT:-443}"

fail() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }
info() { printf '\n==> %s\n' "$*"; }
secret() { openssl rand -hex 32; }

[[ "${EUID}" -eq 0 ]] || fail "Bitte mit sudo ausführen: curl ... | sudo bash"
command -v git >/dev/null || fail "git muss installiert sein."
command -v docker >/dev/null || fail "Docker Engine muss installiert sein."
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 muss installiert sein."
command -v openssl >/dev/null || fail "openssl muss installiert sein."
command -v curl >/dev/null || fail "curl muss installiert sein."

if [[ -e "$INSTALL_DIR" && ! -d "$INSTALL_DIR/.git" ]]; then
  fail "$INSTALL_DIR existiert, ist aber keine Devion-Git-Installation."
fi

if [[ -d "$INSTALL_DIR/.git" ]]; then
  info "Aktualisiere vorhandene Installation"
  git -C "$INSTALL_DIR" fetch --depth 1 origin "$VERSION"
  git -C "$INSTALL_DIR" checkout --force FETCH_HEAD
else
  info "Lade Devion herunter"
  git clone --depth 1 --branch "$VERSION" "$REPOSITORY_URL" "$INSTALL_DIR"
fi

ENV_FILE="$INSTALL_DIR/deploy/docker/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  info "Erzeuge Produktionskonfiguration"
  db_password="$(secret)"
  auth_secret="$(secret)"
  storage_secret="$(secret)"
  cat > "$ENV_FILE" <<EOF
POSTGRES_DB=devion
POSTGRES_USER=devion
POSTGRES_PASSWORD=$db_password
DATABASE_URL=postgres://devion:$db_password@postgres:5432/devion
BETTER_AUTH_SECRET=$auth_secret
BETTER_AUTH_URL=https://$API_HOST
BETTER_AUTH_TRUSTED_ORIGINS=https://$DASHBOARD_HOST
BETTER_AUTH_COOKIE_DOMAIN=$AUTH_COOKIE_DOMAIN
DASHBOARD_URL=https://$DASHBOARD_HOST
API_HOST=$API_HOST
DASHBOARD_HOST=$DASHBOARD_HOST
S3_ACCESS_KEY=devion-storage
S3_SECRET_KEY=$storage_secret
S3_ENDPOINT=http://rustfs:9000
DOCKER_REGISTRY_URL=http://registry:5000
TRAEFIK_ENABLED=true
TRAEFIK_DYNAMIC_CONFIG_DIR=/data/traefik/dynamic
TRAEFIK_CERTS_DIR=/data/traefik/certs
TRAEFIK_CERTS_TRAEFIK_DIR=/etc/traefik/certs
TRAEFIK_INTERNAL_DOMAIN=devion.local
TRAEFIK_PROJECT_UPSTREAM_TEMPLATE=http://devion-project-{projectSlug}:3000
TRAEFIK_CNAME_TARGET=proxy.devion.local
HTTP_PORT=$HTTP_PORT
HTTPS_PORT=$HTTPS_PORT
EOF
  chmod 600 "$ENV_FILE"
fi

info "Bereite Traefik-Verzeichnisse vor"
install -d -m 700 "$INSTALL_DIR/data/traefik/dynamic" "$INSTALL_DIR/data/traefik/certs" "$INSTALL_DIR/data/traefik/acme"
install -m 644 "$INSTALL_DIR/deploy/traefik/dynamic/security.yml" "$INSTALL_DIR/data/traefik/dynamic/security.yml"
install -m 644 "$INSTALL_DIR/deploy/traefik/dynamic/platform.yml" "$INSTALL_DIR/data/traefik/dynamic/platform.yml"
install -m 644 "$INSTALL_DIR/deploy/traefik/dynamic/bootstrap-tls.yml" "$INSTALL_DIR/data/traefik/dynamic/bootstrap-tls.yml"
if [[ ! -f "$INSTALL_DIR/data/traefik/certs/bootstrap.crt" || ! -f "$INSTALL_DIR/data/traefik/certs/bootstrap.key" ]]; then
  openssl req -x509 -newkey rsa:4096 -sha256 -nodes -days 365 \
    -keyout "$INSTALL_DIR/data/traefik/certs/bootstrap.key" \
    -out "$INSTALL_DIR/data/traefik/certs/bootstrap.crt" \
    -subj "/CN=$DASHBOARD_HOST" \
    -addext "subjectAltName=DNS:$DASHBOARD_HOST,DNS:$API_HOST"
  chmod 600 "$INSTALL_DIR/data/traefik/certs/bootstrap.key"
fi
touch "$INSTALL_DIR/data/traefik/acme/acme.json"
chmod 600 "$INSTALL_DIR/data/traefik/acme/acme.json"

if [[ "$HOST_IP" == "127.0.0.1" ]]; then
  if ! grep -qE "[[:space:]]$API_HOST([[:space:]]|$)" /etc/hosts; then
    printf '127.0.0.1 %s %s\n' "$API_HOST" "$DASHBOARD_HOST" >> /etc/hosts
  fi
fi

info "Baue und starte Devion"
docker compose --env-file "$ENV_FILE" -f "$INSTALL_DIR/deploy/docker/docker-compose.yml" up --build --detach --remove-orphans

info "Warte auf API-Healthcheck"
for _ in $(seq 1 60); do
  if curl --noproxy "*" --fail --silent --show-error --insecure --connect-timeout 2 \
    --resolve "$API_HOST:$HTTPS_PORT:$HOST_IP" \
    "https://$API_HOST:$HTTPS_PORT/health" >/dev/null; then
    break
  fi
  sleep 2
done
curl --noproxy "*" --fail --silent --show-error --insecure \
  --resolve "$API_HOST:$HTTPS_PORT:$HOST_IP" \
  "https://$API_HOST:$HTTPS_PORT/health" >/dev/null \
  || fail "API wurde nicht gesund. Logs: docker compose -f $INSTALL_DIR/deploy/docker/docker-compose.yml logs api"

info "Installation erfolgreich"
printf 'Dashboard: https://%s\nAPI health: https://%s/health\n' "$DASHBOARD_HOST" "$API_HOST"
