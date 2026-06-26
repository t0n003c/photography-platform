# Dev Workflow, Conventions & Gotchas

Durable, git-tracked home for the working agreements, operational conventions, and hard-won
gotchas that used to live in scattered Claude file-memories. The founding intent is in
[`PROJECT-BRIEF.md`](./PROJECT-BRIEF.md); architectural decisions in [`DECISIONS.md`](./DECISIONS.md).

**Memory model (decided 2026-06-22):**
- **claude-mem** (plugin, worker on `127.0.0.1:37701`, local SQLite+Chroma in `~/.claude-mem`) is the **source of truth for cross-session recall** — it auto-captures via the SessionStart hook; nothing to invoke.
- **This `docs/` tree + `.claude/skills/` + `.claude/agents/`** are the **durable, git-tracked, human-facing layer** — and the real disaster-recovery, since claude-mem's DB is local-only and not in git.
- The Claude file-memory (`MEMORY.md` + `memory/*.md`) is **retired down to a thin pointer index**; content was folded here to avoid maintaining three overlapping stores.
- ⚠️ **Privacy:** claude-mem captures tool outputs, which here include `.env` secrets, `BETTER_AUTH_SECRET`, client PII, and grant tokens. Wrap sensitive command output in `<private>…</private>` so it isn't ingested.

## 1. Working agreements
- **Phase-gated.** Built Phase 0 (planning) → Phases 1–7. Work in small, one-concern, reviewable increments; after each phase summarize what changed + what's next, then **pause for explicit approval**. Don't write app code before the plan is approved. Document every meaningful decision in `/docs`. No secrets in code. Ask before a new paid service / new top-level dependency category / anything that changes the deployment shape. Challenge-and-recommend rather than silently comply.
- **Git: commit directly to `main`, no PRs** (solo project, decided 2026-06-17). No feature branches, no merge step. `main` is the single source of truth; the whole CMS stack is already merged.
  - Caveat: the Claude Code auto-classifier blocks pushes to the default branch unless a Bash permission rule allows it — `Bash(git push origin main:*)` is in `.claude/settings.local.json`. If a push is denied, add the rule rather than re-attempting.
  - End commit messages with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Push only when the owner explicitly asks.** The repo was made public on 2026-06-26, so standard GitHub-hosted Actions minutes for these public workflows should be free, but each push to `main` still runs CI plus `Publish images` for 2 Docker images. Keep pushes intentional and batch related local commits when practical.
- **Local test deploy = Docker, not `next dev`.** The running app is `http://localhost:3001` (`photography-platform-web-1`, `WEB_PORT`→3001). To make changes live, rebuild the web image:
  ```bash
  cd docker && docker compose -p photography-platform --env-file ../.env \
    -f compose.yaml -f compose.dev.yaml build web && \
    docker compose -p photography-platform --env-file ../.env \
    -f compose.yaml -f compose.dev.yaml up -d web
  ```
  Flush Redis when needed: `docker exec photography-platform-redis-1 redis-cli FLUSHALL`. `/admin/*` is auth-gated (307→/login when logged out = the page is up).
- App-code pushes to `main` auto-trigger the GHCR rebuild (`ghcr.io/t0n003c/photography-platform-{web,worker}`); the owner then pulls + redeploys on the NAS. Compose/`.env`-only changes need no rebuild (edit in Dockge).

## 2. Open follow-ups (owner actions, not bugs)
- **GHCR packages:** after a `publish-images` run, make the two GHCR packages **Public** (or `docker login`) before the NAS pull works.
- **Finish Home migration:** opening `/admin/pages` seeds a DRAFT "Home" page reproducing the old homepage; the live home stays bespoke until the owner previews and **publishes** it.
- **Production secret:** set a dedicated `SETTINGS_ENCRYPTION_KEY` (`openssl rand -hex 32`); until then it's derived from `BETTER_AUTH_SECRET`.

## 3. Gotchas & lessons (durable)
- **Demo/example page state lives in Postgres, not Redis.** The `scroll-showcase-example` page's block style is `page.blocks[2].style`. A `redis-cli FLUSHALL` reverts any Redis-only change to the DB value, so persist with SQL then flush:
  ```sql
  UPDATE page SET blocks = jsonb_set(blocks, '{2,style}', '"carousel3d"') WHERE slug='scroll-showcase-example';
  ```
  This page must stay on `carousel3d`. (Bit us twice: the demo silently reverted to `cinematic`.)
- **Never read a value back out of a React `setState` updater synchronously.** Upload "stuck Uploading" (commit 4378704) was a worker reading the picked item inside a `setItems` updater — React only runs updaters eagerly when the queue is empty (never guaranteed with concurrent workers). Use a `ref` as the synchronous source of truth, mirror to state.
- **Serving private photo bytes in admin surfaces:** `app/api/v1/media/v/[id]/route.ts` only served bytes for public photos or with a grant token; freshly uploaded Library photos have neither and fell back to the 16×16 LQIP ("extremely blurry"). Fix: admin-session bypass (`if (!isPhotoPublic) { if (await getSession()) serve private/no-store; else require grant }`).
- **WebGL passthrough image textures must use `THREE.LinearSRGBColorSpace`, not `SRGBColorSpace`.** Custom `ShaderMaterial`s don't get three's `colorspace_fragment` re-encode, so an `SRGBColorSpace` texture (uploaded `SRGB8_ALPHA8`) is hardware-decoded sRGB→linear and renders ~gamma-2.2 darker than the `<img>`. `LinearSRGBColorSpace` keeps `RGBA8` passthrough (commit 6252e70). Same components also: `flipY=true` inverts texture V, so feed `1 - focalY` to the focal-point uniform (commit c70dd93). r3f tone mapping is likewise a no-op on custom shaders.
- **Porting a reference web animation (Codrops/CodePen/GSAP):** fetch the real source FIRST, transcribe every tween into a beat list, invert the scrub's ease, match the full transform state on hand-off, and verify **visually** (screenshots/frame traces), not just numerically. Full playbook + the GSAP/Lenis/ScrollTrigger gotchas: [`.claude/skills/gsap-scroll-animations/SKILL.md`](../.claude/skills/gsap-scroll-animations/SKILL.md). Delegate animation smoke-tests to the `animation-visual-reviewer` agent.
