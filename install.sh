#!/usr/bin/env bash
set -Eeuo pipefail

REPOSITORY_URL="${DEVION_REPOSITORY_URL:-https://github.com/Devion-Systems/Devion.git}"
# Keep the deployment ref deliberately separate from operating-system metadata.
# /etc/os-release contains a generic VERSION variable (for example
# "24.04.4 LTS (Noble Numbat)").  Using that name here made an existing
# installation attempt to fetch Ubuntu's version as a Git ref.
DEVION_GIT_REF="${DEVION_VERSION:-main}"
INSTALL_DIR="${DEVION_INSTALL_DIR:-/opt/devion}"
detect_host_ip() {
  hostname -I 2>/dev/null | tr ' ' '\n' | awk \
    -F. 'NF == 4 && $0 != "127.0.0.1" { print; exit }'
}

HOST_IP="${DEVION_HOST_IP:-$(detect_host_ip)}"
HOST_IP="${HOST_IP:-127.0.0.1}"
HTTP_PORT="${DEVION_HTTP_PORT:-80}"
HTTPS_PORT="${DEVION_HTTPS_PORT:-443}"
ACME_EMAIL="${DEVION_ACME_EMAIL:-}"

fail() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }
info() { printf '\n==> %s\n' "$*"; }
secret() { openssl rand -hex 32; }
set_env_value() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}
ensure_env_value() {
  local key="$1"
  local value="$2"
  grep -q "^${key}=" "$ENV_FILE" || printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
}

install_base_packages() {
  case "$1" in
    apt) apt-get update -y; DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl git openssl gnupg lsb-release ;;
    dnf) dnf install -y ca-certificates curl git openssl gnupg2 ;;
    *) fail "Unsupported package manager: $1" ;;
  esac
}
install_docker() {
  local manager="$1" distribution="$2" codename="${3:-}"
  info "Installiere Docker Engine, Buildx und Docker Compose Plugin"
  case "$manager" in
    apt) install -d -m 0755 /etc/apt/keyrings; curl -fsSL "https://download.docker.com/linux/$distribution/gpg" | gpg --dearmor -o /etc/apt/keyrings/docker.gpg; chmod a+r /etc/apt/keyrings/docker.gpg; printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/%s %s stable\n' "$(dpkg --print-architecture)" "$distribution" "$codename" > /etc/apt/sources.list.d/docker.list; apt-get update -y; DEBIAN_FRONTEND=noninteractive apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin ;;
    dnf) dnf install -y dnf-plugins-core; dnf config-manager --add-repo "https://download.docker.com/linux/$distribution/docker-ce.repo"; dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin ;;
  esac
}
prepare_host() {
  [[ -r /etc/os-release ]] || fail "Nur Linux-Systeme mit /etc/os-release werden unterstützt."
  local manager distribution codename os_id
  os_id="$(. /etc/os-release; printf '%s' "$ID")"
  codename="$(. /etc/os-release; printf '%s' "${VERSION_CODENAME:-}")"
  case "$os_id" in
    ubuntu|debian) manager=apt; distribution="$os_id" ;;
    fedora) manager=dnf; distribution=fedora; codename="" ;;
    rhel|centos|rocky|almalinux) manager=dnf; distribution=centos; codename="" ;;
    *) fail "Nicht unterstütztes Linux: $os_id" ;;
  esac
  info "Installiere und prüfe Systemabhängigkeiten"
  install_base_packages "$manager"
  if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then install_docker "$manager" "$distribution" "$codename"; fi
  command -v systemctl >/dev/null && systemctl enable --now docker
  docker info >/dev/null 2>&1 || fail "Docker konnte nicht gestartet werden. Prüfe: systemctl status docker"
}

