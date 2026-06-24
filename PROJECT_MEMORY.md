# PROJECT_MEMORY.md

Complete handoff for an AI coding agent that has never seen this project. Written
2026-06-23. This file is the **fast on-ramp**; the authoritative long-form docs live
in [`docs/`](docs/) and are cited throughout. When this file and the code disagree,
the code wins — verify before asserting.

> **Companion files:** [`AGENTS.md`](AGENTS.md) (how to work in this repo — conventions,
> commands, guardrails) and [`README.md`](README.md) (quick start). The founding brief,
> verbatim, is [`docs/PROJECT-BRIEF.md`](docs/PROJECT-BRIEF.md); working conventions and
> gotchas are [`docs/DEV-WORKFLOW.md`](docs/DEV-WORKFLOW.md).

> ## ⚠️ FIRST, READ THIS: there are unpushed commits
> The local `main` branch is **ahead of `origin/main` by un-pushed commits** (≈24 as of this
> handoff, 2026-06-23) — feature work (3D carousel, "Alternative Scroll" layout) plus these
> handoff docs. **Pushes are intentionally PAUSED** (GitHub Actions minute quota); push only
> when the **owner explicitly asks**, and **batch everything into a single push**. Check the
> real count any time with:
> ```bash
> git rev-list --count origin/main..HEAD      # how many commits are unpushed
> git log origin/main..HEAD --oneline         # what they are
> ```
> Do not push automatically. See §12 and `AGENTS.md` rule 3.

---

## 1. Project purpose

A **self-hosted photography platform** replacing a WordPress/WooCommerce site. Three
products in one app, aiming for the UX bar of Pixieset / Pic-Time / Format / SmugMug:

1. **Public portfolio** — organized by **category** (Portraits, Events, Nature) and by
   **location/travel** (Arkansas, Colorado, Seattle…). Multiple gallery layouts.
2. **Private client galleries** — access-controlled pages where a client views/downloads
   their shoot, via real auth + expiring shareable links, favorites, download controls.
3. **Light print store** — browse/cart now; **payments are stubbed behind an interface**
   to be implemented later (invoicing/checkout), not built yet.

Plus: contact form (spam-protected), Instagram-style feed, About/hero, a full admin CMS,
dark mode, installable PWA, strong Lighthouse/accessibility. Runs entirely on a NAS.

Owner is a solo operator (one photographer). Treat it as a **long-lived production
product**, not a demo.

---

## 2. Architecture

**Two long-lived processes, one codebase** (see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)):

- **`web`** — one Next.js 15 (App Router) app serving three concerns: the **public**
  portfolio/galleries, the **admin** CMS, and the **API** (route handlers under `app/api`).
- **`worker`** — a separate Node process running a **BullMQ** consumer for heavy/async work
  (image derivative generation, EXIF normalize, email send, video render). Imports the
  *same* `src/` domain modules as `web`; never serves HTTP (just a health port).

Both processes are **stateless**. Durable state lives in:
- **PostgreSQL 16** — all relational data.
- **Redis/Valkey** — sessions, rate-limit counters, app cache, and the BullMQ job queue.
- **Object store** — originals + image derivatives. **SeaweedFS (S3-compatible) is the
  default driver**; a filesystem-volume driver is a selectable alternate (ADR-0024).

**Request path in production:** Browser → **Cloudflare Tunnel** (no open ports on the NAS)
→ **Nginx Proxy Manager** (reverse proxy) → `web` container. Cloudflare doubles as edge CDN
for cacheable HTML/ISR and image bytes.

**Media data flow:** upload (chunked/resumable) → validate → persist original to object
store + DB row → enqueue BullMQ job → worker runs `sharp` (AVIF/WebP variants + LQIP blur
placeholder, EXIF normalized: orientation kept, GPS dropped) → variant rows written →
public `<picture>` serves the right variant. Photo bytes are served **through the app**
(`app/api/v1/media/v/[id]`) so the object store needn't be publicly exposed.

**Progressive enhancement is a hard rule.** WebGL/GSAP/Lenis effects are decorative: lazy,
off the critical path, never block LCP/INP, and the site is fully usable with them disabled
or under `prefers-reduced-motion`. SSR renders a real fallback; JS enhances on mount.

---

