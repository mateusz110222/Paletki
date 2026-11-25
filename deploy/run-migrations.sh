#!/bin/sh
set -eu
umask 077

export PGPASSFILE
PGPASSFILE=$(mktemp)
trap 'rm -f "$PGPASSFILE"' EXIT

{
    printf 'postgres-db:5432:pallets:encoredb_user:'
    sed 's/[\\:]/\\&/g' /run/secrets/postgres_password
    printf '\n'
} > "$PGPASSFILE"

migrate -path=/migrations -database=postgres://encoredb_user@postgres-db:5432/pallets?sslmode=disable up
