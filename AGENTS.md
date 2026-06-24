# AGENTS.md

Operating guide for an AI coding agent working in this repository. Read
[`PROJECT_MEMORY.md`](PROJECT_MEMORY.md) first for what the project *is*; this file is
how to *work* in it. Authoritative long-form: [`docs/`](docs/) (start with
[`docs/DEV-WORKFLOW.md`](docs/DEV-WORKFLOW.md)).

---

## Golden rules (do not violate)

1. **Plan before non-trivial work.** Propose an approach and get owner approval before
   writing code for any multi-file feature. Work in small, one-concern, reviewable steps;
   summarize and pause between phases. Trivial fixes (typo, one-liner) don't need a plan.
2. **No secrets in code.** `.env` is gitignored; document new keys in `.env.example` with
   placeholder values. Never print real secret values into logs/output.
3. **Commit to `main`, but do NOT push unless the owner explicitly asks.** Pushes are
   paused (CI minute quota). Keep committing locally; batch into one push when asked.
4. **End commit messages** with a `Co-Authored-By:` trailer for your agent.
5. **Progressive enhancement is mandatory** for any animation/WebGL/Lenis work: SSR
   fallback, `prefersReducedMotion()` gate, never block LCP/INP, fully usable without JS.
6. **Verify before claiming done** — see the checklist below. Assert **0 console errors**.
7. **Challenge-and-recommend** rather than silently comply when a request is ambiguous or a
   better approach exists.

---

## Orientation

- **Run `./scripts/agent-bootstrap.sh` first** — read-only; prints git status (incl. unpushed
  commit count), Docker stack health, the rebuild command, and what to read. Changes nothing.

## Environment & key commands

- **The running app is Docker at `http://localhost:3001`** (`photography-platform-web-1`),
  **not `next dev`**. After editing code, rebuild the `web` image to see changes:
  ```bash
  cd docker && docker compose -p photography-platform --env-file ../.env \
    -f compose.yaml -f compose.dev.yaml build web && \
    docker compose -p photography-platform --env-file ../.env \
    -f compose.yaml -f compose.dev.yaml up -d web
  # wait for health, then optionally clear cache:
  docker exec photography-platform-redis-1 redis-cli FLUSHALL
  ```
- **Health gate:** `docker inspect -f '{{.State.Health.Status}}' photography-platform-web-1`
  → `healthy`. `/admin/*` returns 307→/login when logged out (means the page is up).
- **Local checks (fast):** `npm run typecheck` · `npm run lint` · `npm test` (Vitest) ·
  `npm run test:e2e` (Playwright).
- **DB:** `npm run db:generate` (after schema edits) → commit the SQL → `npm run db:migrate`.
  `npm run db:studio` to browse. Inspect live DB:
  `docker exec photography-platform-db-1 psql -U photog -d photography -c "…"`.
- **Worker:** `npm run worker` (local) or the `worker` container.

---

## Verification checklist (run before saying "done")

1. `npm run typecheck` clean (ignore `.next/types` noise).
2. Rebuild Docker `web`; container reports `healthy`.
3. For UI/animation: Playwright with `channel:'chrome'`. Assert **0 pageerror/console-error**.
   Test **three contexts**: desktop, `reducedMotion:'reduce'` (static fallback, not enhanced),
   and mobile (`devices['iPhone 13']`). Capture screenshots for visual changes.
4. For data/layout: set the test fixture in **Postgres** (not Redis — a `FLUSHALL` reverts
   Redis-only edits), `FLUSHALL`, then load the real page.
5. Restore any test fixtures you changed (don't leave live pages on a debug layout).

Delegate animation smoke-tests to the **`animation-visual-reviewer`** agent
(`.claude/agents/`); it drives Playwright across all three contexts and reports a verdict.

---

## Recipe: add a new gallery **grid type** (well-trodden path)

`grid_type` is free-form `text` in Postgres — **no migration needed**. Add the value to every
enumeration + the dispatcher (mirror how `carousel-3d-scroll` / `alternative-scroll` were added):

1. Type unions: `src/lib/render-config.ts` (`GridType`), `src/lib/preview.ts`
   (`PreviewConfig.gridType`), `components/admin/live-preview.tsx` (`PreviewGrid`),
   `app/(admin)/admin/design/page.tsx` (local `GridType`), `components/gallery/gallery.tsx`
   (`GalleryLayout.gridType`), and the Drizzle hint in `src/db/schema/app.ts`.
2. API validation: the Zod `gridType` enums in `app/api/v1/admin/page-configs/route.ts` and
   `app/api/v1/admin/page-configs/[id]/route.ts`.
3. Admin options: a `<option>` in the Design editor (`design/page.tsx`) and/or the per-gallery
   **Gallery tab** (`galleries/[id]/page.tsx`); scope-gate if the layout needs a collection.
4. Renderer: a branch in `components/gallery/gallery.tsx` → your component (full-bleed
   standalone like `carousel-3d-scroll`/`column-scroll`, or a `grids.tsx` renderer).
5. Hide irrelevant controls (e.g. Spacing) for that grid type if it self-manages them.

---

## Recipe: port a reference web animation (Codrops/CodePen/GSAP)

Follow **`.claude/skills/gsap-scroll-animations/SKILL.md`** — the hard-won playbook:

1. **Fetch the real source first** (`gh api .../contents/...` or raw URL); transcribe every
   tween into a beat list (property, from/to, duration, ease, position) for open AND close.
2. Reproduce with **our GSAP + ScrollTrigger** — do **not** add Locomotive/ScrollSmoother
   (they fight the global Lenis). Note the intentional deviation in a comment.
3. Drive page scroll through **`window.__lenis`** (`smooth-scroll.tsx`); lock with
   `lenis.stop()` (never `overflow:hidden`); restart on unmount.
4. A scrubbed tween applies its **ease** — invert it to map scroll↔value (a linear inverse
   drifts ~¼-step). Match **every** transform channel on a scrub hand-off (incl. wobble).
5. `autoAlpha` vs `opacity`: don't hide with one and reveal with the other.
6. SSR/reduced-motion fallback; enhance on mount via `gsap.context`. Verify **visually**.

Working templates: `components/blocks/carousel-3d-scroll.tsx`, `components/blocks/column-scroll.tsx`.

---

## `.claude/` assets (reusable, repo-tracked)

- **Skills** (`.claude/skills/`): `gsap-scroll-animations` (animation porting),
  `gallery-layout` (the admin↔public layout-config contract), `image-optimization`
  (variant/format rules), `lighthouse-audit` (budgets).
- **Agents** (`.claude/agents/`): `animation-visual-reviewer`, `frontend-webgl`,
  `security-auditor`, `media-pipeline`, `performance-lighthouse`, `devops-docker`,
  `architecture-reviewer`. These are Claude-Code-format markdown; adapt the prompts/tool lists
  to your agent runtime as needed, but the domain guidance in them is current and useful.

---

## Pitfalls that have bitten before (see PROJECT_MEMORY §10–11)

- Reading a value out of a React `setState` updater synchronously (use a `ref`).
- WebGL custom `ShaderMaterial` image textures must be `LinearSRGBColorSpace`, not `SRGBColorSpace`.
- `window.scrollTo` is overridden by Lenis — use `window.__lenis.scrollTo(...)`.
- `overflow:hidden` clamps `lenis.scrollTo`; for clipping a sticky-containing block use
  `overflow-x: clip`.
- Demo/example page state is in **Postgres** (`page.blocks` / `page_config`), not Redis.
- Serving private photo bytes: `media/v/[id]` needs the public/admin-session/grant-token gate.