## 3. Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | **Next.js 15** App Router + React 19 + TypeScript | SSR/SSG/ISR, one app |
| Styling/UI | **Tailwind CSS** + shadcn/ui primitives (`components/ui`) | dark mode via `next-themes` (system + manual, persisted) |
| Database | **PostgreSQL 16** + **Drizzle ORM** (SQL-first) | schema in `src/db/schema`, committed SQL migrations |
| Auth | **Better Auth** | password + TOTP 2FA + WebAuthn/passkeys; rate limit + lockout; passkeys are a *stronger* factor, admin-policy-gated |
| Cache/queue | **Redis/Valkey** + **BullMQ** | sessions, rate limit, cache, jobs |
| Image pipeline | **sharp** | AVIF/WebP responsive variants + LQIP, EXIF normalize, originals preserved |
| Storage | `StorageProvider` interface | **SeaweedFS (S3) default**, filesystem alternate; AWS SDK v3 client |
| PWA | **Serwist** (`@serwist/next`) | offline shell, manifest, thumbnail caching |
| Email | `EmailProvider` interface | **SMTP** (nodemailer) + **Resend** drivers |
| Payments | `PaymentProvider` **stub** | Stripe likely driver; seams only, not implemented |
| Animation | **GSAP** (+ ScrollTrigger/SplitText/ScrollToPlugin), **Lenis** smooth scroll, **Three.js / R3F** | all progressive enhancement |
| Video | **Remotion** (optional, worker `INSTALL_REMOTION_DEPS`) | gallery slideshow render |
| Bot defense | **Cloudflare Turnstile** | contact form + auth |
| Tests | **Vitest** (unit), **Playwright** (e2e), **Lighthouse CI** (`@lhci/cli`) | |

Full rationale + alternatives considered: [`docs/TECH-STACK.md`](docs/TECH-STACK.md).

---

## 4. Folder structure

One repo, two processes; `src/` is framework-agnostic domain code shared by both.
(Authoritative: [`docs/FOLDER-STRUCTURE.md`](docs/FOLDER-STRUCTURE.md).)

```text
app/                     # Next.js App Router — routing layer only
  (public)/              # public portfolio, categories, locations, galleries, contact, store
  (admin)/admin/         # auth-gated CMS: upload, library, galleries, pages, design, settings, menus
  api/                   # route handlers (the only mutation ingress); see §7
src/                     # framework-agnostic domain code (shared by web + worker)
  db/                    # Drizzle: schema/ migrations/ queries/ client
  auth/                  # Better Auth config, MFA policy, session helpers
  storage/               # StorageProvider interface + drivers (seaweedfs/s3, filesystem)
  image/                 # sharp pipeline: derivatives, lqip, exif
  queue/                 # BullMQ queues + typed job contracts + handlers
  email/                 # EmailProvider interface + smtp/resend drivers
  payments/              # PaymentProvider STUB (Stripe later)
  layout-config/         # (legacy) typed layout descriptor — see §6 note
  lib/                   # cross-cutting: blocks.ts, render-config.ts, preview.ts, cache.ts, env, logging
components/
  ui/                    # shadcn/ui primitives
  gallery/               # Gallery dispatcher, grids, lightbox, carousel-3d, responsive-image
  blocks/                # page-builder blocks incl. carousel-3d-scroll, column-scroll, scroll-showcase
  webgl/                 # Three.js/shader layer + feature.ts (prefersReducedMotion) + smooth-scroll (Lenis)
  admin/                 # admin-only components incl. live-preview
  layout/ forms/         # header/footer/nav/theme toggle; contact + admin forms
worker/                  # BullMQ consumer entry (worker/index.ts) — no HTTP
docker/                  # compose.yaml + overlays + Dockerfile.web/worker (see §8)
docs/                    # all long-form docs + ADRs (DECISIONS.md)
remotion/ scripts/ tests/ public/
.claude/                 # agents/ + skills/ (reusable for AI agents; see AGENTS.md)
```

---

## 5. Important files

