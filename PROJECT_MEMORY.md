# PROJECT_MEMORY.md

Complete handoff for an AI coding agent that has never seen this project. Written
2026-06-23. This file is the **fast on-ramp**; the authoritative long-form docs live
in [`docs/`](docs/) and are cited throughout. When this file and the code disagree,
the code wins — verify before asserting.

> **Companion files:** [`AGENTS.md`](AGENTS.md) (how to work in this repo — conventions,
> commands, guardrails) and [`README.md`](README.md) (quick start). The founding brief,
> verbatim, is [`docs/PROJECT-BRIEF.md`](docs/PROJECT-BRIEF.md); working conventions and
> gotchas are [`docs/DEV-WORKFLOW.md`](docs/DEV-WORKFLOW.md).

> ## FIRST, READ THIS: push/audit state
> The previously paused Claude-to-Codex backlog was pushed to GitHub on **2026-06-26** after
> the owner explicitly approved it. The repository is now public at
> `https://github.com/t0n003c/photography-platform`, so standard GitHub-hosted Actions minutes
> for public-repo workflows should not count against the private-repo minute quota. Continue to
> commit directly to `main`, but still **do not push unless the owner explicitly asks**. Check the
> real local state any time with:
> ```bash
> git rev-list --count origin/main..HEAD      # how many commits are unpushed
> git log origin/main..HEAD --oneline         # what they are
> ```
> See §12 and `AGENTS.md` rule 3.

---

## 1. Project purpose

A **self-hosted photography platform** replacing a WordPress/WooCommerce site. Three
products in one app, aiming for the UX bar of Pixieset / Pic-Time / Format / SmugMug:

1. **Public portfolio** — organized by **category** (Portraits, Events, Nature) and by
   **location/travel** (Arkansas, Colorado, Seattle…). Multiple gallery layouts.
2. **Private client galleries** — access-controlled pages where a client views/downloads
   their shoot, via real auth + expiring shareable links, favorites, download controls.
3. **Light print store** — product management, public product browsing, browser-local
   cart, and manual invoice order requests are underway. **Real payments remain stubbed
   behind an interface** to be implemented later.

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
  (CMS/layout); `product`, `order`, `order_item`, `invoice` (store/payments seam);
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

- **Push state:** the Claude-to-Codex backlog and subsequent Codex UI/effect work were pushed
  to `origin/main` on 2026-06-26 after owner approval. The repo is public. Keep committing
  directly to `main`, but push only when the owner explicitly asks.
- **Audit state after the push:** local checks passed on 2026-06-26: `npm run typecheck`,
  `npm run lint`, `npm test`, and `E2E_BASE_URL=http://localhost:3001 npm run test:e2e`.
  Docker image builds for both `docker/Dockerfile.web` and `docker/Dockerfile.worker` passed
  after changing Docker installs to `npm ci --foreground-scripts`. Runtime audit findings were
  patched by upgrading `nodemailer` to 9.0.1, Remotion packages to 4.0.483, Vitest to 4.1.9,
  and pinning root `esbuild` to 0.28.1. Follow-up audit work added npm overrides for
  dev-tool transitive packages (`tmp`, `uuid`, `js-yaml`, `esbuild`) and lifted root
  `postcss`; `npm audit --audit-level=high` now exits clean. The remaining audit output is a
  moderate PostCSS advisory nested inside `next`; npm's suggested force fix is a breaking
  downgrade to Next 9, so wait for an upstream Next patch rather than applying it blindly.
  CI Lighthouse previously reported `/` SEO at 0.92 vs the 0.95 budget because the home page
  emitted no `<title>`; `buildMetadata()` now emits an absolute fallback title when no route
  title is provided.
- **Recent UI/effect scope:** gallery/mobile UI and Alternative Scroll refinements, plus a
  Pages editor fix so Gallery block grid changes update the live preview and support the newer
  grid types. Latest Pages editor work adds
  per-block hide/show toggles, skips hidden blocks in preview/public rendering, and removes
  Alternative Scroll and On-scroll 3D carousel from Pages gallery-block options. Alternative
  Scroll remains Gallery-tab only; the working On-scroll 3D carousel remains available through
  the Scroll showcase block style. Alternative Scroll gallery images were also enlarged
  slightly across desktop/tablet/mobile. The Codrops ScrollPanels reference was evaluated and
  placed as a new **Scroll panels** style on the existing Pages → Scroll showcase block, reusing
  its category selection/title controls; it is intentionally not a Gallery-tab grid type and not
  a Pages Gallery-block grid option. Scroll panels now has its own settings for Codrops demo
  variant, intro photo count, row photo count, photo tone, background color, and text color; the
  old “Images per panel” control remains only for the cinematic style. The Scroll panels variant
  picker intentionally exposes Classic, Scatter, Angled rows, and Perspective blur; the
  earlier Zoom/Brightness labels are hidden and old saved values are normalized to Demo 4. Scroll
  panels text is editable via Top label, Intro heading, Intro text, and Showcase heading, and the
  fixed intro columns should fade before the category rows enter so Classic columns do not bleed
  into the bottom of the showcase/list section. Perspective blur uses 4 intro columns; Angled rows
  should read as Codrops-style angled bands with staggered row/column travel, not a generic light
  sweep. Scatter, Perspective, and Angled rows keep the intro photos visible longer and fade them over
  the handoff so the page should not go blank before the showcase rows are meaningfully visible;
  Angled rows keeps the larger-photo Codrops-style rotated band look. Classic columns and Angled
  rows use a cover/reveal intro: the text panel stays above a fixed full-viewport photo grid
  with an opaque cover background, then scrolls away as the grid fades in and remains centered;
  the showcase/list section later rises over the grid while the grid fades away. The text block
  can be positioned left, middle, or right. Classic columns and Angled rows use larger intro
  typography than the other Scroll panels variants; Angled rows uses full-size intro images with
  a right/up viewport offset (currently biased farther right than center) so the visible grid keeps
  a larger-photo Codrops feel while balancing top/bottom breathing room.
  The Pages editor live preview uses a fixed simulated viewport for animation fidelity
  (desktop 1440x900, mobile 390x844) scaled into the preview pane; do not derive iframe height
  from pane scale for ScrollPanels because `vh`/`vw` then diverge from the opened page.
  To avoid reload flashes/overlap on restored scroll positions, the document starts with `html.no-js`
  and a head script flips it to `html.js` before body paint; desktop ScrollPanels intro grids stay
  hidden until GSAP adds `is-enhanced`. The enhanced `.sp-columns-panel` must use explicit viewport
  dimensions (`width:100vw`, `height:100svh`, `overflow:hidden`) instead of relying on `inset:0`
  with auto height; otherwise restored-scroll reloads can briefly let the tall angled grid content
  define the fixed panel's height (~full section height) before it settles back to the viewport.
  Global Lenis also syncs to `window.scrollY` immediately on mount so restored-scroll reloads start
  from the browser's actual scroll position rather than catching up after paint.
  Reduced motion is excluded with CSS media queries and also marks `is-reduced-motion` so the static
  fallback remains visible. For Scatter/Perspective, keep the showcase fade-out tween
  `immediateRender:false` or GSAP can briefly force the fixed grid visible over earlier heading/text
  blocks on reload.
  Scatter and Perspective
  intentionally keep the stronger editorial overlap. Scroll panels also has a Background setting:
  when custom background is off, background/text color pickers are hidden and the block inherits
  page background plus theme foreground color. The Titles setting must not substitute fallback
  copy like "View collection" when category names are hidden.
  Gallery-tab layouts now include `parallax-ring`, a separate optional layout inspired by the
  Creative Ocean CodePen "Parallax Photo Carousel" (`mdROBXx`): a draggable 3D cylindrical photo
  ring. Keep the panels curved around the ring, but keep each photo centered on its own panel
  (`background-position: 50% 50%`) rather than sliding image content like a stitched panorama; the
  user preferred the curved display without the cut/reversed image feel. The enhanced ring should
  use continuous angle-based opacity while dragging, not rank-based show/hide; the user specifically
  rejected visible-count drops and wants CodePen-like continuity. The target behavior is five strong
  front panels at all drag positions with softer edge panels fading in/out continuously. After
  testing, avoid opacity-based hiding entirely for the ring panels; let the 3D cylinder/backface
  geometry carry continuity. The Creative Ocean CodePen hardcodes 10 panels at 36 degrees on a
  500px radius. To support more than 10 gallery photos without changing the look, keep 10 physical
  visual slots with the same 36-degree spread/radius behavior and recycle photo data into the slot
  currently hidden at the back of the ring as it advances; do not globally shift every slot at once,
  because visible photos jump ahead. The viewer-angle math must match the actual card transform
  `rotateY(index * -step)`, so compute it as `rotation - index * step`; the opposite sign recycles
  an edge/front slot and causes visible jumping. Also base recycling on GSAP's rendered ring
  `rotationY`, not the future drag target stored in a ref, or photos swap before the card visually
  reaches the hidden back position. Do not add all photos as physical panels, because that changes
  the angles and gutter spacing.
  The transformed 3D buttons do not always win browser hit-testing, so tap/click open is
  resolved from the ring wrapper on pointer-up: if movement stays under the drag threshold, open the
  prominent photo closest to the pointer. For the CodePen-like parallax, keep the 3D panel transform
  on the button and put the actual image on a nested layer; shift that nested image layer with the
  panel angle so parallax does not rewrite the ring transform. Keep the visible gutter as fixed
  black masks above the photo, not by making the photo layer itself narrower; the image layer should
  extend underneath the masks so adjacent photos can feel like they share/overlap inside one gutter
  while the resting black gap stays the same size. Use fixed pixel gutters, not a percentage width or
  scaled image, so the black spacing reads consistently across panels and at the wrap edges. Split
  the intended gutter across neighboring cards so two adjacent photos read as sharing one black
  gutter instead of doubling the space; parallax travel should stay within that mask range. The
  parallax should be a shared total-drag-distance offset for all visible image layers,
  revealing image content into the gutter opposite the drag direction (drag/scroll left reveals into
  the right gutter) and easing back on release; keep
  this as numeric GSAP `xPercent + x`, not panel-angle offsets or CSS `calc()`, to avoid rough
  shifting between images. The reload entrance also lives on an inner float layer (`y` + `autoAlpha`
  stagger) for the same reason; sort those float layers by their measured visual left edge before
  staggering so reloads rise left-to-right instead of following the 3D ring's DOM order. To avoid
  refresh flashes, render both the static fallback and enhanced ring markup, then use `html.js`
  CSS to hide the fallback before first paint for normal-motion JS users while keeping the fallback
  visible for no-JS and `prefers-reduced-motion: reduce`. It does not
  replace the existing `carousel3d` layout and is
  intentionally scoped to Gallery-tab page configs for now, not Pages tab Gallery blocks.
  Gallery-tab layouts also include `gridType: "image-trail"`, inspired by Codrops
  ImageTrailEffects. It is its own Gallery-tab grid type, not a separate motion effect that can be
  layered onto arbitrary grids. It renders a reference-like full-stage layout with the gallery
  title/subtitle in the frame and a large outlined center title; reduced motion/no-JS falls back to
  a normal justified grid so the gallery remains usable. The selected gallery photos are the only
  image source for the trail. Settings live in `page_config.config`: `imgTrailVariant` supports the
  six Codrops-inspired variants (`fade-shrink`, `zoom-fade`, `drop`, `scatter`, `stretch-drop`,
  `full-frame`), plus `imgTrailUseBackground` and `imgTrailBackgroundColor`. If background is off,
  the stage inherits the site background/text color. It supports coarse-pointer mobile with smaller
  trail images and lower movement thresholds, and disables animation under `prefers-reduced-motion`.
  Demo 6/full-frame uses full-stage `<img>` layers with `object-contain`; keep only one layer visible
  at rest, then sweep the next selected gallery photo in, so photos scale proportionally without
  aggressive crop/zoom and the full-frame stack does not appear like every layer is active at once.
  When `imgTrailUseBackground` is false, Demo 6 must not paint photo-dominant backdrops behind the
  contained image; the stage and outlined title should inherit the active light/dark theme.
  Demos 1-5 intentionally use larger cursor-trail images (`clamp(9rem,38vw,16rem)` on base and
  `clamp(12rem,24vw,20rem)` from `sm`) than the original first pass so the trail reads clearly on
  desktop and mobile; Demo 6 remains separate full-frame contain sizing. The large overlay title
  should keep the Codrops reference palette per demo (`--color-title` + `--blendmode-title`):
  Demo 1 white/difference, Demo 2 dark gray/difference, Demo 3 purple/normal, Demo 4 pale
  pink/normal, Demo 5 dark teal-gray/normal, Demo 6 white/overlay. Keep the title out of parent
  `z-index` stacking contexts; otherwise `mix-blend-mode` blends against the text layer instead of
  the image trail layer. The stage background is a separate lower layer; the title and trail images
  sit in a transparent isolated layer so Demo 1's `difference` title stays white on plain background
  and only changes where it crosses trail photos. The old default `imgTrailBackgroundColor:
  "#efece5"` should be treated as "no custom background selected" so Demo 2-6 can use their own
  reference backgrounds.
  Live-preview iframes pass `__previewFrame=1`;
  middleware converts that to `x-preview-frame`, and the root `ThemeProvider` uses
  `storageKey="theme-preview-frame"` only inside those iframes so the public light/dark button in a
  preview cannot change the admin shell or normal public-site theme storage.
  Keep it scoped to Gallery-tab page configs for now; do not add it to Pages tab Gallery blocks
  unless the owner explicitly asks for a page-level decorative cursor/touch effect.
