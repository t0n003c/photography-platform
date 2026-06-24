#!/usr/bin/env bash
# Day-one orientation for an AI coding agent (or human) new to this repo.
# READ-ONLY: prints repo + stack status and where to read next. Changes nothing.
# Run from the repo root:  ./scripts/agent-bootstrap.sh
set -uo pipefail

PROJECT="photography-platform"
WEB="${PROJECT}-web-1"
REDIS="${PROJECT}-redis-1"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
have() { command -v "$1" >/dev/null 2>&1; }

bold "── Photography Platform · agent bootstrap ─────────────────────────────"
echo

bold "1. READ FIRST (tool-agnostic handoff):"
echo "   • AGENTS.md          — how to work here (rules, commands, recipes)"
echo "   • PROJECT_MEMORY.md  — architecture, decisions, bugs, unfinished work"
echo "   • GEMINI.md          — Gemini entry point (Codex reads AGENTS.md natively)"
echo "   • docs/DEV-WORKFLOW.md, docs/PROJECT-BRIEF.md, docs/DECISIONS.md"
echo

bold "2. GIT STATUS"
if have git && git rev-parse --git-dir >/dev/null 2>&1; then
  echo "   branch:   $(git branch --show-current 2>/dev/null)"
  ahead="$(git rev-list --count origin/main..HEAD 2>/dev/null || echo '?')"
  echo "   unpushed: ${ahead} commit(s) ahead of origin/main"
  if [ "${ahead}" != "0" ] && [ "${ahead}" != "?" ]; then
    echo "   ⚠️  PUSHES ARE PAUSED — push only when the owner asks, batched into one push."
    echo "       Recent unpushed:"
    git log origin/main..HEAD --oneline 2>/dev/null | sed 's/^/         /' | head -8
  fi
  dirty="$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
  echo "   working tree: ${dirty} uncommitted change(s)"
else
  echo "   (not a git repository / git unavailable)"
fi
echo

bold "3. DOCKER STACK  (canonical local app = http://localhost:3001)"
if have docker; then
  health="$(docker inspect -f '{{.State.Health.Status}}' "${WEB}" 2>/dev/null || echo 'not running')"
  echo "   web (${WEB}): ${health}"
  echo "   running services:"
  docker ps --filter "name=${PROJECT}" --format '     {{.Names}}  ({{.Status}})' 2>/dev/null || true
  echo
  echo "   Rebuild web after code changes:"
  echo "     cd docker && docker compose -p ${PROJECT} --env-file ../.env \\"
  echo "       -f compose.yaml -f compose.dev.yaml build web && \\"
  echo "       docker compose -p ${PROJECT} --env-file ../.env \\"
  echo "       -f compose.yaml -f compose.dev.yaml up -d web"
  echo "   Clear cache: docker exec ${REDIS} redis-cli FLUSHALL"
else
  echo "   (docker unavailable)"
fi
echo

bold "4. FAST CHECKS"
echo "   npm run typecheck   • npm run lint   • npm test   • npm run test:e2e"
echo "   Demo/example page state lives in POSTGRES, not Redis (FLUSHALL reverts Redis-only edits)."
echo
bold "───────────────────────────────────────────────────────────────────────"