| File | Why it matters |
|---|---|
| `docs/PROJECT-BRIEF.md` | The founding charter (verbatim). Source of intent/scope. |
| `docs/DEV-WORKFLOW.md` | Conventions, open follow-ups, and **gotchas** (read before editing). |
| `docs/DECISIONS.md` | ADR log (ADR-0024 storage, 0025–0028 CMS, etc.). |
| `src/db/schema/app.ts` | Drizzle schema — single source of truth for tables. |
| `src/lib/blocks.ts` | Page-builder block schemas (Zod) — the curated CMS blocks. |
| `src/lib/render-config.ts` | `GridType` union + `resolveRenderConfig` (public page layout resolution + admin live-preview override). |
| `src/lib/preview.ts` | `__pc` live-preview encode/decode (admin draft → public page). |
| `components/gallery/gallery.tsx` | **Grid-type dispatcher** — maps `gridType` → renderer. Add new layouts here. |
| `components/gallery/grids.tsx` | masonry / justified / uniform / carousel / filmstrip / mosaic / horizontal-lenis renderers. |
| `components/blocks/carousel-3d-scroll.tsx` | On-scroll 3D carousel (Codrops port). The template for scroll-driven effects. |
| `components/blocks/column-scroll.tsx` | "Alternative Scroll" (Codrops ColumnScroll port) — opposite-column parallax + content view. |
| `components/webgl/smooth-scroll.tsx` | Global Lenis; exposes `window.__lenis` for components to drive page scroll. |
| `components/webgl/feature.ts` | `prefersReducedMotion()` gate used by every enhancement. |
| `app/api/v1/media/v/[id]/route.ts` | Serves photo bytes (public OR admin-session OR grant-token). |
| `app/(admin)/admin/design/page.tsx` | Per-scope layout/theme editor (grid type, spacing, hero). |
| `app/(admin)/admin/galleries/[id]/page.tsx` | Per-gallery editor incl. its **Gallery tab** grid-type select. |
| `docker/compose.yaml` (+ overlays) | Service topology; `Dockerfile.web` / `Dockerfile.worker`. |
| `.claude/skills/gsap-scroll-animations/SKILL.md` | Playbook for porting reference web animations (GSAP/Lenis gotchas). |

---

## 6. Database decisions

- **PostgreSQL 16 + Drizzle ORM (SQL-first).** Schema is the single source of truth in
  `src/db/schema/`; migrations are **generated** (`npm run db:generate`) and **committed**
  as SQL in `src/db/migrations/` (currently through `0009_require_biometric.sql`). Apply
  with `npm run db:migrate` (or `RUN_MIGRATIONS=true` on container start).
- **Core tables** (in `app.ts`): `user`, `account`, `session`, `passkey`, `twoFactor`,
  `verification` (auth); `photo`, `photo_variant`, `photo_location` (media); `collection`
  + `collection_photo` (categories), `location`, `folder` + `folder_photo`; `gallery`,
  `gallery_photo`, `gallery_access_grant` (private galleries + expiring share links);
  `client`; `favorite`, `download`; `layout`, `page_config`, `page`, `menu`, `menu_item`
  (CMS/layout); `product`, `order`, `order_item`, `invoice` (store/payments stub);
  `site_settings`, `audit_log`, `contact_submission`.
- **`page_config`** is the per-surface layout instance: `scope` ∈
  `home|gallery|category|location|about|global`, plus `grid_type`, `spacing`, `theme`,
  `hero` (jsonb), `config` (jsonb), `is_default`. Public pages resolve their config via
  `resolveRenderConfig` (`src/lib/render-config.ts`).
- **`grid_type` is a plain `text` column** — the Drizzle `enum:[...]` is a **TypeScript hint
  only, not a DB CHECK constraint**. Adding a new grid type needs **no migration**; just
  extend the TS unions + the page-config API Zod enums. (See the "new grid type" pattern in
  AGENTS.md.)
- **Layouts are data, not hardcoded JSX** — the admin writes a descriptor, the public site
  renders it. NOTE: `src/layout-config/` is a *legacy* descriptor type not used for new
  scopes; `src/lib/render-config.ts` is the live source of truth for public rendering.
- Full schema + indexing strategy: [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md).

---

## 7. API decisions

- **REST-ish route handlers under `app/api`.** Versioned admin/public API under `app/api/v1`.
  Route handlers are the **only mutation ingress** (no direct DB writes from components).
- **Auth boundary:** `app/api/auth/[...all]` is Better Auth. `app/api/v1/admin/*` requires an
  authenticated admin session; public `app/api/v1/*` (categories, contact, `g/[token]`,
  checkout) is unauthenticated or grant-token gated.
