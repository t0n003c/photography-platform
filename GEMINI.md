# GEMINI.md

Context entry point for Gemini CLI. This project keeps its agent guidance in shared,
tool-agnostic files so any assistant (Gemini, Codex, Claude, …) uses the same source of truth.

**Read these, in order:**
1. **[`AGENTS.md`](AGENTS.md)** — how to work in this repo: golden rules, commands, the Docker
   `:3001` workflow, verification checklist, and recipes. **Follow it as your operating guide.**
2. **[`PROJECT_MEMORY.md`](PROJECT_MEMORY.md)** — full project handoff: purpose, architecture,
   tech stack, structure, DB/API decisions, deployment, env keys, bugs fixed, failed attempts,
   unfinished tasks, conventions, recommendations.
3. **[`docs/`](docs/)** — authoritative long-form docs (start with `docs/DEV-WORKFLOW.md`).

**Two things to internalize immediately:**
- ⚠️ **Unpushed commits exist** on local `main` (pushes are PAUSED — push only when the owner
  asks, batched). Check: `git rev-list --count origin/main..HEAD`.
- **No secrets in code**, **commit to `main` (no PRs) but don't push unless asked**, and every
  animation must degrade gracefully (reduced-motion + no-JS fallback).
