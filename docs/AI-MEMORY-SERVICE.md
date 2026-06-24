# AI Memory Service — optional design (NOT built)

A sketch for an **optional, self-hosted, vendor-neutral memory service** the project's AI
agents (Codex, Gemini, Claude, …) could query for semantic recall. This is a **design doc, not
a shipped component** — nothing depends on it. Build it only if the git-tracked Markdown handoff
(`PROJECT_MEMORY.md`, `AGENTS.md`, `docs/`) stops being enough as history grows.

> **Read this first — the non-negotiable principle:** the **git-tracked Markdown is the source of
> truth.** This service is a *cache/accelerator* that is **rebuildable at any time by re-indexing
> those files**. Nothing important may live only here. We deliberately moved *off* a local-only
> memory DB this session (claude-mem) because it wasn't in git, wasn't reviewable, and was lost on
> a machine change — do not recreate that failure mode.

## Why optional (decision context)
- **Markdown works in every agent with zero setup**; a service only helps after MCP wiring +
  hosting + an embedding model + a sync story. For a solo project, that weight is often not worth it.
- **Same secret/PII hazard as claude-mem.** If it ingested raw tool output it would absorb `.env`
  secrets, `BETTER_AUTH_SECRET`, client PII, and grant tokens. The ingestion policy below forbids that.

## Shape (if built)
Matches the proposed `ai-memory-container`:
```
ai-memory-container
  ├── FastAPI        # HTTP API (and the MCP adapter agents connect through)
  ├── SQLite         # canonical records: id, source_path, chunk, kind, created_at, content_hash
  └── Qdrant         # vector index over the chunks for semantic search
  └── Agents (Codex / Gemini / Claude) connect via MCP
```
Run it as one more Compose service on the NAS (own network alias; **not** publicly exposed —
behind the same Cloudflare Tunnel / NPM boundary, or local-only).

## Ingestion policy (the part that keeps it safe)
**Index ONLY:**
- The git-tracked docs: `PROJECT_MEMORY.md`, `AGENTS.md`, `GEMINI.md`, everything in `docs/`,
  `.claude/skills/**`, and commit messages.
- **Redacted session *summaries*** an agent writes deliberately (decisions, gotchas) — prose, not transcripts.

**NEVER index:**
- Raw tool/command output, file contents outside the doc set, `.env`/secrets, client PII, tokens.
- Anything wrapped in `<private>…</private>`.

Each record stores a `content_hash` + `source_path` so re-indexing is idempotent and the whole
store can be dropped and rebuilt from the repo.

## API contract (minimal)
| Method | Path | Purpose |
|---|---|---|
| `POST` | `/index` | `{ source_path, text, kind }` → chunk, embed, upsert to SQLite+Qdrant (skip if `content_hash` unchanged). |
| `POST` | `/search` | `{ query, k? }` → top-k chunks `{ text, source_path, score }`. The agent's main tool. |
| `POST` | `/reindex` | Re-scan the allowed doc set from disk; rebuild from scratch. |
| `DELETE` | `/source` | `{ source_path }` → drop a source's chunks. |
| `GET` | `/health` | liveness + record/vector counts. |

Expose `search` (and optionally `index`) as an **MCP tool** with a clear description so Codex/Gemini
auto-discover it. Document the connection in `AGENTS.md` so setup is one step.

## Guardrails (summary)
1. **Index only docs + redacted summaries — never raw output or secrets.**
2. **It's a cache, not a record** — rebuildable via `/reindex` from the git-tracked files.
3. **Not publicly exposed**; same trust boundary as the rest of the stack.
4. If it drifts from the Markdown, the **Markdown wins** — `/reindex` to resync.

## Cheaper alternatives to consider first
- Just keep the Markdown handoff well-curated (current approach — likely sufficient).
- A static `scripts/agent-bootstrap.sh` (already added) for day-one orientation.
- The agent's native context files (`AGENTS.md` for Codex, `GEMINI.md` for Gemini) for always-on rules.