[[ "${EUID}" -eq 0 ]] || fail "Bitte mit sudo ausführen: curl ... | sudo bash"
prepare_host
command -v git >/dev/null || fail "git muss installiert sein."
command -v docker >/dev/null || fail "Docker Engine muss installiert sein."
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 muss installiert sein."
command -v openssl >/dev/null || fail "openssl muss installiert sein."
command -v curl >/dev/null || fail "curl muss installiert sein."
git check-ref-format --branch "$DEVION_GIT_REF" >/dev/null 2>&1 \
  || fail "Ungültige Devion-Version/Branch: $DEVION_GIT_REF (nutze z. B. main oder DEVION_VERSION=v1.2.0)"

if [[ -e "$INSTALL_DIR" && ! -d "$INSTALL_DIR/.git" ]]; then
  fail "$INSTALL_DIR existiert, ist aber keine Devion-Git-Installation."
fi

if [[ -d "$INSTALL_DIR/.git" ]]; then
  info "Aktualisiere vorhandene Installation"
  git -C "$INSTALL_DIR" diff --quiet || fail "Lokale Code-Änderungen erkannt. Update abgebrochen; Daten und Konfiguration bleiben unverändert."
  git -C "$INSTALL_DIR" diff --cached --quiet || fail "Gestagte Code-Änderungen erkannt. Update abgebrochen; Daten und Konfiguration bleiben unverändert."
  git -C "$INSTALL_DIR" fetch --depth 1 origin "$DEVION_GIT_REF"
  if git -C "$INSTALL_DIR" merge-base --is-ancestor HEAD FETCH_HEAD; then
    git -C "$INSTALL_DIR" merge --ff-only FETCH_HEAD
  else
    # A force-pushed or reinitialised public repository has no common Git
    # history with an existing deployment.  Only tracked source files are
    # reset here; .env, data/, bind mounts and Docker volumes are not touched.
    backup_ref="devion-before-source-update-$(date +%Y%m%d%H%M%S)"
    git -C "$INSTALL_DIR" branch "$backup_ref" HEAD
    info "Unterschiedliche Git-Historie erkannt. Quellcode wird aktualisiert; Sicherung: $backup_ref"
    git -C "$INSTALL_DIR" reset --hard FETCH_HEAD
  fi
else
  info "Lade Devion herunter"
  git clone --depth 1 --branch "$DEVION_GIT_REF" "$REPOSITORY_URL" "$INSTALL_DIR"
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
HOST_IP=$HOST_IP
BETTER_AUTH_URL=http://$HOST_IP
BETTER_AUTH_TRUSTED_ORIGINS=http://$HOST_IP
DASHBOARD_URL=http://$HOST_IP
PUBLIC_API_URL=http://$HOST_IP
S3_ACCESS_KEY=devion-storage
S3_SECRET_KEY=$storage_secret
S3_ENDPOINT=http://rustfs:9000
DOCKER_REGISTRY_URL=http://registry:5000
TRAEFIK_ENABLED=true
TRAEFIK_DYNAMIC_CONFIG_DIR=/data/traefik/dynamic
TRAEFIK_CERTS_DIR=/data/traefik/certs
TRAEFIK_CERTS_TRAEFIK_DIR=/etc/traefik/certs
TRAEFIK_INTERNAL_DOMAIN=
TRAEFIK_PUBLIC_IP=$HOST_IP
TRAEFIK_ACME_EMAIL=$ACME_EMAIL
TRAEFIK_PROJECT_UPSTREAM_TEMPLATE=http://devion-project-{projectSlug}:3000
# TRAEFIK_CNAME_TARGET=proxy.example.com
HTTP_PORT=$HTTP_PORT
HTTPS_PORT=$HTTPS_PORT
EOF
  chmod 600 "$ENV_FILE"
