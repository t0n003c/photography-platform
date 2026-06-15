#!/usr/bin/env bash
# Restore Postgres + MinIO media from backup artifacts produced by backup.sh.
# Usage:  ./scripts/restore.sh <pg-YYYYMMDD-HHMMSS.sql.gz> <media-YYYYMMDD-HHMMSS.tar.gz>
# DESTRUCTIVE: overwrites the current database and media volume. Stop traffic first.
set -euo pipefail

PG_DUMP="${1:?path to pg-*.sql.gz required}"
MEDIA_TAR="${2:?path to media-*.tar.gz required}"
PROJECT="photography-platform"
COMPOSE="docker compose -f docker/compose.yaml"
PG_USER="${POSTGRES_USER:-photog}"
PG_DB="${POSTGRES_DB:-photography}"

read -r -p "This OVERWRITES the database and media. Continue? [y/N] " ok
[ "$ok" = "y" ] || { echo "aborted"; exit 1; }

echo "[restore] postgres ← $PG_DUMP"
gunzip -c "$PG_DUMP" | $COMPOSE exec -T db psql -U "$PG_USER" -d "$PG_DB"

echo "[restore] stopping minio to restore its volume"
$COMPOSE stop minio
docker run --rm \
  -v "${PROJECT}_miniodata:/data" \
  -v "$(cd "$(dirname "$MEDIA_TAR")" && pwd):/backup:ro" \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/$(basename "$MEDIA_TAR") -C /data"
$COMPOSE start minio

echo "[restore] done. Verify the app, then resume traffic."
