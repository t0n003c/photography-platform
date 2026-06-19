#!/usr/bin/env bash
# Start the Photography Platform locally.
# Double-click this file in Finder, or run ./start-app.command in a terminal.
# The site comes up at http://localhost:3001
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE=(docker compose -f docker/compose.yaml --env-file .env)

echo "▶ Checking Docker…"
if ! docker info >/dev/null 2>&1; then
  echo "  Docker isn't running — launching Docker Desktop…"
  open -a Docker || { echo "✗ Couldn't launch Docker Desktop. Open it manually, then re-run."; exit 1; }
  printf "  Waiting for Docker to start"
  for _ in $(seq 1 60); do
    if docker info >/dev/null 2>&1; then echo " ✓"; break; fi
    printf "."; sleep 3
  done
  docker info >/dev/null 2>&1 || { echo; echo "✗ Docker still not ready. Give it a minute and run this again."; exit 1; }
else
  echo "  ✓ Docker is running"
fi

echo "▶ Starting the app (db, redis, seaweedfs, web, worker)…"
"${COMPOSE[@]}" up -d

echo "▶ Waiting for the web app to be healthy…"
for _ in $(seq 1 40); do
  status="$(docker inspect --format '{{.State.Health.Status}}' photography-platform-web-1 2>/dev/null || echo starting)"
  if [ "$status" = "healthy" ]; then echo "  ✓ healthy"; break; fi
  printf "."; sleep 3
done

echo
echo "✅ App is up:   http://localhost:3001"
echo "   Admin:       http://localhost:3001/admin"
echo
echo "To stop it later, double-click stop-app.command (or run: docker compose -f docker/compose.yaml down)"
echo
# Keep the window open when double-clicked from Finder.
if [ -t 1 ]; then read -r -p "Press Return to close this window… " _; fi