else
  # Older installations used separate local hostnames and a self-signed HTTPS
  # certificate. Move only control-plane URLs to the host-IP default; project
  # domains remain database-managed and are never touched here.
  info "Migriere Control-Plane auf Host-IP-Zugriff"
  backup_file="${ENV_FILE}.before-host-ip-$(date +%Y%m%d%H%M%S)"
  cp -p "$ENV_FILE" "$backup_file"
  set_env_value "HOST_IP" "$HOST_IP"
  set_env_value "BETTER_AUTH_URL" "http://$HOST_IP"
  set_env_value "BETTER_AUTH_TRUSTED_ORIGINS" "http://$HOST_IP"
  set_env_value "DASHBOARD_URL" "http://$HOST_IP"
  set_env_value "PUBLIC_API_URL" "http://$HOST_IP"
  set_env_value "BETTER_AUTH_COOKIE_DOMAIN" ""
  set_env_value "TRAEFIK_INTERNAL_DOMAIN" ""
  set_env_value "TRAEFIK_PUBLIC_IP" "$HOST_IP"
  # Never erase an ACME contact that was already configured on the host.
  if [[ -n "$ACME_EMAIL" ]]; then
    set_env_value "TRAEFIK_ACME_EMAIL" "$ACME_EMAIL"
  fi
  info "Vorherige Konfiguration gesichert: $backup_file"
fi

# Compose warns for unset interpolation variables even when an empty value is
# intentional. Keep existing administrator values intact and add only missing
# defaults for fresh or older installations.
ensure_env_value "BETTER_AUTH_COOKIE_DOMAIN" ""
ensure_env_value "TRAEFIK_CNAME_TARGET" ""
ensure_env_value "DEVION_LOCAL_AGENT_TOKEN" "$(secret)"

info "Bereite Traefik-Verzeichnisse vor"
install -d -m 700 "$INSTALL_DIR/data/traefik/dynamic" "$INSTALL_DIR/data/traefik/certs" "$INSTALL_DIR/data/traefik/acme"
install -m 644 "$INSTALL_DIR/deploy/traefik/dynamic/security.yml" "$INSTALL_DIR/data/traefik/dynamic/security.yml"
install -m 644 "$INSTALL_DIR/deploy/traefik/dynamic/platform.yml" "$INSTALL_DIR/data/traefik/dynamic/platform.yml"
install -m 644 "$INSTALL_DIR/deploy/traefik/dynamic/bootstrap-tls.yml" "$INSTALL_DIR/data/traefik/dynamic/bootstrap-tls.yml"
if [[ ! -f "$INSTALL_DIR/data/traefik/certs/bootstrap.crt" || ! -f "$INSTALL_DIR/data/traefik/certs/bootstrap.key" ]]; then
  openssl req -x509 -newkey rsa:4096 -sha256 -nodes -days 365 \
    -keyout "$INSTALL_DIR/data/traefik/certs/bootstrap.key" \
    -out "$INSTALL_DIR/data/traefik/certs/bootstrap.crt" \
    -subj "/CN=$HOST_IP" \
    -addext "subjectAltName=IP:$HOST_IP"
  chmod 600 "$INSTALL_DIR/data/traefik/certs/bootstrap.key"
fi
touch "$INSTALL_DIR/data/traefik/acme/acme.json"
chmod 600 "$INSTALL_DIR/data/traefik/acme/acme.json"

info "Baue Devion und führe Datenbankmigrationen aus"
compose=(docker compose --env-file "$ENV_FILE" -f "$INSTALL_DIR/deploy/docker/docker-compose.yml")
"${compose[@]}" build migrate api dashboard agent
"${compose[@]}" run --rm migrate || fail "Datenbankmigration fehlgeschlagen. Logs: ${compose[*]} run --rm migrate"

info "Starte Devion"
"${compose[@]}" up --detach --remove-orphans

info "Warte auf API-Healthcheck"
for _ in $(seq 1 60); do
  if curl --noproxy "*" --fail --silent --show-error --connect-timeout 2 \
    "http://$HOST_IP:$HTTP_PORT/health" >/dev/null; then
    break
  fi
  sleep 2
done
curl --noproxy "*" --fail --silent --show-error \
  "http://$HOST_IP:$HTTP_PORT/health" >/dev/null \
  || fail "API wurde nicht gesund. Logs: docker compose -f $INSTALL_DIR/deploy/docker/docker-compose.yml logs api"

info "Installation erfolgreich"
printf 'Dashboard: http://%s\nAPI health: http://%s/health\n' "$HOST_IP" "$HOST_IP"