- **Finish Home migration:** `/admin/pages` seeds a DRAFT "Home" page reproducing the old
  homepage; the live home stays bespoke until the owner previews and **publishes** it.
- **Production secret:** set a dedicated `SETTINGS_ENCRYPTION_KEY` (`openssl rand -hex 32`).
- **GHCR packages:** the public image manifests for `photography-platform-web:latest` and
  `photography-platform-worker:latest` were readable without auth on 2026-06-26. If future pulls
  fail on the NAS, re-check package visibility or run `docker login ghcr.io`.
- **Payments:** still a stub — `PaymentProvider` interface + seams only; implement when desired.
- **Consider** switching `publish-images.yml` to `workflow_dispatch`/tags-only only if routine
  pushes become noisy; public-repo Actions minutes are no longer the main concern.
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

- **Keep deploy pushes intentional:** public-repo Actions minutes should be free, but each push to
  `main` still builds/publishes images and runs the full CI/Lighthouse stack.
- **Implement payments** when needed via the existing `PaymentProvider` stub (Stripe driver);
  the seams (`invoice`, `order` tables, checkout route) already exist.
- **Finish + publish the Home page** through the CMS so the homepage is fully data-driven.
- **When porting another reference animation**, follow `.claude/skills/gsap-scroll-animations`
  (fetch source → beat list → invert eases → match full transform state → verify visually) and
  delegate the smoke test to the `animation-visual-reviewer` agent. `carousel-3d-scroll.tsx` and
  `column-scroll.tsx` are working templates. The ScrollPanels port lives in the Scroll showcase
  block as `style: "scrollPanels"` and uses the app's existing Lenis/ScrollTrigger setup rather
  than creating its own Lenis instance.
