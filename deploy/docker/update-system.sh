#!/bin/sh
# Transactional, forward-only Devion updater. Persistent Docker data is never removed.
set -eu
workspace=/workspace; ref="${1:?A branch or tag is required}"; state_dir="$workspace/data/system-updates"; backup_dir="$workspace/data/backups"; timestamp="$(date -u +%Y%m%d%H%M%S)"; stage="$workspace/.devion-update-stage-$timestamp"; lock_dir="$state_dir/.lock"; log_file="$state_dir/update-$timestamp.log"; current_commit="$(git -C "$workspace" rev-parse HEAD)"
case "$ref" in ''|*[!A-Za-z0-9._/-]*) exit 64;; esac
mkdir -p "$state_dir" "$backup_dir"; mkdir "$lock_dir" 2>/dev/null || { echo "Another update is already running" >&2; exit 75; }; exec >>"$log_file" 2>&1
write_state() { printf '{"status":"%s","ref":"%s","updatedAt":"%s","logFile":"%s","previousCommit":"%s"}\n' "$1" "$ref" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(basename "$log_file")" "$current_commit" > "$state_dir/latest.json"; }
cleanup() { git -C "$workspace" worktree remove --force "$stage" 2>/dev/null || rm -rf "$stage"; rmdir "$lock_dir" 2>/dev/null || true; }
rollback() { echo "Healthcheck failed; restoring previous images"; [ -f "$backup_dir/images-$timestamp.txt" ] && while IFS='=' read -r name image; do [ -n "$image" ] && docker tag "$image" "$name"; done < "$backup_dir/images-$timestamp.txt"; docker compose --env-file "$workspace/deploy/docker/.env" -f "$workspace/deploy/docker/docker-compose.yml" up -d --no-deps --force-recreate api dashboard traefik updater || true; }
failed=1; trap 'if [ "$failed" -eq 1 ]; then rollback || true; write_state failed; fi; cleanup' EXIT; write_state running
git -C "$workspace" diff --quiet && git -C "$workspace" diff --cached --quiet || { echo "Refusing update: repository has local changes"; exit 65; }
[ -f "$workspace/deploy/docker/.env" ] || { echo "Missing deploy/docker/.env"; exit 66; }
cp -p "$workspace/deploy/docker/.env" "$backup_dir/env-$timestamp"; set -a; . "$workspace/deploy/docker/.env"; set +a
docker compose --env-file "$workspace/deploy/docker/.env" -f "$workspace/deploy/docker/docker-compose.yml" exec -T -e "PGPASSWORD=$POSTGRES_PASSWORD" postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$backup_dir/control-db-$timestamp.sql.gz"
for image in devion-api devion-dashboard devion-updater; do printf '%s=%s\n' "$image" "$(docker image inspect --format '{{.Id}}' "$image" 2>/dev/null || true)"; done > "$backup_dir/images-$timestamp.txt"
git -C "$workspace" fetch --depth 1 origin "$ref"; git -C "$workspace" worktree add --detach "$stage" FETCH_HEAD; cp -p "$workspace/deploy/docker/.env" "$stage/deploy/docker/.env"
if grep -R -E -i '(^|[[:space:];])(drop[[:space:]]+(table|column|database)|truncate|delete[[:space:]]+from)' "$stage/packages/db/drizzle"/*.sql; then echo "Refusing destructive migration in selected release"; exit 67; fi
compose() { docker compose --env-file "$stage/deploy/docker/.env" -f "$stage/deploy/docker/docker-compose.yml" "$@"; }
compose build migrate api dashboard updater; compose run --rm --no-deps migrate; compose up -d --no-deps --force-recreate api dashboard traefik updater
healthy=0; for _ in $(seq 1 45); do if compose exec -T api bun -e "process.exit((await fetch('http://localhost:3000/health')).ok ? 0 : 1)"; then healthy=1; break; fi; sleep 2; done
if [ "$healthy" -ne 1 ]; then rollback; exit 68; fi
git -C "$workspace" merge --ff-only FETCH_HEAD; failed=0; write_state succeeded; echo "Update succeeded: $current_commit -> $(git -C "$workspace" rev-parse HEAD)"