- **Private gallery access:** `app/api/v1/g/[token]` + `gallery_access_grant` rows (expiring,
  rotatable, revocable share links — see `grants/[grantId]/{revoke,rotate}`).
- **Media bytes:** `app/api/v1/media/v/[id]` serves variant bytes with a 3-way gate: public
  photo → cacheable; else authenticated admin → private/no-store; else require a `?t=` grant
  token. (This gate was the root cause of a real bug — see §10.)
- **Uploads:** chunked/resumable — `uploads/init` → `uploads/[id]/chunks/[index]` →
  `uploads/[id]/complete` → enqueues a process job.
- **Validation:** shared **Zod** schemas; `page-config` create/patch enums are the real
  gate for allowed `grid_type` values.
- Conventions (pagination, error shape, rate limits): [`docs/API-DESIGN.md`](docs/API-DESIGN.md).

---

## 8. Docker / deployment setup

- **Compose project name:** `photography-platform`. Services: `web`, `worker`, `db`
  (Postgres 16), `redis`, `seaweedfs` (+ `seaweedfs-init`), optional `cloudflared` tunnel.
- **Compose files** in `docker/`: `compose.yaml` (base) + overlays `compose.dev.yaml`,
  `compose.prod.yaml`, `compose.ghcr.yaml` (pull pre-built images), `compose.nas.yaml`
  (pre-merged for Synology Container Manager). `Dockerfile.web` and `Dockerfile.worker`.
- **Local test deploy = Docker, not `next dev`.** The running app is **`http://localhost:3001`**
  (`photography-platform-web-1`, `WEB_PORT`→3001). Rebuild after code changes:
  ```bash
  cd docker && docker compose -p photography-platform --env-file ../.env \
    -f compose.yaml -f compose.dev.yaml build web && \
    docker compose -p photography-platform --env-file ../.env \
    -f compose.yaml -f compose.dev.yaml up -d web
  ```
  Flush cache when needed: `docker exec photography-platform-redis-1 redis-cli FLUSHALL`.
- **Production:** images published to **GHCR** (`ghcr.io/t0n003c/photography-platform-{web,worker}`)
  by `.github/workflows/publish-images.yml` on push to `main` (+ tags). NAS pulls via Dockge
  (Update → Restart). Inbound: **Cloudflare Tunnel → Nginx Proxy Manager → `web`**.
- **Synology gotcha:** seaweedfs is pinned (`chrislusf/seaweedfs:4.34`, `user:"0:0"`); DSM ACLs
  can block even container-root — fix with `chmod 755 seaweedfs && chmod 644 seaweedfs/s3.json`.
- Full topology, volumes, backups, upgrade/rollback: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## 9. Environment variables (excludes secret values)

Copy `.env.example` → `.env`. Keys (values redacted; **never commit real secrets** — `.env`
is gitignored):

- **App/runtime:** `NODE_ENV`, `WEB_PORT` (3001 local), `IMAGE_TAG`, `APP_BASE_URL`,
  `NEXT_PUBLIC_APP_URL`, `RUN_MIGRATIONS`, `WORKER_HEALTH_PORT`.
