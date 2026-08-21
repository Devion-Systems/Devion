#!/bin/sh
set -eu

workspace="/workspace"
state_dir="$workspace/data/system-updates"
ref="${1:?A branch or tag is required}"
timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
backup_timestamp="$(date -u +%Y%m%d%H%M%S)"

case "$ref" in
  ""|*[!A-Za-z0-9._/-]*) exit 64 ;;
esac

mkdir -p "$state_dir" "$workspace/data/backups"
log_file="$state_dir/update-$backup_timestamp.log"
exec >>"$log_file" 2>&1
completed=0

write_state() {
  printf '{"status":"%s","ref":"%s","updatedAt":"%s","logFile":"%s"}\n' "$1" "$ref" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(basename "$log_file")" > "$state_dir/latest.json"
}

write_state running
trap '[ "$completed" -eq 1 ] || write_state failed' EXIT

if [ -f "$workspace/deploy/docker/.env" ]; then
  cp -p "$workspace/deploy/docker/.env" "$workspace/deploy/docker/.env.before-update-$backup_timestamp"
  set -a
  . "$workspace/deploy/docker/.env"
  set +a
  backup_file="$workspace/data/backups/control-db-$backup_timestamp.sql"
  docker compose --env-file "$workspace/deploy/docker/.env" -f "$workspace/deploy/docker/docker-compose.yml" \
    exec -T -e "PGPASSWORD=$POSTGRES_PASSWORD" postgres \
    pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" > "$backup_file"
  gzip "$backup_file"
fi

git -C "$workspace" fetch --depth 1 origin "$ref"
git -C "$workspace" checkout --force FETCH_HEAD

compose() {
  docker compose --env-file "$workspace/deploy/docker/.env" -f "$workspace/deploy/docker/docker-compose.yml" "$@"
}

# This intentionally runs in the foreground. A failed migration leaves the
# existing application containers untouched and records a failed update state.
compose build migrate api dashboard
compose run --rm migrate
compose up -d --force-recreate --no-deps api dashboard traefik

write_state succeeded
completed=1
