#!/usr/bin/env bash
# Stop the Photography Platform locally (containers stop; your data is kept).
# Double-click this file in Finder, or run ./stop-app.command in a terminal.
set -euo pipefail
cd "$(dirname "$0")"

if ! docker info >/dev/null 2>&1; then
  echo "Docker isn't running — nothing to stop."
else
  echo "▶ Stopping the app…"
  docker compose -f docker/compose.yaml --env-file .env down
  echo "✓ Stopped. Your database/photos are preserved (in Docker volumes)."
fi
echo
if [ -t 1 ]; then read -r -p "Press Return to close this window… " _; fi