- **Tunnel:** `TUNNEL_TOKEN` (Cloudflare).
- **Database:** `DATABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`.
- **Redis:** `REDIS_URL`.
- **Auth (SECRET):** `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `SETTINGS_ENCRYPTION_KEY`
  (dedicated AES key for encrypting stored settings/secrets — generate `openssl rand -hex 32`;
  currently derived from `BETTER_AUTH_SECRET` until set in prod).
- **Storage:** `STORAGE_DRIVER` (`s3`|`fs`), `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`
  (SECRET), `S3_SECRET_ACCESS_KEY` (SECRET), `S3_BUCKET`, `S3_FORCE_PATH_STYLE`,
  `STORAGE_FS_PATH`.
- **Email:** `EMAIL_DRIVER` (`smtp`|`resend`), `EMAIL_FROM`, `CONTACT_NOTIFY_EMAIL`,
  `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` (SECRET), `RESEND_API_KEY` (SECRET).
- **Payments (deferred):** `PAYMENTS_DRIVER`, `STRIPE_SECRET_KEY` (SECRET).
- **Integrations:** `IG_ACCESS_TOKEN` (SECRET, Instagram), `TURNSTILE_SITE_KEY`,
  `TURNSTILE_SECRET_KEY` (SECRET — NAS needs real Turnstile keys).
- **Video:** `VIDEO_RENDER_ENABLED`, `INSTALL_REMOTION_DEPS`.
- **Seed:** `SEED_OWNER_EMAIL`, `SEED_OWNER_PASSWORD` (SECRET).

---

## 10. Bugs fixed and how

- **Library photos "extremely blurry"** (commit f841729): freshly uploaded photos rendered
  only their 16×16 LQIP. Cause: `media/v/[id]` only served bytes for *public* photos or with a
  grant token; a new Library photo has neither, so every `<img>` 404'd → `<picture>` fell back
  to the LQIP. Fix: **admin-session bypass** — if not public and a session exists, serve
  private/no-store; else require grant.
- **Upload "stuck Uploading"** (commit 4378704): drop a photo → stuck, no progress, no `init`
  request. Cause: a worker read the picked item back **synchronously inside a `setItems`
  updater** — React only runs updaters eagerly when the queue is empty (never guaranteed with
  concurrent workers), so `picked` was usually undefined. Fix: a `ref` as the synchronous
  source of truth, mirrored to state. **Lesson: never read a value out of a setState updater
  synchronously.**
- **WebGL hero rendered darker than the `<img>`** (commit 6252e70): a custom `ShaderMaterial`
  image texture tagged `THREE.SRGBColorSpace` is uploaded `SRGB8_ALPHA8` and hardware-decoded
  sRGB→linear; three only injects the re-encode into *built-in* shaders, not custom ones. Fix:
  tag passthrough image textures `THREE.LinearSRGBColorSpace`. Also: `flipY=true` inverts the
  texture V axis, so feed `1 - focalY` to the focal-point uniform (commit c70dd93).
- **3D-carousel return not front-facing / visible snap:** the scrub maps scroll→rotation
  through the tween's `sine.inOut` ease; a *linear* inverse drifts ~¼-step. Fix: invert the
  ease (`p = acos(1−2e)/π`) using the trigger's real start/end; match the wobble channel on
  the scrub hand-off so the tilt doesn't snap; drive the scroll *through Lenis*.
- **Preview "sometimes shows nothing":** hidden with `autoAlpha` (sets `visibility:hidden`) but
  revealed with plain `opacity` → stayed `visibility:hidden`. Fix: reveal with `autoAlpha` too.
- **Page left scroll-locked after a layout overlay:** `lenis.stop()` on open with no
  `lenis.start()` on unmount. Fix: restart Lenis in the cleanup.
- **Demo page silently reverting** to `cinematic`/`masonry`: the chosen style was only set in
  **Redis**; a `FLUSHALL` reverts it to the Postgres value. Fix: persist with SQL
  (`jsonb_set` on `page.blocks` or `UPDATE page_config`), *then* flush.
- **NAS seaweedfs-init failing:** `:latest` auto-updated to a non-root image that couldn't read
  root-owned `s3.json`. Fix: pin `chrislusf/seaweedfs:4.34` + `user:"0:0"`; on Synology, fix DSM
  ACLs (`chmod 755 seaweedfs` + `644 s3.json`).

---

## 11. Things we tried that failed (and the takeaway)

- **Locomotive Scroll / GSAP ScrollSmoother** for the ported scroll demos — both **hijack the
  whole page scroll and fight the global Lenis**. We deliberately do **not** add them; reproduce
  the visual with our own GSAP **ScrollTrigger** instead (the one intentional deviation per port).
- **Approximating reference animations by eye** instead of reading the source — caused ~20+
  iteration round-trips on the 3D carousel. **Fetch the real source first**, transcribe every
  tween, then build. (Codified in `.claude/skills/gsap-scroll-animations`.)
- **Numeric-only verification** of animations — angle assertions passed while wobble-snaps, title
  shifts, and blank states were visibly wrong. **Verify visually** (screenshots / frame traces),
  not just numerically.
- **`window.scrollTo` to drive page scroll** — overridden by Lenis's rAF loop; must use
  `window.__lenis.scrollTo(y, {immediate, force})`.
- **`overflow:hidden` to lock the page** during an overlay — shrinks the scrollable height and
  **clamps** `lenis.scrollTo`. Use `lenis.stop()` (force-scroll overrides it). And to clip a
  parallax block while keeping `position:sticky` working, use `overflow-x: clip`, not `hidden`.
- **`PR`-based git flow** — abandoned. The owner found per-PR clicking tedious; solo project now
  commits **directly to `main`** (see §13 / AGENTS.md).

---

## 12. Current unfinished tasks

- **Unpushed commits:** `main` is **~23 commits ahead of `origin`** (3D-carousel refinements,
  the "Alternative Scroll" layout, docs/skills). **Pushes are PAUSED** by owner request (GitHub
  Actions minutes near quota); push only when the owner explicitly asks, batched into one push.
- **Finish Home migration:** `/admin/pages` seeds a DRAFT "Home" page reproducing the old
  homepage; the live home stays bespoke until the owner previews and **publishes** it.
- **Production secret:** set a dedicated `SETTINGS_ENCRYPTION_KEY` (`openssl rand -hex 32`).
- **GHCR packages:** after a `publish-images` run, the two GHCR packages must be **Public** (or
  `docker login`) before the NAS pull works.
- **Payments:** still a stub — `PaymentProvider` interface + seams only; implement when desired.
- **Consider** switching `publish-images.yml` to `workflow_dispatch`/tags-only (or gating the
  heavy Lighthouse CI job off `push`) to stop routine pushes burning Actions minutes.
- Roadmap + deferred items: [`docs/ROADMAP.md`](docs/ROADMAP.md).

---

## 13. Coding conventions

- **Phase-gated, plan-first.** Non-trivial work: plan → get approval → build in small,
  one-concern, reviewable increments → summarize → pause. Document meaningful decisions in
  `docs/` (ADR in `DECISIONS.md`).
- **Git: commit directly to `main`, no PRs.** End commit messages with
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` (adjust to your agent). **Do not
  push** unless the owner asks; batch pending commits into one push.
