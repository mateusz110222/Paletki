#!/usr/bin/env bash
set -euo pipefail
umask 077

deploy_dir=${PALETKI_DEPLOY_DIR:-/opt/paletki}
env_file="$deploy_dir/.env.production"
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)

: "${BACKEND_IMAGE:?Set the backend release image}"
: "${FRONTEND_IMAGE:?Set the frontend release image}"
: "${MIGRATIONS_IMAGE:?Set the migrations release image}"
test -f "$env_file" || { echo "Missing $env_file" >&2; exit 1; }

exec 9>"$deploy_dir/deploy.lock"
flock -n 9 || { echo 'Another deployment is running' >&2; exit 1; }

release_file=$(mktemp "$deploy_dir/release.XXXXXX")
trap 'rm -f -- "$release_file"' EXIT
printf 'BACKEND_IMAGE=%s\nFRONTEND_IMAGE=%s\nMIGRATIONS_IMAGE=%s\n' \
  "$BACKEND_IMAGE" "$FRONTEND_IMAGE" "$MIGRATIONS_IMAGE" > "$release_file"

compose=(docker compose --env-file "$env_file" --env-file "$release_file" -f "$source_dir/compose.production.yml")
"${compose[@]}" config --quiet
cert_path=$("${compose[@]}" config --environment | sed -n 's/^LDAP_CA_CERT_HOST_PATH=//p')
[[ "$cert_path" = /* && -f "$cert_path" && -r "$cert_path" ]] || {
  echo 'LDAP_CA_CERT_HOST_PATH must point to a readable PEM file on this host' >&2
  exit 1
}
volume=$("${compose[@]}" config --environment | sed -n 's/^POSTGRES_VOLUME=//p')
docker volume inspect "$volume" > /dev/null
# Pull every image before stopping any application container.
"${compose[@]}" pull
"${compose[@]}" up -d --wait --wait-timeout 120 postgres-db

# Quiesce writers so the backup includes every operation before the migration.
"${compose[@]}" stop frontend fis-outbox-worker fis-reconciler backend
mkdir -p "$deploy_dir/backups"
backup=$(mktemp "$deploy_dir/backups/pallets-$(date -u +%Y%m%dT%H%M%SZ).XXXXXX.dump")
"${compose[@]}" exec -T postgres-db pg_dump -U encoredb_user -d pallets -Fc > "$backup"
test -s "$backup"

# A migration failure leaves the application stopped and the backup intact.
"${compose[@]}" up --no-deps --force-recreate --exit-code-from db-migrations db-migrations
"${compose[@]}" up -d --wait --wait-timeout 180

# Probe the backend through Nginx, not just the static frontend files.
"${compose[@]}" exec -T frontend wget -q -T 15 -O /dev/null http://127.0.0.1/public/dashboard

install -m 600 "$source_dir/compose.production.yml" "$deploy_dir/compose.production.yml"
mv -f -- "$release_file" "$deploy_dir/release.production.env"
echo "Deployment completed; release images saved in $deploy_dir/release.production.env"
