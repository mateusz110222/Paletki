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
saved_release="$deploy_dir/release.production.env"
partial_backup=
trap 'rm -f -- "$release_file"; if [[ -n "$partial_backup" ]]; then rm -f -- "$partial_backup"; fi' EXIT
printf 'BACKEND_IMAGE=%s\nFRONTEND_IMAGE=%s\nMIGRATIONS_IMAGE=%s\n' \
  "$BACKEND_IMAGE" "$FRONTEND_IMAGE" "$MIGRATIONS_IMAGE" > "$release_file"
worker_token=
if [[ -r "$saved_release" ]]; then
  worker_token=$(sed -n 's/^FIS_OUTBOX_WORKER_TOKEN=//p' "$saved_release")
fi
if [[ ! "$worker_token" =~ ^[a-f0-9]{64}$ ]]; then
  worker_token=$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')
fi
[[ "$worker_token" =~ ^[a-f0-9]{64}$ ]]
printf 'FIS_OUTBOX_WORKER_TOKEN=%s\n' "$worker_token" >> "$release_file"
unset worker_token

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

# Quiesce writers so the backup includes every operation before the migration.
"${compose[@]}" stop frontend fis-outbox-worker fis-reconciler backend
"${compose[@]}" up -d --wait --wait-timeout 120 postgres-db
mkdir -p "$deploy_dir/backups"
partial_backup=$(mktemp "$deploy_dir/backups/pallets-$(date -u +%Y%m%dT%H%M%SZ).XXXXXX.partial")
"${compose[@]}" exec -T postgres-db pg_dump -U encoredb_user -d pallets -Fc > "$partial_backup"
test -s "$partial_backup"
mv -- "$partial_backup" "${partial_backup%.partial}.dump"
partial_backup=

# A migration failure leaves the application stopped and the backup intact.
"${compose[@]}" up --no-deps --force-recreate --exit-code-from db-migrations db-migrations
"${compose[@]}" up -d --remove-orphans --wait --wait-timeout 180

# Probe the backend through Nginx, not just the static frontend files.
"${compose[@]}" exec -T frontend wget -q -T 15 -O /dev/null http://127.0.0.1/healthz

install -m 600 "$source_dir/compose.production.yml" "$deploy_dir/compose.production.yml"
previous_images=()
if [[ -r "$saved_release" ]]; then
  mapfile -t previous_images < <(sed -nE 's/^(BACKEND|FRONTEND|MIGRATIONS)_IMAGE=//p' "$saved_release")
fi
mv -f -- "$release_file" "$saved_release"

mapfile -d '' backups < <(find "$deploy_dir/backups" -maxdepth 1 -type f -name 'pallets-*.dump' -print0 | sort -zr)
for backup in "${backups[@]:10}"; do
  rm -- "$backup" || echo 'Could not remove an expired backup' >&2
done

# Keep both deployed releases and up to two more local SHA tags per component.
for image in "$BACKEND_IMAGE" "$FRONTEND_IMAGE" "$MIGRATIONS_IMAGE"; do
  repository=${image%:*}
  retained=0
  while IFS= read -r tag; do
    [[ "$tag" =~ ^[a-f0-9]{40}$ ]] || continue
    candidate="$repository:$tag"
    [[ "$candidate" != "$image" ]] || continue
    if printf '%s\n' "${previous_images[@]}" | grep -Fxq -- "$candidate"; then continue; fi
    if ((retained < 2)); then
      retained=$((retained + 1))
      continue
    fi
    docker image rm "$candidate" >/dev/null || echo "Kept image still in use: $candidate" >&2
  done < <(docker image ls "$repository" --format '{{.Tag}}')
done
echo "Deployment completed; release images saved in $deploy_dir/release.production.env"
