#!/usr/bin/env bash
# Back up Postgres (logical dump) + MinIO media (volume tar) to ./backups.
# Run from the repo root with the stack up:  ./scripts/backup.sh
# Originals are the irreplaceable asset; derivatives are regenerable but are
# included here for fast restore. See docs/DEPLOYMENT.md.
set -euo pipefail

PROJECT="photography-platform"
COMPOSE="docker compose -f docker/compose.yaml"
OUT="${BACKUP_DIR:-./backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
RETENTION="${BACKUP_RETENTION:-14}"
PG_USER="${POSTGRES_USER:-photog}"
PG_DB="${POSTGRES_DB:-photography}"

mkdir -p "$OUT"

echo "[backup] postgres → $OUT/pg-$STAMP.sql.gz"
$COMPOSE exec -T db pg_dump -U "$PG_USER" -d "$PG_DB" --no-owner --clean --if-exists \
  | gzip > "$OUT/pg-$STAMP.sql.gz"

echo "[backup] minio media volume → $OUT/media-$STAMP.tar.gz"
docker run --rm \
  -v "${PROJECT}_miniodata:/data:ro" \
  -v "$(cd "$OUT" && pwd):/backup" \
  alpine sh -c "tar czf /backup/media-$STAMP.tar.gz -C /data ."

echo "[backup] pruning backups older than the last $RETENTION"
ls -1t "$OUT"/pg-*.sql.gz 2>/dev/null | tail -n +"$((RETENTION + 1))" | xargs -r rm -f
ls -1t "$OUT"/media-*.tar.gz 2>/dev/null | tail -n +"$((RETENTION + 1))" | xargs -r rm -f

echo "[backup] done. Copy $OUT offsite (e.g. Cloudflare R2 / rclone) for durability."