- **No secrets in code.** Everything sensitive in `.env` (gitignored); `.env.example` documents
  keys. Stored settings/secrets are AES-256-GCM encrypted.
- **Drivers behind interfaces** (storage/email/payments); call sites depend on the interface.
- **Layouts are data**, not hardcoded JSX. Adding a layout = config + a renderer branch.
- **Progressive enhancement is mandatory** for any WebGL/GSAP/Lenis effect: SSR fallback,
  `prefersReducedMotion()` gate, never block LCP/INP, fully usable without JS/WebGL.
- **TypeScript strict**; validate with `npm run typecheck`. Lint `npm run lint`, format with
  Prettier (`+ prettier-plugin-tailwindcss`). Match surrounding code's idiom/comment density.
- **Verify before claiming done:** `tsc` clean → rebuild Docker `web` (:3001) → smoke-test
  (Playwright for UI/animation; assert **0 console errors**, test reduced-motion + mobile).
- **Demo/example state lives in Postgres**, not Redis (a `FLUSHALL` reverts Redis-only edits).

---

## 14. Future recommendations

- **Push the 23 local commits** when the owner is ready (one batch); then make GHCR packages
  public and pull on the NAS.
- **Reduce CI cost:** move the Lighthouse-on-full-stack CI job off every `push` (to
  `workflow_dispatch`/schedule); it's the biggest minute sink and unrelated to publishing images.
- **Implement payments** when needed via the existing `PaymentProvider` stub (Stripe driver);
  the seams (`invoice`, `order` tables, checkout route) already exist.
- **Finish + publish the Home page** through the CMS so the homepage is fully data-driven.
- **When porting another reference animation**, follow `.claude/skills/gsap-scroll-animations`
  (fetch source → beat list → invert eases → match full transform state → verify visually) and
  delegate the smoke test to the `animation-visual-reviewer` agent. `carousel-3d-scroll.tsx` and
  `column-scroll.tsx` are working templates.
- **Keep `src/lib/render-config.ts` as the single grid-type source of truth**; retire the unused
  `src/layout-config/` legacy descriptor when convenient.
- **Set the production `SETTINGS_ENCRYPTION_KEY`** before storing real client/SMTP secrets.