- **OnScrollLayoutFormations port:** Pages tab → Scroll Showcase now has
  `style: "layoutFormations"` with four first-pass variants: `rise`, `columns`, `zoomed`, and
  `reveal`. It is category-driven like the other Scroll Showcase styles; each category becomes a
  pinned desktop formation section using its photos and name. Mobile intentionally uses simpler
  non-pinned reveal motion because the upstream Codrops demo has reported mobile layout-shift
  issues. Current tuning: `Photos per formation` now drives the rendered cell count for all
  variants at 6/9/12/18/24; rise grid, column assemble, and column reveal animate in a
  deterministic random order; column reveal has no gray hidden-cell backing; zoomed grid uses a
  smoother single timeline; column assemble has stronger row/column separation. Latest tuning:
  zoomed grid is intentionally locked to 9 photos, keeps the center photo centered, and renders
  oversized so the outer edges can crop; column reveal now has visible gutters between photos;
  rise grid now uses dense count-aware grids instead of sparse hand-placed slots; the former 17
  option was replaced with 18 so the selectable counts fill clean rectangular grids. The Layout
  Formations header was converted to a compact top overlay and Rise Grid no longer pins while
  offscreen; this removes the large black band between the style text and the grid in live
  preview while preserving a shorter rise motion. Follow-up spacing tuning reserves enough
  top padding for the first formation so the style text and grid no longer overlap; verified
  with a focused Chrome smoke at ~52px desktop gap and ~35px iPhone 13 gap. Layout
  Formations now also stores `layoutFormationsHeaderAlign` so the top text can be aligned
  left, center, or right; the header has slightly more before/after padding, with latest
  focused smoke showing ~39px desktop gap and ~31px iPhone 13 gap after the padding/alignment
  update. Follow-up tuning keeps Zoomed Grid pinned near the top (`top 5%`) but shortens its
  scrub range to ~0.58 viewport heights, so the motion starts promptly without holding a mostly
  empty gap. The special first-section Zoomed grid size override and center-photo scale were later
  removed: first and later category grids now use the same dimensions, and all nine Zoomed photos
  finish at the same size/scale. Rise Grid starts at `top 50%`, uses a ~0.62 viewport scroll range,
  and the image fly-in tween has `duration: 1.55`, so it reads slower while still completing by the
  end of the entrance range. Rise still starts hidden (`autoAlpha: 0`) and flies from roughly
  0.55-1.05 viewport heights, so it is not visible before animation and has a dramatic travel
  distance. The first-section spacing uses an explicit `lf-section--first` class rather than
  brittle `:first-of-type` CSS. Column Reveal now top-aligns the first grid with tighter
  non-overlapping text/grid spacing. Column Reveal is now intentionally **not pinned** on desktop:
  it uses a flowing section reveal (`top 76%` → `top 16%`) so the text and grid keep traveling
  together instead of the grid pausing while the page leaves a large empty band. Reveal-only layout
  is now compact and flow-based: the main header is relative, category titles sit above their grids
  in a small horizontal row, category titles no longer animate separately, and the grid-to-next-title
  rhythm is tight instead of viewport-panel sized. Column Assemble now uses a compact non-pinned
  flow rhythm, but intentionally keeps more category-name-to-grid and grid-to-grid breathing room
  than Column Reveal; its photos fly in straight vertically from below with a wider stagger instead
  of sideways/rotated.
  The shared Layout Formations intro/header now has extra top padding across all variants
  (`.lf-header` desktop and mobile) so the beginning text block breathes more before the effect.
  Zoomed Grid now adds only a modest first-grid downward offset for breathing room while preserving
  all three rows. Latest code checks for the compact Column Reveal update passed `typecheck`,
  `lint`, and unit tests; Docker web rebuilt healthy after restarting Docker Desktop. Latest focused
  Chrome smoke measured Column Reveal title-to-grid gaps at ~6px when titles are shown and ~0px
  when hidden; hidden titles render only the numeric index, and "Open collection" links are removed
  from Layout Formations entirely. Column Assemble has also been rechecked at 6/12/18/24 photos:
  those render as 1/2/3/4 rows and the grid is content-height, so the 1-row case keeps the
  portrait-card feel instead of stretching tall while 2/3/4-row grids keep the same photo size and
  grow vertically. Latest focused Chrome smoke at 1360px measured matching row/column photo gaps at
  ~40.8px, category-title-to-grid spacing at ~49.5px, grid-to-next-category visual spacing at
  ~144px, and stable photo cards at ~255px tall. Its photos still fly straight upward from below
  with staggered opacity/transform changes during scroll, with no console errors. Column Assemble
  now animates desktop rows independently using each row's layout position, not the transformed
  element position, so 3/4-row grids do not finish their lower-row fly-in before those rows enter
  view. Focused smoke measured 18/24-photo lower rows hidden before entry, ~50% opacity while
  entering, and fully visible only after entering.
  The newer Layout Formation variants (`tilted`, `depth`, and `sidePivot`) now use stable row
  layout positions for their ScrollTrigger start/end math instead of each animated row as its own
  trigger. Their row animations use a visible mid-scroll window (`rowTop - 1.3vh` to
  `rowTop - 0.58vh`) so the motion is still seen while entering; Side Pivot intentionally starts
  a little later (`rowTop - 1.16vh` to `rowTop - 0.42vh`). The first grid in these three variants
  has extra top spacing from the intro text, and the last section has extra bottom runway so all
  rows complete before the page bottom. Focused Chrome smoke covered desktop, iPhone 13, and
  reduced-motion contexts for all three variants, with visible desktop motion, final rows fully
  settled, and 0 console/page errors.
  Photo gutters were later tightened for Rise Grid, Column Assemble, Zoomed Grid, Tilted fly-in,
  3D Depth fly-in, and Side Pivot; Column Reveal spacing was intentionally left unchanged.
  Follow-up: Column Assemble gutters were tightened further, and Column Reveal now uses natural
  row height with explicit 18-photo (9x2) and 24-photo (8x3) desktop layouts to avoid large row
  gaps. Column Reveal also keeps the grid cells stationary during animation and slides the image
  contents inside each cell, preventing multi-row photos from overlapping while they reveal. Mobile
  Reveal overrides keep 18/24-photo grids at 4 columns on tablet and 3 columns on phones. Reveal
  counts 12/18/24 also have extra stage padding so category grids have more separation.
  Mobile Layout Formations use a non-pinned progressive animation keyed to the grid entering the
  viewport (`top 88%` to `top 48%`), so the fade/slide remains visible on phones even when a
  variant has a large intro/title area. Mobile live-preview frames use the full 390x844 phone
  viewport instead of clipping to the desktop preview height.
  Follow-up mobile tuning: Rise Grid, Column Assemble, and Zoomed Grid use a later mobile trigger
  window (`top 74%` to `top 34%`) so their motion is not finished before the photos are visible.
  Mobile Zoomed Grid no longer uses the desktop full-viewport pinned-stage layout; it flows like a
  normal mobile grid with extra section spacing. Column Assemble's first mobile text block has
  more top breathing room.
  Follow-up for mobile timing: Column Assemble, Zoomed Grid, Tilted Fly-in, 3D Depth Fly-in, and
  Side Pivot now start later (`top 62%` to `top 24%`) so the entrance is not mostly complete before
  the user reaches the photos. Tilted/Depth/Side Pivot also explicitly reset to natural mobile grid
  rows at tablet/phone widths to avoid inherited desktop row sizing that made rows overlap.
  Column Assemble's first mobile text block has additional top spacing.
  Follow-up mobile scrub tuning: those same variants now use a much wider linear mobile scrub
  window (`top 74%` to `top -42%`) with a longer slide distance so the entrance animation
  progresses more visibly while scrolling; Zoomed Grid also starts with a stronger scale/slide
  entrance. Column Assemble's first mobile section keeps a larger top offset but now overrides the
  text-to-grid gap tightly so the grid does not drift away from the title. Column Reveal mobile
  restored the count-aware dense layout behavior that 6/9-photo formations used before, instead
  of forcing every count into the same 3-column phone grid.
  Latest mobile spacing pass: Column Assemble and Column Reveal first mobile sections use larger
  top offsets but override the title-to-grid gap to a very small value, keeping the text lower
  without creating a large blank space before the first grid. Tilted Fly-in, 3D Depth Fly-in, and
  Side Pivot no longer animate the whole mobile grid as one unit; mobile groups photos by rendered
  row and gives each row its own scrub trigger so later rows animate when they enter view.
  Follow-up: Column Assemble now uses the same per-row mobile scrub so lower rows animate as they
  enter instead of being completed by the time the user reaches them. Tilted/Depth/Side Pivot have
  distinct mobile entrances again: Tilted uses alternating rotation, Depth uses scale + rotationX
  perspective, and Side Pivot uses an x-offset + rotationY side pivot. Column Assemble/Reveal
  mobile first sections got larger top offsets, with the title-to-grid gap collapsed to zero.
  Live-preview follow-up: Column Assemble/Reveal mobile spacing now also pulls the first grid up
  slightly with a negative mobile grid margin, because a measured 0px grid gap can still look
  visually roomy from the title line box. Mobile row animations use explicit from/to end states,
  smoothed scrub, and no per-photo row stagger to avoid endpoint snapping.
  Clarification follow-up: the visible "top text block" in the mobile live preview is the
  Layout Formations block header (`.lf-header`), not the first category title (`.lf-title`).
  Mobile Column Assemble/Reveal now add top space on `.lf-header` and remove the large first
  section spacer so the first grid sits much closer to the visible header text. Mobile row
  animations now finish faster (`top 84%` to `top 42%`, scrub `0.28`) for Tilted/Depth/Side Pivot,
  and the same stronger header spacing is applied to Tilted/Depth/Side Pivot so the mobile live
  preview shows a visible top-text spacing change across the new formation variants.
  Follow-up: the near-zero mobile title-to-grid gap made Column Assemble/Reveal category names
  visually collide with the grid during scroll. Mobile Column Assemble/Reveal now keep a real
  positive stage gap, remove the negative grid margin, and add a modest first-section spacer below
  the Layout Formations header before the first category grid.
  Follow-up spacing bump: mobile Column Assemble/Reveal first-section spacer was increased again
  (`columns` up to `clamp(5.5rem, 18vw, 7.75rem)`, `reveal` up to
  `clamp(5rem, 16vw, 7rem)`) because the live preview still needed more visible air between the
  Layout Formations header text block and the first category grid.
  Follow-up after reverting a broader spacing experiment: only the mobile first-section spacer
  between the Layout Formations text block and first grid was increased (`columns`
  `clamp(7rem, 23vw, 9.75rem)`, `reveal` `clamp(6.5rem, 21vw, 9rem)`); top-of-header spacing and
  category-title-to-grid spacing were intentionally left unchanged from the previous accepted state.
  Desktop spacing follow-up: Rise Grid, Tilted Fly-in, 3D Depth Fly-in, and Side Pivot now have
  more space above the Layout Formations header text and more spacing before the first grid. Rise
  uses a larger default first-stage spacer (`clamp(24rem, 46vh, 30rem)`) because its header is
  absolute; Tilted/Depth/Side Pivot use larger relative header
  padding and first-section stage padding. Mobile spacing rules are unchanged.
  Follow-up spacing bump: desktop Rise/Tilted/Depth/Side Pivot intro spacing was increased again
  (`rise` header `clamp(7.5rem, 15vh, 11rem)`, first stage `clamp(28rem, 54vh, 35rem)`;
  Tilted/Depth/Side Pivot header `clamp(6.5rem, 14vh, 10rem)`, first stage
  `clamp(9rem, 18vh, 13rem)`). Mobile Rise Grid now adds extra top padding between category
  sections (`.lf-section + .lf-section .lf-stage`) to increase spacing between grids.
  Scroll Panels Angled Rows mobile follow-up: demo4 column drift now uses a larger mobile-only
  step (`-36%` per visible column instead of the desktop `-15%`) so the intro photos move
  noticeably even when small screens show only a couple of columns.
  Scroll Panels Scatter mobile follow-up: scatter now uses stronger mobile-only column drift
  (`±18%` instead of desktop `±6%`) and a larger outward scatter spread (`720` instead of `440`)
  so the intro photos separate more clearly on small screens.
  Scroll Panels mobile fade follow-up: mobile enhanced intro grids no longer force
  `opacity:1!important`, so GSAP `autoAlpha` fades are visible on phones too. Top-stacked
  Classic/Angled intro grids now start fading in earlier on mobile (`top 82%`), while mobile
  Scatter/Perspective use a scrubbed root fade-in (`top 92%` to `top 20%`) instead of a late
  on/off reveal. Angled Rows uses stronger mobile drift (`-48%` step), Scatter Outward starts its
  outward movement earlier on mobile (`top 92%` to `top 34%`), and desktop Scatter is pulled
  slightly inward (`0.62` start scale, `380` spread) to reduce clipped intro-grid edges.
  Follow-up: mobile Scatter now starts even earlier (`top 98%` to `top 42%`). Mobile Perspective
  Blur now uses stronger mobile-only offsets/rotation/blur and a longer assembly range
  (`top 100%` to `top -35%`) so the effect stays visible on phones. Desktop Scatter now fetches enough
  photos for the selected intro count and uses count-specific column widths for 6/9/12/15/18 so
  the live preview visibly changes instead of always clipping to roughly the same six photos.
  Follow-up: desktop Scatter now also changes the real intro column count by selected count
  (3 columns for 6/9, 4 columns for 12, 5 columns for 15/18) so all selected photos can stay
  visible without shrinking the entire effect into the original three-column shape.
  Follow-up: desktop Scatter 18-photo mode now uses 6 real columns, and 9-photo mode uses a
  slightly smaller desktop column width so the bottom row is not cut off.
  Follow-up: desktop Scatter 18-photo mode photos were enlarged again (`min(12vw, 9rem)`) with
  tighter 18-only grid gaps so the 6-column grid remains visible without bottom clipping.
  Follow-up: desktop Scatter 18-photo mode was enlarged once more (`min(14vw, 10.5rem)`) and
  its 18-only horizontal/vertical gaps were tightened slightly to keep the selected 18 photos
  bigger while preserving the 6-column no-clipping target.
  Public-repo prep: `.env.example` now matches the documented local Docker target
  (`localhost:3001`), while CI explicitly rewrites the copied env back to `localhost:3000`
  for GitHub Actions. Current-state docs were also cleaned up to describe SeaweedFS/S3 as
  the default storage path instead of stale MinIO wording.
  Page editor mobile follow-up: the admin page editor now forces `min-w-0` through the
  page-settings/editor shell, cards, reusable form fields, block rows, and live-preview toolbar.
  Header/action rows wrap on narrow screens so Page settings in the Pages tab should no longer
  be visually cut off on the right side in mobile use.
  Follow-up: the Page settings card in the Pages tab is now collapsible, open by default, with
  a clickable header and chevron state indicator.
  Layout Formations follow-up: Scroll Showcase blocks now store `layoutFormationsHeading`,
  exposed in the Pages tab as "Top heading", so the top text no longer has to say
  "Layout formations". Existing blocks default to the old text.
  Scroll Showcase editor follow-up: the Pages tab block settings are now grouped by style
  instead of one long mixed grid. Common style/category controls are separated from
  Scroll Panels text/layout/colors, Layout Formations top text/layout, and Cinematic/3D panel content.
  Design tab follow-up: each Design surface card (Home, Category, Location, About, Global) and
  the Footer design card are now collapsible and closed by default, so the layout controls are easier
  to scan without changing the underlying config contract.
  Login design follow-up: Design now has a collapsed-by-default Login card stored in
  `page_config.config.login` on the default global config. It is visual-only: layout (`simple`,
  21st.dev-inspired `gradient-card`, or `split-photo`), headline/subtitle, background
  mode/colors, accent, cursor-following hover color wash with size/intensity controls,
  side photo URL/library photo, photo side/alt text, desktop photo width, mobile photo visibility,
  and photo crop/focal point,
  site-name/icon-row toggles, and button labels. `/login` is now a server wrapper that loads
  site settings + login design and passes them into the client auth component; password, passkey,
  biometric, TOTP, and Turnstile behavior remain unchanged. A selected library login photo is
  served through `/api/v1/media/login-photo`, scoped only to the configured login photo.
  Settings tab follow-up: General, Branding, Email, and Integrations are now collapsible sections.
  They default open on desktop and closed on mobile to reduce narrow-screen scrolling.
  Pages editor follow-up: Contact form is now a real page-builder block option. It reuses the
  existing spam-protected contact submission flow and supports stacked, split, card, and minimal
  presentation styles with editable intro/heading/button text. Follow-up: the ToraMochie
  Contact Us reference is implemented as the `tora-contact` Contact Form style. It keeps the
  same contact inbox API, hides the subject field with a heading-derived fallback subject, and
  renders a full-width Reflector-style form section: Josefin Sans, uppercase heading, 1110px
  rail, paired desktop inputs, single-column mobile fields, dark/light theme variables,
  gold-accent underline borders, and a centered uppercase submit button. The footer top margin
  is removed after pages containing this section, including sticky footers, and the builder
  wrapper bottom padding is suppressed so it does not leave a horizontal black spacer bar below
  the form.
  Pages editor follow-up: Location Map is now a page-builder block that renders published
  locations with saved latitude/longitude pins, OpenFreeMap/MapLibre basemaps, map marker labels,
  rich cover-photo popups, directions/open-location actions, desktop popups, and mobile bottom
  sheet details. The Taxonomy > Locations editor exposes optional latitude/longitude fields.
  Follow-up: Location Map blocks now support custom one-off pins stored directly in the page block
  config. Each custom pin can set title/subtitle, latitude/longitude, optional cover photo,
  optional link label/URL, and can be reordered alongside taxonomy location pins.
  Follow-up: Location Map hover popups now stay open while the cursor moves from marker to popup
  content, and popup cover photos are clickable when the pin has a link.
  Follow-up: Location Map blocks now also support a 21st.dev/Aceternity-style "Dotted network"
  display mode. It uses `dotted-map` to render a static world-dot SVG with animated connection
  arcs, ordered/hub/manual connection modes, editable line/pin/map-dot colors, animation speed,
  and optional city labels. The mode reuses taxonomy locations plus custom lat/lng pins and keeps
  a reduced-motion fallback with static arcs/pulses.
  Follow-up: Location Map blocks now also support a mapcn/21st.dev-style "Route planning" display
  mode. It reuses the same taxonomy/custom lat/lng pins, renders MapLibre route layers, supports
  route-planning vs basic numbered-stop route styles, optional OSRM driving alternatives with an
  estimated-path fallback, start/end selectors, ordered route-stop overrides, route option cards,
  label/control toggles, and editable active/inactive/start/end colors. `middleware.ts` allows
  `https://router.project-osrm.org` in `connect-src`; keep this scoped if routing providers change.
  Follow-up: Location Map block settings now show Map Appearance before Map Content. Route Planning
  uses `routePointIds` as optional stops between start/end, passes all stops to OSRM, and route
  markers reuse the interactive map detail popup on desktop hover plus a mobile bottom sheet on tap.
  Follow-up: Route Planning markers now show numeric order directly inside every map dot, including
  start/end/stops, so users can tell first/second/third at a glance.
  Follow-up: Route Planning now has public route polish controls: numbered stop list, Google/Apple
  route links, driving/walking/cycling modes, summary position/style controls, and mobile stop cards
  that pan to a stop and open its detail sheet.
  Follow-up: Route Planning visible route lines render as native MapLibre line layers with a
  separate invisible wide hit layer for clicks/hovers. Long OSRM routes are capped at 360 display
  points while preserving stop anchors. Avoid SVG/canvas route overlays here; they lag during map
  pan/zoom because they reproject the route outside the map renderer. Route layers retry until the
  style layer stack is ready and insert before the first symbol layer so they render above the
  basemap but below labels.
  Follow-up audit: Contact form blocks now have focused unit coverage for parser/default behavior
  and contact page presets. Folders are merged into the Library tab as a Folders view, and the
  separate Folders sidebar item is removed.
  Library/Folders follow-up: photo tiles in Library are draggable; dragging one selected photo
  carries the whole selection, and the Photos view includes a folder/subfolder drop panel. The
  Folders view also accepts dropped photos and supports dragging folders to reorder them beside
  the target folder within the target's parent group.
  Follow-up: Library photo click now opens a right-side detail panel, press-and-hold enters
  multi-select mode, and shift-click range-selects photos in between. Mobile Library uses a
  right-side virtual-folder drawer with a visible handle and auto-opens near right-edge drag.
  Follow-up: the Library photo detail panel now closes from the full outside-click area, and
  normal photo tiles hide the selection badge and info action until multi-select is active.
  Follow-up: the Library photo drag-count badge now uses an in-viewport, laid-out drag image
  before `setDragImage`, so browsers can show "1 photo" / "N photos" beside the cursor.
  Follow-up: mobile Library no longer relies on native drag-and-drop for organizing photos;
  selected photos now have an "Add to folder..." action that opens a folder picker, while
  desktop pointer devices keep drag-to-folder.
  Follow-up: mobile Library now uses an explicit Select/Done flow instead of long-press to
  enter multi-select, and the selected-photo bar is compacted to Folder/More/Done so secondary
  actions live in a modal instead of crowding the phone screen.
  Follow-up: Gallery edit sections are now collapsible too: Settings, Layout, Photos,
  Share links, and Slideshow video all keep header actions visible while their bodies collapse.
  Follow-up: Gallery image-trail layout no longer renders a normal photo grid below the trail
  stage; mobile uses a fixed, touch-action-none stage so touch movement drives the trail instead
  of scrolling the page, with only an in-stage fallback before enhancement/reduced motion.
  Follow-up: Gallery Alternative scroll keeps desktop wheel speed unchanged but uses a smaller
  touch delta scale on coarse-pointer devices, making the column motion faster on mobile swipes.
  Follow-up: Gallery Parallax 3D ring now uses a tighter mobile radius so image gutters read
  closer to desktop spacing, and mobile swipes rotate the ring faster with horizontal gesture control.
  Follow-up: Pages Scroll Showcase cinematic wipe keeps desktop scroll timing unchanged but uses
  a shorter mobile ScrollTrigger distance and less scrub smoothing so phone swipes advance faster.
  Follow-up: the Folders tree drag/drop now supports dragging a folder onto the middle of
  another folder row to make it a subfolder; top/bottom row edges still reorder beside the target.
  Image pipeline audit confirmed uploads preserve originals for client downloads while web display
  uses generated WebP responsive variants plus a single JPEG fallback; outdated AVIF UI wording was removed.
  Scroll Panels Classic Columns mobile follow-up: classic now uses stronger mobile-only column
  drift (`±18%` instead of desktop `±3%`) plus a larger mobile image scale (`1.22` instead of
  `1.08`) so the intro photo movement is more visible on small screens without changing desktop.
  Scroll Panels Perspective Blur mobile follow-up: perspective assembly now starts earlier on
  mobile (`top 85%` to `top 10%` instead of waiting for `top top`) and the mobile intro grid uses
  nearly the full viewport width with tighter gaps/padding so the photos appear larger and reduce
  empty space on the left/right. The mobile perspective panel also no longer starts from the
  desktop `0.7` panel scale, which was the actual cause of the side gaps during the intro.
  Pages Scroll Showcase 3D carousel mobile follow-up: desktop keeps the original ±90° scrubbed
  ring sweep, while mobile/coarse-pointer viewports now use a symmetric ±180° sweep so each scene
  completes one full ring rotation as it scrolls through the viewport and still lands front-facing
  at the centered handoff point.
  Scroll Panels Scatter mobile follow-up: phone widths now explicitly keep the scatter intro grid
  at 3 columns instead of inheriting the generic 2-column phone rule, and the scatter-out photo
  motion starts just earlier in the mobile scroll window (`top 104%` to `top 46%`).
  Latest follow-up: Scatter Outward mobile no longer hides columns 4-6, so 12/15/18 intro counts
  render all selected photos; scatter mobile grids now use tighter side padding/gaps, and 6-photo
  scatter uses 2 columns for larger images. Mobile Scatter also now starts at full panel scale
  instead of `0.7`, so the intro grid uses the available phone width before the outward motion.
  Follow-up: mobile Scatter 12/15/18 now use real 4/5/6-column templates instead of wrapping
  columns into a second row, preventing bottom clipping and keeping the intro photos together;
  desktop Scatter 12 uses a smaller/tighter 4-column grid to avoid bottom clipping. Mobile
  Scatter also gets a small top buffer so the first row does not crowd under the mobile header.
  Latest follow-up: mobile Scatter 15/18 were changed back to 4-column grids per owner
  preference at both the CSS grid and data distribution levels, while desktop Scatter 12 was
  enlarged again with tighter inter-column gaps.
  Scatter spacing follow-up: desktop Scatter intro columns now use the same computed gutter as
  the photo gaps inside each column for 6/9/15/18, and mobile category grids remove the staggered
  even-photo drop so row spacing matches the grid's photo gap.
  Latest Scatter follow-up: desktop 9 uses a smaller column width to avoid bottom clipping, desktop
  15 uses larger columns with tighter equal gutters, and mobile Scatter visually orders the intro
  text before the intro photo grid so the copy sits on top on phones.
  Latest Scatter follow-up: mobile scatter-out motion starts later in the scroll window
  (`top 92%` to `top 34%`), and desktop Scatter 21/24 use 7/8 real columns with smaller
  count-specific widths/gutters so the bottom row is not clipped.
  Latest Scroll Panels follow-up: Classic desktop column drift is disabled so intro-photo
  rows stay aligned across every intro count, and Scatter desktop 21/24 cards are enlarged
  while keeping the full intro grid visible.
  Latest Scatter follow-up: desktop Scatter Outward uses a much larger outward spread
  (`820` vs the old `380`) across every intro photo count; mobile spread stays unchanged.
  Latest Scroll Panels follow-up: Angled Rows desktop 21/24 now have count-specific
  transforms to balance the top-right and bottom-left empty space, and Perspective Blur
  desktop counts 6/9/12/15/18/21/24 use larger count-aware cards with tighter gutters.
  Latest Scroll Panels follow-up: Angled Rows desktop 24 was shifted up/right with a
  slightly smaller scale to restore bottom-left breathing room, and Perspective Blur
  desktop cards were enlarged another step across every intro count.
  Latest Scroll Panels follow-up: Angled Rows desktop 24 got a stronger up/right shift
  and smaller scale for visibly more bottom-left space; Perspective Blur desktop grids now
  shift upward while using larger cards so bottom clipping stays avoidable.
  Latest Banner follow-up: desktop overlay layouts now explicitly position their
  content within the container (bottom-left shifted right, bottom-right pinned right,
  center truly centered), and split-image-right pins text to the image-side edge.
  Banner follow-up: the Banner block now has a "Prisma hero" layout based on the
  21st.dev Prisma Hero reference. It uses the existing banner headline/subhead/CTA
  and photo source fields, plus optional `prismaVideoUrl` and asterisk visibility.
  The public renderer branches before
  normal overlay/split banners to show a rounded cinematic media frame with optional
  autoplay muted video, photo fallback, noise/gradient overlays, oversized bottom
  headline, stacked subhead/CTA below the headline, CSS load-in motion, and a
  reduced-motion static fallback. CSP `media-src` allows HTTPS media for this
  admin-provided video URL. No Framer Motion dependency was added.
  Follow-up: Prisma Hero also uses the banner `overlay` field as "Background
  overlay" with soft darken, none, and strong darken options; `none` removes the
  noise and gradient overlay layers so the background image/video is not darkened.
  Banner follow-up: the Banner block also has an "Agency viral hero" layout based on
  21st.dev/rahil1202's AgencyViralHero reference, intentionally omitting the floating
  glass nav. It stores `agencyVideoUrl` and `agencyAccentText`, reuses the banner
  headline/subhead/CTA/photo fallback/focal/zoom fields, and renders a full-screen
  video/photo hero with centered two-line heading, italic serif accent line, subhead,
  white pill CTA with play icon, CSS entrance motion, and reduced-motion fallback.
  Follow-up: Agency Viral uses the existing banner `overlay` field as a dedicated
  "Background overlay" setting with soft darken, none, and strong darken options;
  `none` removes both the full-screen dark scrim and the vignette layer so the
  background image/video is not darkened.
  Scroll Panels Classic Columns follow-up: classic now has count-aware intro distribution
  (desktop 6/9/12/15/18/21/24 -> 3/3/4/5/6/7/8 columns; mobile 9/12/15/18/21/24 -> 3/3/4/4/5/5 columns) plus
  equal horizontal/vertical desktop gutters, tighter gaps, and count-specific card widths so
  selected intro counts are not limited to the first six visible photos or clipped on the bottom row.
  Latest tweak: desktop Classic gutters were tightened again while preserving equal horizontal and
  vertical values, and mobile 12 keeps the 3-column layout while using the same card ratio as the
  other Classic intro counts.
  Scroll Panels Angled Rows follow-up: the demo4 intro grid is shifted further right on desktop
  (`translateX` from `21vw` to `25vw`, then to `38vw`, then balanced back to `52vw`) and mobile
  (`translateX(8vw)`, then `18vw`, then `translate(31vw, -12vh)`, before rotate/scale);
  the latest desktop correction moves the grid up to `-70vh` so the diagonal band fills the
  top-right area while keeping the bottom-left and top-right empty spaces closer. Mobile Angled Rows
  now keeps 3 visible columns even below 480px and uses a faster `-150%` column-drift step across
  the same scroll duration, so the columns travel farther without shortening the section. Follow-up:
  mobile Angled Rows scales the intro grid up to `1.32`; latest mobile offset is
  `translate(21vw, -7vh)` so the bottom-left and top-right empty spaces around the enlarged grid
  are closer, with a slight bias toward more top-right breathing room. Laptop-width Angled Rows
  now has its own `769px-1440px` placement (`translate(49vw, -66vh)`) to reduce bottom-left
  empty space while opening the top-right slightly. Classic/Angled Rows fixed intro grids are
  guarded by an `is-panel-active` class so they stay hidden until their own Scroll Showcase section
  is active and cannot overlap blocks above the showcase. Desktop Angled Rows drift was nudged from
  `-15%` to `-22%` per column step so desktop columns move a little faster while mobile remains
  at `-150%`. Latest follow-up: desktop Angled Rows keeps the 18-photo placement unchanged, while
  15/12/9/6 get count-specific down-left placement and smaller scale so the top-right corner has
  breathing room; mobile 6-photo Angled Rows uses 2 columns for larger photos.
  Scroll Panels Perspective Blur desktop follow-up: the desktop intro grid now uses much smaller
  perspective cards/gaps inside the fixed viewport panel and a reduced desktop setup spread
  (`125` instead of `340`) so high intro counts no longer push the lower rows half outside the
  clipped viewport. Follow-up: Perspective Blur now uses 6 real intro columns on desktop when
  the selected intro photo count is 18, while mobile keeps the existing 4-column distribution.
  Follow-up: desktop 18-photo Perspective Blur cards were enlarged with a count-specific
  `min(16vw, 13.5rem)` fixed flex basis, tighter 18-only gutters, and a wider `min(99vw, 84rem)`
  row so the six desktop columns do not shrink back down. Follow-up: the 18-photo desktop grid
  also removes the even-column vertical drop and tightens row gaps so the enlarged lower-row photos
  do not clip at the bottom; Perspective Blur keeps the safer desktop setup spread while increasing
  desktop rotation and blur so the blur-to-clear finish reads more strongly. Mobile perspective
  sizing/spread remains unchanged. Latest follow-up: desktop Perspective Blur now uses
  count-specific column layouts/sizing (6→3 columns, 9→3, 12→4, 15→5, 18→6) with larger cards
  and tighter safe padding so 6/9/12/15 better use the fixed viewport without clipping the lower row.
  The capped Perspective grid box is explicitly centered with auto inline margins so the actual
  public page matches the live preview instead of sitting left on wider desktop viewports.
  Mobile follow-up: Perspective Blur intro counts 6 and 9 now use 3 real columns on phone-sized
  viewports with tighter horizontal padding/gaps, so those smaller counts render larger instead
  of inheriting the 4-column mobile layout.
  Latest follow-up: desktop Perspective Blur intro counts 21 and 24 were widened again with
  tighter gutters, reduced side padding, a count-aware intro scale, and safer high-count vertical
  offsets so the grids fill the viewport more edge-to-edge without clipping. Mobile Scroll Panels now explicitly orders intro
  text above the intro grid across variants. Page editor category pickers show each category's
  photo count, and the desktop banner bottom-right overlay was nudged left.
  Scatter Outward follow-up: desktop intro counts 21 and 24 now use larger high-count cards,
  reduced panel side padding, tighter high-count gutters, and a count-aware desktop intro
  scale so those grids read more edge-to-edge while retaining the no-clipping constraint.
  New Scroll Showcase style: `scrollLayouts` ports Codrops ScrollBasedLayoutAnimations as a
  GSAP Flip + ScrollTrigger FLIP morph family. Variants implemented: Row focus, Breakout grid,
  Long grid, Dark stack, Glass stack, Scale stack, Tiny grid, Bento spread, and Single image
  reveal. The editor exposes variant-aware photo counts, optional caption, and background/text
  colors. It keeps the app's global Lenis rather than Codrops' local Lenis. Focused Chrome smoke
  covered all 9 desktop variants plus mobile Bento and reduced-motion Row with 0 console errors.
  Follow-up: Scroll layout morphs now has editable intro heading/supporting text in the page
  editor, and Row focus/Breakout grid use larger category-name headings above the animated layout.
  Follow-up: Row focus and Breakout grid now hide the separate category heading outside the grid;
  their in-grid caption/category text is the larger display element instead.
  Follow-up: Row focus centers the in-grid category caption in the middle of the animated grid
  once the layout morph reaches its switched state.
  Follow-up: Scroll layout morphs mobile is tuned across all nine variants: phone-specific FLIP
  durations, centered mobile pinning, gentler image-inner scaling, corrected Long Grid column
  geometry, tighter stack/bento/tiny layouts, and a less over-zoomed Single Image Reveal.
  Follow-up: Dark Stack, Glass Stack, and Scale Stack now use an in-grid structured caption:
  a larger category-name headline plus the category description underneath, with the outside
  duplicate category heading hidden for those stack variants.
  Follow-up: On mobile only, the three stack variants enlarge the cover photo after the stack
  finishes forming and shift the in-grid category name/description further left.
  Follow-up: The same mobile stack end-state now makes the cover photo larger again and offsets
  it lower so the final stack uses more of the vertical phone viewport.
  Follow-up: The mobile stack cover end-state was strengthened again: cover is now 70vw x 96vw,
  shifted right to center horizontally and lowered to land near the phone viewport center.
  Follow-up: Mobile Dark Stack, Glass Stack, and Scale Stack now split the morph into two beats:
  the grid first forms the stack, then the finished stack lifts upward together. The rear cards
  share the cover's mobile destination/offsets so they travel with the cover, while the cover
  clears the in-grid category name/description instead of covering it. Focused Chrome smoke
  covered all three mobile stack variants plus desktop and reduced-motion fallback with 0 console
  errors and no horizontal overflow.
  Follow-up: The mobile stack lift was reduced from `-36svh` to `-31svh`, tightening the final
  cover-to-caption gap to roughly 41-43px across Dark/Glass/Scale Stack while keeping no overlap.
  Follow-up: The mobile stack late beat now gives the caption a small synchronized lift while the
  cover/cards do the larger lift. This prevents the cover from drifting far away from the category
  name/description before the caption begins moving; focused mobile smoke measured the later
  cover-to-caption gap stabilizing around 86-90px across all three stack variants with 0 console
  errors.
  Follow-up: The mobile stack handoff was smoothed by removing overlapping transform tweens:
  the FLIP stack morph now finishes first, then cover/cards (`-29svh`) and caption (`-14svh`)
  lift together from timeline `0.72`. Focused mobile smoke confirmed monotonic cover/caption
  movement across Dark/Glass/Scale Stack with 0 console errors.
  Follow-up: Mobile Dark/Glass/Scale Stack now use a shorter ScrollTrigger range (`+=125%`
  instead of the default mobile `+=175%`), so the same stack-and-lift animation completes with
  less phone scrolling while desktop remains unchanged.
  Follow-up: Mobile stack end-state cover/card lift was reduced from `-29svh` to `-26svh`,
  tightening the final cover-to-caption gap to about 10px while keeping the same smooth single
  handoff and faster mobile scroll range.
  Follow-up: Mobile stack end-state cover/card lift was reduced again from `-26svh` to
  `-25.25svh`, halving the finished cover-to-caption gap to about 5px across Dark/Glass/Scale
  Stack without overlap in focused iPhone 13 Chrome smoke.
  Follow-up: The actual mobile stack card-to-card separation was then corrected by halving the
  mobile `--sbl-offset` from `0.72rem` to `0.36rem`; focused iPhone 13 Chrome smoke measured
  finished stack card offsets around 5-8px across Dark/Glass/Scale Stack with 0 console errors.
  Follow-up: The visible mobile stack end placement was corrected by moving the finished
  photo-and-caption pair down together (`items -15.75svh`, caption `-4.5svh`). This keeps the
  cover image substantially visible at the end of the animation while preserving a tight ~5px
  cover-to-caption gap across Dark/Glass/Scale Stack in focused iPhone 13 Chrome smoke.
  Follow-up: The mobile stack end handoff was retuned so the caption no longer feels pinned
  while the cover card lifts away. Mobile caption base is lower (`bottom: 8%`) and its end
  lift is larger (`-15.5svh`), so the category name/description travels with the cover during
  the end beat. Focused iPhone 13 Chrome smoke measured the visible title nearly flush with
  the cover edge across Dark/Glass/Scale Stack with 0 console errors.
  Follow-up: The mobile stack caption was tucked closer again by increasing the end caption
  lift from `-15.5svh` to `-17.5svh`; focused iPhone 13 Chrome smoke measured the title about
  16px into the cover edge across Dark/Glass/Scale Stack with 0 console errors.
  Follow-up: The mobile stack caption was tucked closer once more by increasing the end caption
  lift to `-19.5svh`; focused iPhone 13 Chrome smoke measured the title about 29px into the
  cover edge across Dark/Glass/Scale Stack with 0 console errors.
  Gallery-tab follow-up: `rotating-scroll` ports Codrops RotatingOnScrollAnimations as a gallery
  grid type, scoped only to the Gallery tab/public gallery renderer. It supports demo variants
  `demo1`-`demo5`, selected-gallery photos, editable marquee text, and optional background color.
  The renderer lives in `components/gallery/rotating-scroll.tsx` and intentionally reuses the
  app's global Lenis/ScrollTrigger setup rather than Codrops' local Lenis. It includes SSR and
  reduced-motion fallback via the existing justified grid/lightbox path. Focused Chrome smoke
  covered all five desktop demo variants plus iPhone 13 and reduced-motion fallback with 10
  rendered cards and 0 page/console errors.
  Gallery-tab follow-up: `diagonal-slideshow` ports Codrops DiagonalSlideshow as a Gallery-only
  grid type. It uses selected gallery photos, per-photo headline/subhead/caption text, diagonal
  previous/current/next slide positions, reference-style diagonal arrow buttons, desktop hover
  tilt, randomized title/side-text reveal, and click-to-open detail preview. Settings expose
  background/text/deco colors, side text, side text visibility, and detail preview visibility.
  Mobile uses smaller diagonal geometry with no hover tilt; reduced motion falls back to the
  existing justified grid. Focused Chrome smoke covered desktop navigation/detail open-close,
  iPhone 13 rendering, reduced-motion fallback, and 0 page/console errors.
  Gallery-tab follow-up: `depth-gallery` ports the Houmahani/Codrops DepthGallery reference as
  a Gallery-only grid type. It uses selected gallery photos as WebGL depth planes, scroll-driven
  camera movement, per-photo mood colors from `dominantColor`, Codrops-style color-chip/metadata
  labels, optional trail/particles, editable fallback background, label style, and scroll speed.
  Intentional deviation: the reference uses a raw Three.js engine and custom GLSL background;
  this app uses React Three Fiber plus CSS mood blobs to fit SSR/reduced-motion requirements.
  Reduced motion/WebGL-gated fallback renders the existing justified grid.
  Gallery/Page follow-up: `css-glitch` adds the Codrops CSSGlitchEffect source in two scoped
  places: Banner block effects `css-glitch-1`/`css-glitch-2` for the full-hero demos, and a
  Gallery-only `css-glitch` grid type for the six hover-card styles. The shared layer renderer
  is `components/gallery/css-glitch.tsx`; the gallery grid is
  `components/gallery/glitch-hover-grid.tsx`. Mobile uses touch-friendly continuous card
  animation, and reduced motion keeps only the base image layer.
  Gallery-tab follow-up: `palmer-draggable` ports the Palmer Draggable Grid reference as a
  Gallery-only immersive grid type. It uses selected gallery photos repeated into a large
  draggable x/y field, random intro reveal, whole-field scale-up, wheel panning, viewport
  fade/scale, right-side detail drawer, and a Flip-style cloned image transition into the
  detail panel. Settings expose density, photo size, detail panel toggle, background color,
  and text color. Mobile keeps the interaction inside a fixed 100dvh touch-drag stage;
  reduced motion renders a static responsive grid.
  Follow-up: The Palmer detail drawer handoff now keeps the drawer thumbnail target fully
  transparent until the flying clone lands, avoiding both duplicate imagery and the darker
  placeholder square. Public pages that contain the Palmer grid also remove the default
  footer top margin to reduce the footer area directly below the immersive grid.
  Follow-up: Palmer pages now collapse the public footer to a compact copyright strip only,
  and the right detail drawer title uses a slightly looser visible line box so descenders are
  no longer clipped at the bottom of the photo name.
  Follow-up: Palmer open/close now matches the reference container choreography more closely:
  when a photo opens, the draggable image field shifts left by `50vw` over the same 1.2s
  `power3.inOut` beat as the right drawer; on close it restores the exact pre-open drag
  position after the reference-style 0.3s delay.
  Follow-up: The Palmer detail transition now hides the clicked source tile while the clone
  flies into the drawer, then creates a reverse clone on close that flies back to that tile
  while the grid returns. The source tile is revealed only after the return flight completes,
  matching the reference's "same product moves out and back" feel without moving React-owned
  DOM nodes between parents.
  Follow-up: Palmer now supports dark mode by default. Its normal palette is theme-aware
  (`.dark` uses a dark stage/drawer and light text), while a new Gallery-tab "Use custom
  colors" toggle preserves exact background/text colors when desired. Older configs with
  non-default Palmer colors are inferred as custom; default light colors are treated as
  theme-following.
  Page Gallery follow-up: Gallery blocks now support a 21st.dev/PaceUI-style Flip Reveal
  filter treatment. `filterMode` can be `none`, `category`, `location`, or `custom`; category
  and location tabs are derived from published memberships for the loaded photo set, while
  custom tabs store their own labels and selected photo IDs. The shared helper lives in
  `components/ui/flip-reveal.tsx`; the public block renderer uses
  `components/gallery/flip-reveal-gallery.tsx` with reference-style pill tabs, image overlays,
  GSAP Flip enter/leave motion, and reduced-motion visibility fallback. Focused Chrome smoke
  covered a temporary public page on desktop, iPhone 13, and reduced-motion with 0 console/page
  errors and correct All/People/Events visible counts.
  Follow-up: Flip Reveal page-gallery filters now have sorting. Each block has a default sort
  (`source`, newest/oldest by capture date, title A-Z/Z-A, or custom manual order), category
  and location filter modes can add per-tab sort overrides, and custom tabs expose their own
  per-tab sort selector. Manual order is edited with selected-photo thumbnail rows plus
  up/down/remove controls so it works on desktop and mobile. The Flip helper now mutates CSS
  `order` inside the GSAP Flip state transition, so sort changes animate with the same reveal
  motion. Focused Chrome smoke verified reversed custom All order and per-People custom order
  on desktop, iPhone 13, and reduced-motion with 0 console/page errors.
  Follow-up: Flip Reveal page-gallery filters now include an "Image overlay text" toggle for
  category, location, and custom filter modes. `showOverlayText` defaults to true for existing
  blocks; disabling it removes both the per-card title/subtitle overlay and its gradient scrim
  so the cards render as clean photos. Focused Chrome smoke verified no visible overlay title
  nodes on desktop, iPhone 13, and reduced-motion with 0 console/page errors.
  Admin mobile follow-up: The Categories & Locations taxonomy tab no longer keeps each row's
  status/reorder/manage/edit/delete controls in a single non-wrapping strip. Taxonomy cards and
  rows are `min-w-0`, headers stack on phones, the create button becomes full-width on mobile,
  and row actions wrap below the category/location name so the admin shell's overflow clipping
  does not cut off the right side. Follow-up: the Published/Hidden badge now sits inline with
  the category/location name instead of in the action row, keeping the controls tighter on
  narrow mobile screens. Desktop follow-up: the name/slug area is `sm:flex-1` while the action
  group is `sm:shrink-0`, so long category/location names truncate cleanly without squeezing
  the desktop controls into an awkward layout.
  Page block follow-up: Pages now have a `testimonials` block for a 21st.dev-inspired
  testimonial slider. The block stores a side label, autoplay/thumbnail toggles, and an
  ordered `items` array (`name`, `affiliation`, `quote`, optional `photoId`) directly in page
  JSON. `collectPhotoIds` preloads selected portrait photos, and
  `components/blocks/testimonial-slider-block.tsx` renders the reference-style desktop layout:
  counter + vertical label rail, portrait, quote/name/company, thumbnail rail, and circular
  previous/next controls with reduced-motion-safe CSS transitions.
  Follow-up: Testimonials now also has a `portrait-grid` layout based on
  21st.dev/ravikatiyar's Testimonials reference. The same block stores
  `title`, `subtitle`, `gridPanel`, and `gridColumns` (2 or 3 desktop columns);
  the renderer shows a centered title/subtitle and a responsive portrait-card grid with a
  count-aware rounded panel width so the 2-column version form-fits its cards, plus image
  gradient overlays, lucide quote icon, quote/name/affiliation text inside each
  card, CSS stagger-in motion, and a reduced-motion static fallback. Latest tweak:
  portrait-grid card gutters are slightly larger while the rounded showcase panel
  uses tighter left/right padding so 2-column cards sit 20px from the panel edges
  on desktop.
  Follow-up: Testimonials now has a third layout, `retro-carousel`, based on
  `21st.dev/@ishamsu/components/retro-testimonial`. It reuses the same testimonial
  items but renders a vintage paper-card carousel with grayscale circular portraits,
  large centered quote text, italic lowercase name/affiliation treatment, bottom-right
  circular previous/next controls, optional auto-roll, light/dark colors, responsive
  single-card mobile behavior, and reduced-motion-safe CSS animation.
  Latest tweak: the retro cards now self-host the same Unsplash paper/stain texture used
  by the reference demo (`public/textures/retro-testimonial-paper.webp`) and layer it over
  the cream card at low opacity, with the earlier CSS stains retained only as subtle theme
  blending. This is necessary because the reference uses a real background image, not pure
  CSS gradients. The retro portrait ring was then reduced to 2px while keeping the
  reference source color (`rgba(59,59,59,0.6)`) instead of whitening it; dark mode uses
  a softened warm equivalent.
  Follow-up: Testimonials now also has a `glass-stack` layout based on
  `21st.dev/@vaib215/components/testimonial-cards`. It reuses the same testimonial
  items and renders a dark glassmorphism card stack with front/middle/back depth,
  rounded circular portraits, italic quote text, blue author line, tap/click/keyboard
  shuffling, horizontal drag gestures for the front card, optional auto-roll, mobile
  sizing, light/dark-safe panel colors, and a reduced-motion static fallback. The
  layout now also exposes `glassShowcaseBackground` and `glassShowcaseBackgroundColor`
  so the rounded showcase panel can be disabled or recolored without affecting the
  portrait-grid panel setting.
  Page block follow-up: Pages now include a `pricing` block labeled "Price", based on
  `21st.dev/@efferd/components/pricing` / Efferd's pricing section source. The block
  stores editable heading/description, currency, default billing period, monthly/yearly
  toggle visibility, theme (`auto`/`dark`/`light`), highlighted-plan border effect toggle,
  and ordered pricing plans. Each plan stores name, subtitle, monthly/yearly prices,
  highlighted/popular state, CTA label/link, and ordered feature rows with optional tooltip
  text. `components/blocks/pricing-block.tsx` recreates the reference layout with a
  centered heading, animated billing pill, three-card responsive pricing grid, popular
  badge, yearly discount badge, tooltip helper icons, CTA buttons, CSS-only border trail
  animation, mobile stacking, reduced-motion fallback, and light/dark mode support.
  Follow-up fix: the pricing block's `auto` theme now reads the active `next-themes`
  resolved/forced theme before falling back to the OS preference, so forced Light
  preview/page mode stays light even on a dark-system machine.
  Price block variant follow-up: `pricing.style` now supports `standard` and
  `glass-gradient`, the latter based on `21st.dev/@vaib215/components/dark-gradient-pricing`.
  The glass-gradient renderer uses frosted radial cards, stacked mobile cards, included/
  unavailable feature icons, reference-like centered heading/subhead and CTA emphasis,
  CSS-only entry motion with reduced-motion fallback, and the same light/dark theme
  resolver as the standard style. Plans can now store an optional `priceLabel` such as
  "Contact us"; feature rows store `included` so unavailable benefits can render with
  muted x icons.
  Store follow-up: `/admin/store` is now a first-class Store tab for product management.
  The existing `product` table was expanded with `slug`, `sale_price_cents`, `category`,
  JSON `tags`, `is_featured`, and `sort_order` (migration `0013_past_ultron.sql`; written
  to backfill slugs safely before enforcing the unique/non-null constraint). Admin product
  APIs live at `/api/v1/admin/products`; deletes require fresh auth. Public product APIs now
  return the shared `ProductDTO` with optimized photo variants from `src/db/queries/store.ts`.
  Pages now include a `shop` block. Its `tora-grid` style is based on the ToraMochie /
  Reflector WooCommerce category/product pages: dark/light-aware charcoal or warm theme,
  optional sidebar search/tag cloud, Tora toolbar, 3-column desktop product grid, 1-column
  mobile grid, square product photos, sale badges, uppercase Josefin product names, and
  Playfair-style italic prices. `tora-coming-soon` reproduces the visible `/shop/` empty
  WooCommerce state. Product card links resolve to `/product/[slug]`, which renders a
  Tora-style product detail page.
  Follow-up: Store checkout now has a lightweight no-payments path. Public product/shop pages
  render Add to cart actions backed by a browser-local `photog-store-cart-v1` cart, `/cart`
  resolves current active products/prices through `POST /api/v1/cart`, and `POST /api/v1/checkout`
  creates a pending manual-invoice order plus `order_item` rows while `PAYMENTS_DRIVER=stub`.
  Admin `/admin/store` now shows a compact Recent order requests section via
  `/api/v1/admin/orders`. Hosted checkout and real payment capture remain deliberately deferred
  behind the `PaymentProvider` seam.
  Follow-up: manual order requests are now manageable from the Store tab. Admin order DTOs include
  client phone/notes, `/api/v1/admin/orders/[id]` supports GET and status PATCH
  (`draft`/`pending`/`paid`/`fulfilled`/`cancelled`) with audit logging, and `/admin/store`
  opens an order detail modal with customer info, itemized totals, status selector, and a copy
  summary helper. Repeated checkout requests from the same email refresh the existing client's
  latest name/phone/notes so the detail modal has current contact context.
  Follow-up: storefront polish added a header cart badge client island that reads the
  browser-local cart and updates on `photog-store-cart-change`, plus an interactive shop grid
  client island. Shop block search, tag cloud buttons, and sorting now filter/sort the displayed
  products immediately while preserving the server-fetched product list and the Tora visual style.
  Follow-up: product options are now part of the Store path. Migration
  `0014_nifty_screwball.sql` adds JSON `product.options` and `order_item.options`.
  Product options are structured as option groups with choices and price deltas; `/admin/store`
  edits them visually, product detail pages render dropdown choices, shop cards with required
  options route shoppers to the product page, browser-local cart lines are keyed by product +
  selected option IDs, `/api/v1/cart` prices option deltas, and `/api/v1/checkout` blocks stale
  or missing required selections before creating manual-invoice orders.
  Page block follow-up: Pages now include a `featureCarousel` block based on
  `21st.dev/@ravikatiyar/components/feature-carousel`. The block stores a headline,
  highlight text + gradient colors, subtitle, ordered `photoIds`, autoplay/speed,
  arrow visibility, desktop visible image count (3/5/7), image corner style, and
  optional primary/secondary CTA links.
  `components/blocks/feature-carousel-block.tsx` renders a reference-style centered
  hero with a configurable 3/5/7-image desktop 3D coverflow: center card sharp and
  largest, side cards rotated/blurred/faded, circular previous/next controls, click-to-focus side
  cards, swipe gesture support, mobile scaling, light/dark-safe colors, autoplay pause
  on hover/focus, and a reduced-motion static fallback. `collectPhotoIds` preloads
  selected carousel images.
  Page block follow-up: Pages now include a `bookSlider` block based on
  `21st.dev/@aarispathan15/components/book-slider` and the `react-pageflip` library.
  It is intentionally a Pages block rather than a Gallery-tab layout because it stores
  curated book pages with per-page photo/headline/subhead/caption/link fields plus
  cover title/subtitle/photo. Settings include compact/standard/large sizing, soft/hard
  page feel, controls, page numbers, shadow strength, background/text/accent colors,
  and a paper texture + stain toggle that reuses `/textures/retro-testimonial-paper.webp`.
  `components/blocks/book-slider-block.tsx` dynamically loads `react-pageflip` for a
  realistic click/drag page-turning book, lets the library switch to portrait mode on
  mobile, and renders the same content as static cards for SSR/reduced-motion fallback.
  `collectPhotoIds` preloads the cover and page photos.
  Book slider follow-up: the editor exposes both "Add page" and "Add 3 pages" controls,
  and each book page now stores `imageMode` (`editorial` split or `full` image). Full
  image pages render the photo edge-to-edge with a dark text gradient/overlay in both
  the pageflip renderer and the reduced-motion static fallback. The live flipbook is
  a double-page desktop spread again, but each spread pairs one photo leaf with its
  matching text leaf so each click/drag reveals one new photo at a time. Mobile keeps
  the compact single-page leaf with photo and copy together. Dark mode now derives a
  dark paper surface, lighter page ink, visible counters, and dark controls from the
  same book color settings instead of leaving the pages bright cream. The block also
  has a `showcaseBackground` toggle; off removes the rounded outer panel/shadow while
  preserving the actual book page colors.
  Page block follow-up: Pages now include an `imageComparison` block based on
  `21st.dev/@ravikatiyar/components/image-comparison-slider-horizontal` and the vertical
  sibling at `21st.dev/@ravikatiyar/components/image-comparison-slider-vertical`. It stores
  left/right photo IDs (shown as top/bottom in vertical mode), labels, title/subtitle,
  horizontal/vertical orientation, initial divider position, aspect ratio, width,
  rounded-frame toggle, showcase background toggle/color, and handle color.
  Aspect ratio options are 16:9 wide, 3:2 landscape, 4:3 landscape, 1:1 square,
  4:5 portrait, 3:4 portrait, 2:3 portrait, and 9:16 vertical; legacy saved `portrait`
  values still render as 4:5.
  The renderer is a responsive before/after slider with clipped second image, draggable
  divider/handle, tap-to-move on desktop, touch handle dragging on mobile, horizontal or
  vertical keyboard arrow/Home/End support, light/dark panel styling, and preview placeholders when one
  side has not been selected. `collectPhotoIds` preloads both comparison photos.
  Page block follow-up: Pages now also include a `team` block inspired by the 21st.dev
  Team Showcase reference. The block stores an optional section title, grayscale/social
  toggles, and ordered team members (`name`, `role`, optional `photoId`, plus X/LinkedIn/
  Instagram/Behance URLs). `collectPhotoIds` preloads member portraits, the admin editor
  supports portrait picking and member reorder/remove/add, and
  `components/blocks/team-showcase-block.tsx` renders the staggered three-column portrait
  layout with reference-style active member markers, grayscale hover/tap transitions,
  reveal-on-active social links, mobile horizontal portrait scroll, and theme-aware
  light/dark colors.
  Team block follow-up: `team.layout` now also supports `orbitCarousel`, based on
  Sera UI / 21st.dev's Orbiting Carousel with Animated Icons reference. The block
  stores orbit intro text, ring count (`auto`/1/2/3), autoplay speed, pause-on-hover,
  progress dots, animated icon accents, and a center-card button label/link. The
  renderer keeps the reference structure: a centered profile card with member portrait,
  role, bio, arrows, and button, surrounded by circular member portraits that rotate
  and counter-rotate so faces stay upright. Larger teams automatically split into
  two or three concentric rings sharing the same center, with mobile-specific radii,
  dark/light-safe colors, and reduced-motion/autoplay guards.
  Orbit carousel follow-up: forced 2-ring and 3-ring layouts use wider desktop/mobile
  radii plus per-ring angle offsets so member portraits clear the center profile card
  and alternate into neighboring ring gaps instead of lining up as straight spokes.
  Follow-up: The Team block now has a second layout, "Editorial member cards", based on
  Shatlyk1011/Emerald UI's Team Member Card. It stores `layout`, `cardPosition`, and
  `showCardArrow` on the block plus a per-member `description`; the admin editor exposes
  card side, circular-arrow, and bio controls only for the editorial layout. The renderer
  keeps the existing Team Showcase intact and branches to large portrait cards with
  uppercase role labels, overlapping two-line names, bio text, circular arrow CTA, staggered
  CSS entrance timing, hover image scale, light/dark colors, and reduced-motion/no-JS
  fallbacks. Focused Chrome smoke verified desktop, iPhone 13 dark mode, and reduced motion
  with 0 console/page errors. Docker rebuilds were also cleaned up by ignoring local
  `.claude`/`.codex` agent assets from the image build context.
  Follow-up: The editorial Team card arrow is now functional. Instead of stacking every
  member vertically, the layout renders one active member in-place and the circular arrow
  cycles to the next member, wrapping back to the first. The default alternate side setting
  still flips image/text placement by member index, so member one shows image-left/text-right,
  member two shows text-left/image-right, and so on. The section clips horizontal overflow
  during entrance transforms. Focused Chrome smoke verified desktop cycling, side alternation,
  wraparound, iPhone 13 dark mode, and reduced motion with 0 console/page errors.
  Follow-up: The Team block now also has a "Marquee team cards" layout based on
  `21st.dev/@cnippet_dev/components/team`. It adds editable marquee settings
  (`marqueeSubtitle`, speed, pause-on-hover, decorations, quote toggle/text/author/role/photo)
  while reusing the existing ordered team members and portrait picker. The renderer matches the
  reference structure: centered blue icon + headline/subtext, headline scribble, bottom-right
  curve decoration, left/right fade masks, grayscale portrait cards that reveal color on hover,
  frosted bottom name/role overlays, CSS marquee motion, light/dark styling, and a reduced-motion
  horizontal-scroll fallback. Focused Chrome smoke verified desktop, iPhone 13 dark mode, and
  reduced motion with 0 console/page errors and no horizontal overflow.
  Follow-up: The Team block now also has a "Creative team section" layout based on
  `21st.dev/@ravikatiyar/components/team-section-1`. It stores reference-specific header
  settings (`creativeEyebrow`, intro description, logo text, CTA label/link, main social row
  toggle, X/Facebook/Instagram/YouTube URLs, and website label/link) while reusing the existing
  ordered team members and portrait/social fields. The renderer follows the source preview's
  large uppercase `OUR`/team title composition, right-side logo/CTA,
  centered icon/website row, and three-column member cards with circular portraits, soft card
  lift/shadow, primary-tinted bottom reveal, portrait scale, hover/focus social reveal, mobile
  stacked layout, and light/dark/reduced-motion-safe styling.
  Follow-up: The Creative team section grid-paper background was removed at owner request.
  Optional logo, CTA, website, and main social row pieces are now truly optional in the
  renderer: clearing logo text hides it, clearing either CTA label or CTA link hides the
  button, clearing either website label or website link hides the website item, and clearing
  an individual social URL hides that icon.
  Follow-up: Creative team section now stores `creativeColumns` with a 3-column default and
  an editor option for 4 desktop columns. Mobile remains single-column stacked; desktop 4-column
  mode uses a wider grid and tighter gutters so the member cards stay balanced.
  Follow-up: Creative team section now stores `creativeShowCardOutline` with a default of
  `true`. The editor exposes a "Card outline" toggle; turning it off removes the rectangular
  border around each member card while preserving the card shape, shadow, hover/focus motion,
  and portrait/social behavior.
  Page block follow-up: Spacer and Divider blocks are now configurable instead of fixed.
  Spacer keeps legacy `md` visual spacing by default but supports XS/SM/MD/LG/XL/custom
  desktop heights, same-or-overridden mobile heights, full-band or content-width
  backgrounds, and theme-muted/custom background colors. Divider now supports solid,
  dashed, dotted, double, fade, and gradient styles; hairline/thin/medium/thick
  thickness; full/content/narrow widths with alignment; preset or custom vertical
  spacing; theme/custom line color; optional background bands; and optional centered
  label text. Both blocks render as self-managed full-bleed page blocks so background
  bands can span the page while default rendering remains backward compatible.
  Pre-push docs audit follow-up: `.env.example` and Docker Compose files were reviewed and
  did not need config changes for the recent page/admin updates; real `.env` stayed untouched.
  README and docs were refreshed so the current SeaweedFS Compose stack, `render-config`
  gallery contract, `components/blocks/*` renderers, and Testimonials page block are reflected
  instead of the older MinIO/layout-config wording.
  Design Footer follow-up: the Design tab Footer card now includes a "Sticky animated footer"
  layout inspired by the 21st.dev sticky footer reference. It stores the sticky footer background,
  text, accent color, reveal strength, and large-brand toggle in the global
  `page_config.config.footer` object. Public rendering uses a CSS clipped fixed footer reveal
  in `components/layout/footer.tsx` / `app/globals.css`, with reduced-motion and unsupported
  `clip-path` fallbacks that render as a normal footer instead of requiring JavaScript.
  Follow-up: Sticky footer public rendering now stacks the large brand, tagline, menu columns,
  and bottom utility row like the Design preview instead of placing menu columns beside the
  oversized brand. This prevents real-page text overlap. The admin label is now "Reveal distance";
  it controls how much scroll space the sticky footer gets before it fully settles.
  Follow-up: the Sticky animated footer line-grid overlay was removed from both public rendering
  and the Design preview. Both surfaces now use one top-left accent glow only.
  Follow-up: Sticky animated footer was realigned to the 21st.dev Efferd reference: compact
  hash-style brand mark, small intro copy, outlined social buttons, dense footer columns, and
  simple bottom copyright row. Footer content comes from Menus -> Footer menu; parent no-link
  items with children render as column headings/links, loose top-level links are kept in a More
  column, and flat menus still chunk as a fallback.
  Mobile sticky footer now renders at natural height instead of forcing content into 100svh, so
  long footer menus are not clipped.
  Follow-up: Sticky footer content can now be controlled directly in Design -> Footer via custom
  columns. The config shape is `footer.stickyColumns[]` with editable column labels and links
  (`label`, `href`, `openInNewTab`), normalized by `src/lib/footer-config.ts`. Public rendering
  uses custom columns first and only falls back to Menus -> Footer menu when no custom columns
  are saved. The Design preview now mirrors custom columns instead of hard-coding Product /
  Solutions / Resources / Company.
  Follow-up: Sticky footer desktop spacing now adapts to sparse content. Public rendering
  calculates a compact/balanced/roomy density from column/link count plus intro content; compact
  footers get a shorter reveal height and pack the main content with the bottom row instead of
  stretching sparse links across a mostly empty panel.
  Follow-up: Compact sticky footer spacing was tightened again: lower compact reveal clamps,
  smaller content padding, tighter main/nav/link gaps, shorter social/tagline spacing, and a
  reduced compact bottom-row top padding.
  Pages Banner follow-up: the ToraMochie/Reflector Image Banner reference is now represented
  as Banner block layouts: Modern, Creative, Simple, Full wall, Bottom text, Only image, and
  Classic. The source-matched refinements include the `a-btn-1` style uppercase text CTA with
  sliding line hover, the Simple three-path pulsing down arrow, and a Full Wall grid-rotator
  enhancement that swaps 7 random cells every 3s across 4x8 desktop / responsive mobile grids.
  Full Wall also has a typed headline suffix matching the reference typed.js beat
  (`startDelay` 1200ms, type 30ms, backspace 20ms, 500ms hold), with editable comma-separated
  words in the Banner settings and a reduced-motion static fallback. Full Wall keeps an SSR
  collage fallback and disables motion under reduced motion.
  Follow-up: Full Wall now seeds the reference headline/typed words when selected in the editor
  if those fields are blank, and existing saved Full Wall blocks with blank `typewriterWords`
  still animate by falling back to a multi-word loop instead of silently rendering a static
  final word. The typed highlight no longer reserves the widest typed word; the black mark now
  shrinks and grows with the currently typed characters like the reference.
  Pages About block follow-up: ToraMochie/Reflector About Elements is represented as a new
  Pages-tab `about` block, not a banner/team variant. It has Simple, Modern, and Classic layouts
  based on the reference `about.css` / `about.js`: Josefin Sans typography, Reflector
  a-btn-2/a-btn-6 CTA styles, Modern sticky portrait/contact detail composition, and Classic
  staggered three-image collage.
  Pages Portfolio List follow-up: ToraMochie/Reflector Portfolio List is represented as a new
  Pages-tab `portfolioList` block. It stores manual portfolio items with title/category/description,
  link, cover photo, and optional hover photo. Public variants match the reference shortcode family:
  Modern list, Category cards, Distortion feature, Animated masonry, and Mix masonry. The distortion
  variant progressively overlays a Three.js displacement-style hover transition on top of the static
  image fallback and disables the overlay for reduced motion.
  Follow-up: Portfolio List fidelity pass tightened the layouts against the live ToraMochie source.
  Modern intentionally uses the measured 5-column 20% layout with alternating horizontal/vertical
  items; Category cards and Animated masonry crop the image wrapper on hover instead of drawing an
  inner border; Distortion uses the reference displacement map (`/textures/portfolio-displacement-1.jpg`)
  with intensity -0.4, 0.7s in / 0.3s out, sine ease-out; Animated masonry uses side vertical category
  labels and reference column ordering; Mix masonry is centered to the reference 1270px narrow/wide/narrow row.
  Pages Price block follow-up: the ToraMochie/Reflector Price List reference is represented as
  additional `pricing.style` values: `tora-classic`, `tora-creative`, `tora-modern`,
  `tora-simple`, `tora-with-media`, and `tora-image-background`. Pricing plans now store
  optional `photoId`, `mediaPhotoId`, and `mediaVideoUrl` fields so each package can use a
  library image/background and the with-media style can show a play affordance. The public
  plan photos through `collectPhotoIds`. Fidelity correction: the Tora variants now follow the
  actual `pricelist.css` shortcode structures instead of generic pricing cards: Classic is a
  2-column 570px card grid inside a 1110px content width, Modern/Image Background are 3-column
  380px grids, Creative/Simple are full-width background panels with source-like clip-path hover
  timing, and With Media is a 60/40 media + pricing composition at 1110px desktop width. The
  CSS keeps the reference uppercase letter spacing, price/check-dot sizing, 350/450/550ms
  transitions, grayscale/scale hovers, mobile breakpoints, light/dark styling, and reduced-motion
  safety. Follow-up: Classic and Modern now stretch their inner bordered `.wrap` to the row
  height, and Image Background stretches `.img-bg-clip` to the row height, so side-by-side
  cards/panels keep equal hover outline/background sizes even when plan feature text lengths
  differ. The ToraMochie page also contains contact-form price-list variants; those should be
  added to the Contact Form block as a separate follow-up if the owner wants that part of the
  reference too.
  Pages Gallery block follow-up: the ToraMochie/Reflector Props page is represented as the
  `tora-props-catalog` Gallery block grid option. It matches the reference props inventory
  composition: full-width optional showroom band, Josefin Sans, 1110px inner width, 5/3/2
  square-tile responsive grid, 20px horizontal gutters, warm gold captions, and click-to-lightbox
  via the existing Gallery lightbox. Default colors are theme-aware: light mode uses a warm cream
  showroom with brown-gold captions and subtle image lift, while dark mode keeps the closer source
  charcoal/gold look (`#252626`/`#edd8aa`). Custom background/caption colors still override the
  theme defaults. Settings expose caption visibility/source (`auto`, `headline`, `alt`, `caption`),
  caption color, background toggle, and background color. It intentionally uses existing photo
  metadata for prop codes instead of introducing a separate inventory-code field.
  ToraMochie/Reflector Casting page follow-up: the top casting intro is an About block layout
  (`tora-casting`) because it is a title/body/three-photo editorial intro; desktop shows three
  430:380 portraits, mobile auto-cycles through the three selected photos with a CSS-only
  slideshow while reduced-motion keeps a single static photo, and typography follows Reflector
  headings (Josefin Sans, 29px/3.77px desktop, 26px/1px mobile). The “Offering castings for” section is a
  Price block style (`tora-casting-services`) because the source uses Reflector’s
  `pricing-wrap classic` shortcode as service cards. It maps each plan to an offering: name =
  service title, subtitle = first slash line, features = remaining slash lines, photo = offering
  image, and order generates `/01`, `/02`, etc. Prices/buttons remain saved but hidden for this
  style. Desktop alternates text/image and image/text on a ~1170px rail with a 505px text card,
  60px gap, large faded number, and a configurable service image ratio: Reference 541:373,
  Wide 16:9, Landscape 4:3, Square 1:1, or Portrait 4:5. The image cell keeps its chosen
  aspect ratio instead of stretching to match tall copy cards. Mobile stacks image then text card.
  Previous focused Chrome smoke measured Rise mid-motion opacity at
  ~0.27-0.99 and
  Rise complete at the new range; Zoomed first and second category grids both at ~1795x1062 with
  every photo at ~582x338/scale 1; first Zoomed category showing 3 visible rows; Column Reveal
  transform changing from about -226px to -160px with opacity reaching ~0.92 by the mid-scroll
  sample; and 0 console errors.
  Deferred Codrops source variants to consider later: radial/3D scatter assemble
  (`data-grid-fourth`), deeper 3D scatter from far Z (`data-grid-fourth-v2`), tilted wide-grid
  fly-in (`data-grid-fifth`), 3D side-door reveal (`data-grid-eighth`), and skewed fan-in
  (`data-grid-ninth`). Re-read `codrops/OnScrollLayoutFormations/js/index.js` before adding them.
- **Owner preference for reference-driven features/effects:** Whenever the owner pastes a
  reference link or asks to add a new function, feature, UI component, or visual effect from a
  reference, treat the reference as the implementation quality bar. Plan the app fit first, then
  match timing, animation beats, easing, transitions, layout, spacing, text overlays,
  typography/font feel, text styling, controls, and interaction states as closely as practical.
  Every reference-driven addition should also work in light mode, dark mode, responsive desktop
  and mobile views, and reduced motion/no-JS fallback where animation is involved. Document any
  intentional deviations instead of silently drifting from the reference.
- **Keep `src/lib/render-config.ts` as the single grid-type source of truth**; retire the unused
  `src/layout-config/` legacy descriptor when convenient.
- **Set the production `SETTINGS_ENCRYPTION_KEY`** before storing real client/SMTP secrets.
- **Cross-agent memory:** the git-tracked Markdown here is the portable source of truth. A
  self-hosted semantic-memory service (FastAPI + SQLite + Qdrant over MCP) is an *optional*
  accelerator only — design + guardrails (index only docs, never secrets; rebuildable cache)
  in [`docs/AI-MEMORY-SERVICE.md`](docs/AI-MEMORY-SERVICE.md). Don't make a local DB the truth.
- **New agent? Run `./scripts/agent-bootstrap.sh`** for instant repo + stack orientation.
