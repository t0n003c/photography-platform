# Architecture Decision Records (ADRs)

This is the running decision log for the self-hosted photography platform.

**How this log works.** Each ADR captures one significant decision and the reasoning behind it at the time it was made. ADRs are **append-only**: we never delete or rewrite an accepted ADR. When a decision changes, we add a **new** ADR that records the new choice and references the old one, and we edit the old ADR's **Status** to `Superseded by ADR-00NN` (leaving its body intact as history). This preserves _why_ past choices were made so future maintainers don't relitigate settled trade-offs or repeat abandoned ones.

**Statuses used:** `Proposed` → `Accepted` → (`Superseded by ADR-00NN` | `Deprecated`).

**Template per entry:**

```
## ADR-000N: <title>
- Status:
- Date:
- Context:
- Decision:
- Consequences:
- Alternatives considered:
```

---

## ADR-0001: Framework — Next.js 15 App Router

- **Status:** Accepted
- **Date:** 2026-06-14
- **Context:** The product is two things at once: a public, image-heavy marketing/portfolio site (must score well on Lighthouse/accessibility) and a stateful, authenticated application (private client galleries, favorites, downloads, admin, a future print store). We are a single operator self-hosting on a NAS via Docker. We need one framework that serves both surfaces and has strong, well-documented integrations for the rest of the stack.
- **Decision:** Use **Next.js 15 with the App Router**, React, and TypeScript. Use React Server Components to minimize client JS on portfolio pages, route handlers for the API surface (auth, galleries, webhooks), and `output: "standalone"` for a lean Docker image.
- **Consequences:**
  - One framework covers static + stateful surfaces; no second framework to maintain.
  - The App Router caching/RSC model has a learning curve and occasional sharp edges we must understand deliberately.
  - We inherit Next's major-version upgrade cadence; we pin versions and upgrade intentionally.
  - Image optimization, PWA (Serwist), auth (Better Auth), and shadcn all have first-class Next support, lowering solo integration cost.
- **Alternatives considered:** **Remix / React Router 7** (excellent web-fundamentals model, but smaller ecosystem and more glue to write for image optimization/PWA solo); **Astro + islands** (best static Lighthouse, but a poor fit for the stateful auth-gated half — we'd bolt on a React SPA and lose the simplicity).

---

## ADR-0002: ORM — Drizzle over Prisma

- **Status:** Accepted
- **Date:** 2026-06-14
- **Context:** We run PostgreSQL 16 (see ADR-0004) on constrained, always-on NAS hardware with multiple long-lived Node processes (web + worker). We need type-safe data access, trustworthy migrations for a long-lived production DB, and low runtime overhead.
- **Decision:** Use **Drizzle** (SQL-first). Schema is defined in TypeScript; migrations are generated as plain, reviewable `.sql` files via `drizzle-kit`. App code accesses the DB only through Drizzle.
- **Consequences:**
  - Minimal runtime weight and no separate query-engine binary — meaningful on NAS hardware and in always-on worker processes.
  - Migrations are plain SQL we can read and audit before applying to production data.
  - We write somewhat more explicit, SQL-shaped code than with a heavier ORM, and the relational query API is younger than some alternatives.
- **Alternatives considered:** **Prisma** (great DX/Studio/migrations, but a heavier runtime/footprint and a separate DSL — the tax isn't worth it here); **raw SQL / Kysely** (max control and type-safe building, but more boilerplate for the common CRUD path — Kysely kept as a fallback if we ever want pure query-builder ergonomics).

---

## ADR-0003: Authentication — Better Auth

- **Status:** Accepted
- **Date:** 2026-06-14
- **Context:** Client galleries are private and access-controlled; the admin surface is sensitive. We require real authentication with password login, **TOTP 2FA**, **WebAuthn/passkeys**, rate limiting, account lockout, and managed sessions — and an admin policy that controls which factors are required. As a self-hosted, privacy-owned, single-operator product, hosted auth vendors (recurring per-MAU cost, data leaving our hardware) are disqualifying for the core path.
- **Decision:** Use **Better Auth**, storing all auth tables in our own PostgreSQL via Drizzle. Enable password + TOTP + WebAuthn/passkeys + rate limiting + lockout + sessions. Treat **passkeys as a stronger, passwordless-capable factor**; an admin policy declares required factors per surface. Pin versions and own the schema to manage the project's relative youth.
- **Consequences:**
  - Passkeys/2FA/rate-limit/lockout are core capabilities, not bolt-ons; all credentials live on our hardware; no recurring fee.
  - We accept the risk of a younger library (smaller community, maturing API), mitigated by version pinning and owning the migrations.
  - Auth schema becomes part of our Postgres backup/restore story.
- **Alternatives considered:** **Lucia** (signaled move to maintenance/learning-resource posture — a poor long-lived bet); **Auth.js/NextAuth** (mature, but passkeys/2FA are bolt-on/experimental and the required-factor policy is friction); **Clerk/Auth0** (turnkey but hosted control plane, recurring per-MAU cost — against self-host/privacy/cost constraints).

---

## ADR-0004: Database — PostgreSQL 16

- **Status:** Accepted
- **Date:** 2026-06-14
- **Context:** Data is genuinely relational — users, galleries, access grants, expiring share links, favorites/download controls, and a future print-store order/invoice model. Multiple processes (web + BullMQ worker) write concurrently. We self-host one box.
- **Decision:** Use **PostgreSQL 16** in a single Docker container. Back up via `pg_dump` and volume snapshots. Lean on JSONB, full-text search, and strong constraints.
- **Consequences:**
  - A well-understood relational store with headroom for deferred invoicing/payments without a future engine migration.
  - One more service to run and back up than an embedded file DB, accepted as standard ops.
  - Concurrent web/worker writes are handled natively (a known SQLite weakness avoided).
- **Alternatives considered:** **SQLite/libSQL** (zero-service and simple, but concurrent multi-process writes and a richer order/invoice model are its weak spots; libSQL/Turso leans hosted); **MySQL/MariaDB** (mature and familiar from the WordPress legacy, but weaker type/constraint/JSON ergonomics with no offsetting advantage on a green-field schema).

---

## ADR-0005: Media storage — MinIO (S3-compatible) from day one behind a StorageProvider abstraction

- **Status:** Accepted — **Superseded by ADR-0024** for the storage-engine choice (SeaweedFS replaces MinIO; the `StorageProvider` abstraction and filesystem-alternate decision stand).
- **Date:** 2026-06-14
- **Context:** The platform is image-heavy; originals must be preserved and many derivatives served. We deploy on a NAS, which is itself a storage appliance. We want maximum portability and immediate cloud-S3 parity (presigned URLs, an identical S3 API to AWS/R2) so a potential move to off-site cloud is purely operational, while still preserving a raw-disk option.
- **Decision:** Define a **`StorageProvider` interface** (unchanged). The **default driver is MinIO (S3-compatible)**, run as a **core (non-optional, non-profile-gated) service** in Docker Compose from day one. Provide the **NAS filesystem volume** driver as a **selectable alternate**. App code never touches `fs` or S3 directly — only the interface (put/get/delete/presign). _(This reflects the user's explicit choice of MinIO-first over filesystem-first on 2026-06-14.)_
- **Consequences:**
  - Maximum portability and immediate cloud-S3 parity: presigned URLs and an S3 API identical to R2/AWS, so a later move off the NAS is operational, not a rewrite.
  - MinIO is a core always-on service to run, secure, and back up (its bucket becomes the media system of record and is backup-critical).
  - Switching to the filesystem driver (or cloud R2 for off-site durability) is a config + driver change, not a refactor; the `StorageProvider` abstraction is preserved exactly as designed.
- **Alternatives considered:** **Filesystem-first as default** (cheapest/simplest local disk on the appliance with trivial snapshot backups, but not S3-API portable on its own — kept as the selectable alternate driver instead); **cloud S3/R2** (durable and off-site, but recurring cost, data leaving owned hardware, and egress/latency — against the self-host ethos for the default path, preserved as a future driver).

---

## ADR-0006: Job queue — BullMQ on Valkey

- **Status:** Accepted
- **Date:** 2026-06-14
- **Context:** The heaviest work is CPU-bound image derivative generation, which must not block HTTP requests or load the primary database. We also need reliable async email delivery and scheduled sweeps (e.g., expiring share-link cleanup). We already run a Redis-protocol store (see ADR-0007).
- **Decision:** Use **BullMQ** backed by **Valkey**, executed in a **dedicated worker process** (see ADR-0010). Use it for image derivative jobs, email sends, and repeatable/scheduled maintenance jobs, with retries and backoff.
- **Consequences:**
  - Heavy image jobs run off the request path and off the primary DB; the site stays responsive.
  - Robust retries/backoff/concurrency/scheduling out of the box.
  - Adds no new dependency _category_ — Valkey is already present.
- **Alternatives considered:** **pg-boss** and **Graphile Worker** (both Postgres-backed, removing a dependency, but they couple queue load to the primary DB — deliberately avoided for heavy image work; reasonable if we ever want to drop Valkey).

---

## ADR-0007: Cache / sessions / rate-limit store — Valkey

- **Status:** Accepted
- **Date:** 2026-06-14
- **Context:** We need a fast store for sessions, rate-limit/lockout counters (used by Better Auth), and a general cache tier — and BullMQ (ADR-0006) requires a Redis-protocol backend. Licensing stability matters for a long-lived project.
- **Decision:** Run a single **Valkey** instance (Redis-protocol compatible) serving sessions, rate-limit counters, cache, and the BullMQ backing store.
- **Consequences:**
  - One service covers multiple concerns; every Redis-targeting library works unchanged.
  - **Valkey's** BSD license and community governance insulate us from future licensing surprises.
  - We manage one more container plus its persistence/memory configuration.
- **Alternatives considered:** **Redis** (functionally equivalent; passed over for licensing/governance preference); **Postgres-only, no Redis-protocol store** (one fewer service, but no native BullMQ fit and hot-path counters would hit the primary DB).

---

## ADR-0008: Image pipeline — sharp, async, originals preserved, EXIF stripped

- **Status:** Accepted
- **Date:** 2026-06-14
- **Context:** Uploads must yield responsive, modern-format derivatives and a fast-loading placeholder, without blowing the limited CPU/RAM budget of NAS hardware or blocking the upload request. Privacy requires removing location/identifying metadata from public derivatives, while originals must remain pristine.
- **Decision:** Use **sharp (libvips)** inside the **BullMQ worker**. On upload, preserve the **original untouched**, then asynchronously generate **responsive AVIF/WebP derivatives** plus a tiny **LQIP/blur placeholder**, and **strip/normalize EXIF** on derivatives (remove GPS and camera serials; honor/normalize orientation).
- **Consequences:**
  - Lowest CPU/RAM footprint of the realistic options; AVIF's encoding cost is absorbed off the request path.
  - Originals are always recoverable; derivatives can be regenerated by re-running the job.
  - Public images leak no GPS/serial metadata.
  - We ship sharp's native binary in the Docker image (standard, manageable).
- **Alternatives considered:** **ImageMagick** (ubiquitous but heavier RAM/CPU and a clunkier shell-out); **external service (Thumbor/imgproxy)** (great on-the-fly transforms, but another always-on service competing for the same NAS CPU — we prefer pre-generated fixed derivatives that cache well; imgproxy kept as a future option).

---

## ADR-0009: PWA — Serwist

- **Status:** Accepted
- **Date:** 2026-06-14
- **Context:** The product must be an installable PWA with good offline/caching behavior (the operator shows galleries to clients on the go) and strong Lighthouse scores, on Next.js App Router.
- **Decision:** Use **Serwist** for the service worker: precaching, runtime caching strategies, offline support, and installability, integrated with the App Router.
- **Consequences:**
  - Maintained, App-Router-aware PWA without hand-rolling the error-prone service-worker lifecycle.
  - We learn/maintain Serwist's configuration and caching-strategy choices (and must manage cache versioning on deploys).
- **Alternatives considered:** **next-pwa** (formerly common, but maintenance has lagged and App Router support is shaky — a liability for a long-lived app); **hand-rolled service worker** (total control, but reimplementing caching/versioning/update flows is a large solo cost and easy to get subtly wrong).

---

## ADR-0010: Topology — separate web and worker processes over shared Postgres + Valkey

- **Status:** Accepted
- **Date:** 2026-06-14
- **Context:** Background work (image derivatives, email, scheduled sweeps) is CPU-bound and bursty. Running it inside the web process would compete with request handling and risk degrading site responsiveness on limited NAS CPU. We deploy with Docker Compose.
- **Decision:** Run **two application processes** as separate Compose services from the **same image**: a **web** service (Next.js, handling HTTP/RSC/API) and a **worker** service (BullMQ consumer). Both share the same **PostgreSQL** and **Valkey** instances. The web service enqueues jobs; the worker executes them.
- **Consequences:**
  - Heavy/bursty work is isolated from request handling; the site stays responsive.
  - Worker concurrency can be tuned independently to fit the NAS CPU budget.
  - Slightly more orchestration (two services, shared config/secrets, ordered startup) and we must ensure idempotent, retry-safe jobs.
- **Alternatives considered:** **Single combined process** (simpler to deploy, but background CPU spikes would degrade HTTP latency); **separate physical machines** (more isolation, but unnecessary and costlier for a single-box NAS deployment).

---

## ADR-0011: Email — EmailProvider interface with SMTP and Resend drivers

- **Status:** Accepted
- **Date:** 2026-06-14
- **Context:** Email is on critical paths: password resets, gallery invites, and contact-form notifications. We must not be locked to a single hosted vendor for these, and we want zero recurring cost where a relay is available, while keeping the option of better deliverability/DX.
- **Decision:** Define an **`EmailProvider` interface**. Ship an **SMTP** driver (portable default; works with any provider or self-hosted relay) and a **Resend** driver (better deliverability/DX when wanted). Selection is configuration; app code calls only the interface.
- **Consequences:**
  - No lock-in for core email; SMTP runs at zero marginal cost with an available relay.
  - Switching providers, or adding Postmark/SES drivers later, is config + a small driver, not a refactor.
  - SMTP deliverability depends on the relay/reputation we configure — an operational responsibility.
- **Alternatives considered:** **Resend only** (great DX/deliverability, but a hosted dependency and recurring cost on a core path); **Postmark / SES** (top-tier deliverability / lowest cost at scale respectively, but hosted and fiddlier — preserved as future drivers behind the same interface).

---

## ADR-0012: Payments — manual default with optional Stripe Checkout

- **Status:** Accepted
- **Date:** 2026-06-14
- **Context:** A light print store needed to start with low-risk manual invoices, while leaving
  room for hosted card checkout once the operator is ready to configure a payment account.
- **Decision:** Keep manual invoice checkout as the default, and expose hosted payments through
  a `PaymentProvider` interface. Stripe Checkout is the first concrete driver because hosted
  Checkout + signed webhooks fit a self-hosted app without storing card data.
- **2026-07 update:** Manual invoices and receipts are active. Hosted Stripe Checkout is
  now available when Settings -> Payments has Stripe selected, online payments enabled,
  and publishable/secret/webhook values present. Cart checkout and issued public invoices
  create Stripe Checkout sessions; signed webhooks reconcile paid/expired invoice state.
  Hosted public cart checkout can optionally enable Stripe Tax. Invoice payment links default
  to fixed saved totals, but newly issued or intentionally refreshed links can snapshot a
  Stripe Tax mode when Settings -> Payments opts into invoice recalculation.
- **Consequences:**
  - Card data stays with Stripe Checkout; this app stores only session/intent references and invoice state.
  - Manual invoice requests remain the default/fallback when Stripe readiness is incomplete.
  - Product management, public product browsing, browser-local cart, and manual invoice order requests continue to work without hosted payments.
  - Stripe (not a merchant of record) still leaves sales-tax/VAT obligations, registrations,
    and filings to the operator; Stripe Tax only automates calculation/collection where configured.
- **Alternatives considered:** **Lemon Squeezy / Paddle** (merchant-of-record handling global tax/VAT — major admin relief, at higher fees and more opinionated checkout; preserved as a deliberate future alternative); **building payments now** (premature scope, compliance/maintenance burden ahead of revenue — rejected).

---

## ADR-0013: Dark mode — next-themes with class strategy

- **Status:** Accepted
- **Date:** 2026-06-14
- **Context:** Dark mode is a hard product requirement for a photography site (dark UIs flatter imagery), it must respect the OS preference, persist the user's choice, and **not flash the wrong theme** on load. We use Tailwind + shadcn/ui.
- **Decision:** Use **`next-themes`** with Tailwind's `class` dark-mode strategy and shadcn's CSS-variable tokens. Support system / light / dark with persisted preference and a no-flash inline script on first paint.
- **Consequences:**
  - Correct, persisted, system-aware theming with no flash-of-incorrect-theme, in a few lines.
  - shadcn components theme automatically via CSS variables.
  - A tiny inline theme-detection script runs before hydration (a standard, accepted cost).
- **Alternatives considered:** **Hand-rolled theme context + localStorage** (full control, but you re-solve SSR no-flash, system-preference sync, and persistence — needless solo cost); **CSS `prefers-color-scheme` only** (simplest, but cannot honor a manual user override or persist a choice).

---

## ADR-0014: Zod 4 + access-control roles for Better Auth

- **Status:** Accepted
- **Date:** 2026-06-14
- **Context:** Implementing auth (Phase 2), the `@better-auth/passkey` plugin's transitive `better-call` peer requires `zod@^4`, and Better Auth already bundles Zod 4 internally. The admin plugin also rejects custom role names unless they are declared via its access-control config.
- **Decision:** Pin the project to **Zod 4** (our usage — `z.object/string/enum/coerce/email/url/infer` — is compatible). Declare the **owner/admin/staff** roles through Better Auth's `createAccessControl` + `adminAc` statements so `adminRoles` validates; `owner`/`admin` get full admin-plugin capability, `staff` is a content-only role.
- **Consequences:** Single Zod version across the tree; passkeys install cleanly; roles are first-class and enforceable. Verified sign-up → sign-in → session end-to-end.
- **Alternatives considered:** Stay on Zod 3 + `--legacy-peer-deps` (fragile, two Zod copies); use only the plugin's default `admin`/`user` roles (loses the owner/staff distinction the product needs).

---

## ADR-0015: Worker applies DB migrations on boot

- **Status:** Accepted
- **Date:** 2026-06-14
- **Context:** `docker compose up` must bring the platform up with a correct schema, but the production `web` image is a slim Next.js standalone bundle without `drizzle-kit`. The `worker` image already carries the full dependencies and source.
- **Decision:** The **worker runs Drizzle migrations on startup** (programmatic migrator, `RUN_MIGRATIONS=true` default) before consuming jobs. Single-instance by design; idempotent via the Drizzle journal.
- **Consequences:** Self-contained `docker compose up`; no separate migration step for the common case. If the worker is scaled out, migrations should move to a dedicated one-shot init service (noted for Phase 7).
- **Alternatives considered:** A dedicated init container (cleaner for multi-replica, more moving parts now); migrating from the web image (would bloat the standalone image with dev tooling).

---

## ADR-0016: Public image delivery — custom `<picture>` over `next/image`

- **Status:** Accepted
- **Date:** 2026-06-14
- **Context:** The sharp pipeline already pre-generates responsive AVIF/WebP/JPEG derivatives across fixed size buckets and stores them. `next/image` would re-run an optimizer over already-optimized assets and wants a loader/host config for our app-served, authz'd variant URLs.
- **Decision:** Render a **custom `ResponsiveImage`** as a native `<picture>` with `<source>` srcsets built directly from our variant rows (AVIF → WebP → JPEG), intrinsic `width`/`height` (no CLS), LQIP/dominant-color placeholders, and `loading`/`fetchPriority` for the LCP image. No `next/image`.
- **Consequences:** Zero double-encoding, full control over format/bucket selection, and private variants stay behind the app's authorization. We hand-manage `sizes`. Verified AVIF delivery across home + category pages.
- **Alternatives considered:** `next/image` with a custom loader (redundant optimizer pass, host config, weaker fit for private/signed variants).

---

## ADR-0017: Public pages render dynamically (no build-time DB)

- **Status:** Accepted
- **Date:** 2026-06-14
- **Context:** The `web` Docker image is built with `next build` during `docker build`, when no database is reachable. Statically prerendering DB-backed pages at build time would fail the image build.
- **Decision:** Public data pages use **`export const dynamic = "force-dynamic"`** and read the DB per request (RSC, no HTTP hop); the sitemap wraps DB calls in try/catch. CDN/edge + route caching (`CACHING-STRATEGY.md`) is layered in Phase 6 for performance without build-time DB coupling.
- **Consequences:** `docker build` needs no DB; pages are always fresh. Until Phase 6 caching lands, every public hit queries Postgres (fine at studio scale; Cloudflare will absorb most reads once cache headers are set).
- **Alternatives considered:** ISR with build-time prerender (needs a reachable DB at build — breaks the slim image build); running migrations + a DB during `docker build` (couples build to infra).

---

## ADR-0018: WebGL as strict progressive enhancement (R3F + raw GLSL, no drei)

- **Status:** Accepted
- **Date:** 2026-06-14
- **Context:** Phase 4 calls for a high-end WebGL/Three.js treatment that must never tank Core Web Vitals or accessibility. Three.js is large (~600 kB) and WebGL is unavailable/unwanted for some users.
- **Decision:** Build the effect with **React Three Fiber + a hand-written GLSL** depth-of-field/parallax shader (no `@react-three/drei`, to keep the dependency/version surface minimal). It is a **separate `ssr:false` dynamic chunk** mounted only behind a runtime gate — `requestIdleCallback` + WebGL support + not `prefers-reduced-motion` + not Save-Data — over a static `<picture>` that is always the SSR LCP and full fallback. Lenis smooth scroll is likewise reduced-motion-gated. The canvas is `pointer-events-none`, `aria-hidden`, and IntersectionObserver-gated.
- **Consequences:** Three.js is excluded from the home page's 119 kB First-Load JS; the site is fully usable (and fully rendered) with WebGL/JS off; motion preferences are honored. The interactive shader itself needs an in-browser visual check (headless verifies the split + fallback only).
- **Alternatives considered:** `drei` helpers (extra dep + React-19/fiber-9 version alignment risk); a CSS-only parallax (no real DoF); eager-loading the canvas (would blow the JS budget and risk LCP/INP).

---

## ADR-0019: WebP-primary delivery; originals preserved for downloads

- **Status:** Accepted
- **Date:** 2026-06-15
- **Context:** Owner directive: optimise uploads to small, fast, high-quality app images to save storage, while client downloads must be full original quality. The earlier ladder emitted AVIF+WebP+JPEG × 5 buckets (15 derivatives/photo).
- **Decision:** App delivery is **WebP-primary** — WebP (q82, effort 4) at every responsive bucket (thumb→xlarge) plus **one JPEG fallback** at `large` for the `<img>` tag / rare non-WebP client. AVIF and JPEG-proliferation are dropped (≈6 derivatives vs 15 → less storage + faster encode). **Originals are stored untouched** and are what the client-gallery ZIP/single downloads serve (full size + quality).
- **Consequences:** ~60% fewer derivative objects and faster processing; near-universal browser support via WebP+JPEG; originals remain the irreplaceable backup asset. AVIF (best ratio) is forgone per the WebP directive but the format list is centralised in `derivatives.ts` if revisited.
- **Alternatives considered:** Keep AVIF primary (best compression, slowest encode, more storage); WebP-only with no JPEG (tiny compat risk for the `<img>` fallback).

---

## ADR-0020: Original-quality client downloads via a zip-build worker

- **Status:** Accepted
- **Date:** 2026-06-15
- **Context:** Clients need to download their photos at full original quality, individually and in bulk.
- **Decision:** Single downloads stream the **original** file through an authorized grant route. Bulk downloads enqueue a **`zip-build` BullMQ job**; the worker archives the originals (favorites or whole gallery) with `archiver`, stores the zip, and flips the `download` row to `ready` with a 24h-expiring, grant-authorized file URL the client polls for.
- **Consequences:** Full-quality delivery without blocking the request; downloads are access-controlled + logged + expiring. The zip is currently buffered in memory (bounded to 500 photos) — streaming to storage is a noted follow-up for very large galleries.
- **Alternatives considered:** Zipping synchronously in the request (times out / blocks); serving a signed MinIO URL (MinIO isn't publicly exposed).

---

## ADR-0021: Step-up (fresh-auth) on destructive admin actions

- **Status:** Accepted
- **Date:** 2026-06-15
- **Context:** The security audit flagged that sensitive/destructive admin actions only checked role, not recency of authentication (SECURITY.md §2.4).
- **Decision:** `requireFreshAuth(role, maxAgeSec=900)` gates the most destructive ops (gallery delete, client delete, grant revoke/rotate). When the session is older than the freshness window it returns **403 `STEP_UP_REQUIRED`**; the admin UI's `StepUpProvider` prompts re-authentication (password or passkey), which mints a fresh session, then retries the action once.
- **Consequences:** A stolen, idle admin session can't immediately perform destructive/exfiltration actions. Freshness uses session-creation time as the proxy (re-auth resets it); a dedicated `lastStrongAuthAt` is a possible refinement. Applied to low-frequency ops only, to avoid step-up fatigue on batch operations.
- **Alternatives considered:** No step-up (audit finding); Redis `lastStrongAuthAt` updated via auth hooks (more moving parts; session.createdAt is sufficient given re-auth resets it).

---

## ADR-0022: Enforce nonce-based CSP (was Report-Only)

- **Status:** Accepted
- **Date:** 2026-06-15
- **Context:** SECURITY.md §5.2 planned to ship CSP Report-Only first, then enforce once the WebGL/PWA surfaces were validated.
- **Decision:** Switch to **enforced** `Content-Security-Policy` (nonce-based scripts, no `unsafe-inline`/`unsafe-eval` in prod). The per-request nonce is set on the request in middleware so Next propagates it to its injected scripts, and is passed to `next-themes` and the JSON-LD blocks. Violations still report to `/api/csp-report`.
- **Consequences:** Stronger XSS containment. Reading the nonce via `headers()` in the root layout makes pages dynamic (acceptable — they already are). `style-src` keeps `'unsafe-inline'` (tightening styles to hashes/nonce is a follow-up).
- **Alternatives considered:** Stay Report-Only (weaker — collects but doesn't block); strict styles now (Tailwind + inline styles make hash-based styles noisy).

---

## ADR-0023: Remotion slideshow video — implemented, opt-in (Chromium in worker)

- **Status:** Accepted
- **Date:** 2026-06-15
- **Context:** Owner approved building the Remotion gallery-slideshow video. Server-side Remotion rendering needs a headless Chromium, which changes the worker image's size/attack surface and resource profile.
- **Decision:** Implement it **off by default and opt-in**: a `video-render` BullMQ queue + worker (Remotion **dynamically imported** so the default lean worker never loads it), a `remotion/` composition (crossfading Ken-Burns slideshow) rendered by `src/video/render.ts`, an MP4 stored via `StorageProvider`, and a gallery-editor "Slideshow video" card. The admin endpoint returns **501** unless `VIDEO_RENDER_ENABLED=true`; the Chromium is baked only when the worker is built with `INSTALL_REMOTION_DEPS=true` (wired in `compose.prod.yaml`). `remotion/` is excluded from the app `tsc` (it compiles under Remotion's own bundler); Next's build-time type pass is disabled in favour of `tsc` as the gate.
- **Consequences:** Studios can offer slideshow videos without bloating the default deployment. Enabling means a bigger worker image (+Chromium) and higher RAM/CPU. Rendering is verified at build/typecheck level here; a live render requires the Chromium-enabled image.
- **Alternatives considered:** Client-side WebCodecs render (limited, browser-bound); a separate render microservice (cleaner isolation, more ops); not building it (owner wanted it).

---

## ADR-0024: Object storage — SeaweedFS, replacing MinIO (supersedes ADR-0005's MinIO choice)

- **Status:** Accepted
- **Date:** 2026-06-15
- **Context:** ADR-0005 chose MinIO as the default S3 backend. Since then MinIO moved to **AGPL v3**, **stripped the admin console from the Community Edition** (Feb 2025), and put the community edition into **maintenance mode** (late 2025, security-only). The AGPL doesn't endanger our app code (we run stock MinIO behind a network/S3 boundary), but depending on a maintenance-mode component for a long-lived product is a real risk.
- **Decision:** Swap the default object store to **SeaweedFS** (Apache-2.0, actively developed). It's a drop-in: our `StorageProvider` "minio" driver is just an S3 client pointed at SeaweedFS's S3 gateway (`:8333`); the app, media pipeline, downloads, and Remotion renders are unchanged. Run as a single all-in-one node (`weed server -s3`) with identities in `docker/seaweedfs/s3.json`. SeaweedFS's small-file efficiency suits our ~7-objects-per-photo workload. The `filesystem` driver remains the no-object-store alternate.
- **Consequences:** Apache-2.0 (no licensing concern); actively maintained; same S3 abstraction (portability + cloud tiering available). SeaweedFS runs headless — no host ports are published by default, so day-to-day it's invisible; storage usage is surfaced on the admin **Dashboard → Storage used** card (summed from the DB). Its filer file-browser (`:8888`) / master UI (`:9333`) stay available for debugging by uncommenting the `ports:` block in `docker/compose.yaml`. Verified end-to-end (upload→WebP→serve→zip→video render) on SeaweedFS. The S3 access key/secret must match between `.env` and `s3.json`. ADR-0005 is **superseded** by this for the storage-engine choice.
- **Alternatives considered:** **filesystem driver** (simplest, zero object store — best if S3 semantics aren't wanted); **Garage** (S3, AGPL); **stay on MinIO** (works, AGPL is fine for our use, but maintenance-mode risk + gutted console); cloud R2/S3 (offsite, recurring cost).

---

## ADR-0025: Site settings store with DB-encrypted SMTP secret

- **Status:** Accepted
- **Date:** 2026-06-16
- **Context:** Site title, branding, locale/timezone, and SMTP were hardcoded (`src/lib/seo.ts`) or env-only. The owner wanted a **Settings** admin tab to edit these at runtime — including the SMTP password, which is a secret.
- **Decision:** Add a singleton `site_settings` table. Non-secret fields drive SEO/manifest/`<html lang>` (cached, sanitized read) and the email transport (`resolveEmailProvider` reads DB config, env fallback). Secrets (SMTP password, Resend key) are **AES-256-GCM encrypted at rest** (`src/lib/secrets.ts`) using `SETTINGS_ENCRYPTION_KEY` (32-byte hex), which is **derived from `BETTER_AUTH_SECRET` when unset** so dev/local boots with no extra config. The API is **write-only** for secrets (never returned; UI shows "•••• set"), and the sanitized cache never holds plaintext. Reads are resilient to a down DB so `next build` falls back to defaults.
- **Consequences:** Runtime-editable branding + email without redeploys; no plaintext secret in code or Redis. Operators **should** set a dedicated `SETTINGS_ENCRYPTION_KEY` in production (rotating it invalidates stored secrets, which must be re-entered). Site icon is uploaded to object storage and served via `/api/v1/media/site-icon`.
- **Alternatives considered:** Keep SMTP env-only (no UI editing — rejected, owner wanted it); store secrets in plaintext (rejected); a dedicated secrets manager/Vault (overkill for a single-node NAS deployment).

---

## ADR-0026: Data-driven navigation menus

- **Status:** Accepted
- **Date:** 2026-06-16
- **Context:** Header/footer nav was hardcoded in two components. The owner wanted to organize pages/subpages and edit navigation from the admin.
- **Decision:** Add `menu` (keys `primary`/`footer`) + `menu_item` (self-ref `parentId`, cascade) tables and an admin tree editor (reuses the Folders reorder/cycle-guard pattern). Items link to home, a category/location/gallery (slug resolved at render), an internal/external URL, or a builder page. The public header/footer **server-fetch** their menu (cached) and render nested items as dropdowns (desktop) / indented (mobile). A **default fallback** (the original links) renders until a menu is customized, so the site never breaks; the two menus auto-seed from the original nav on first admin visit.
- **Consequences:** Fully editable navigation incl. subpages; one cached query per menu. The fallback + lazy seed mean zero migration risk. Cache invalidates on any item change.
- **Alternatives considered:** Keep nav in code (rejected — not editable); a single flat list without nesting (insufficient for subpages); storing nav in `site_settings` JSON (less queryable, no per-item rows).

---

## ADR-0027: Curated block-based page builder (not freeform)

- **Status:** Accepted
- **Date:** 2026-06-17
- **Context:** The site had **no generic page concept** — every route mapped 1:1 to `collection`/`location`/`gallery`. The owner wanted to design multiple page types (portfolio, landing, about, journal…) with sections, columns, headings, galleries, grids, banners, and footers.
- **Decision:** A **curated block system**, not a freeform drag-drop builder. A `page` table stores an ordered `blocks` jsonb array validated by `src/lib/blocks.ts` (zod; invalid blocks are dropped, never throw). A server-side `BlockRenderer` maps each block to a component, **reusing** the existing gallery grids, `ResponsiveImage`, and `HeroMedia`. Public pages render via a `[...slug]` catch-all (fixed routes keep precedence; reserved-slug guard). The admin editor (`/admin/pages`) provides a block palette, per-type forms, a columns editor, and a **live-preview iframe** (draft blocks stashed in Redis, rendered by an admin-gated `/preview/page/[id]`). Home + About are migrated into the builder (Home via a seeded draft the owner previews and publishes; bespoke home is the fallback until then). The block palette has since grown to include contact forms, FAQs, logos, scroll showcases, Flip Reveal galleries, and testimonials while keeping the same typed JSON contract.
- **Consequences:** 90% of a page builder's value (sections/columns/galleries/banners/testimonials) with predictable, accessible, server-rendered output and no mini-CMS to maintain. Page "types" are starter presets over the same block model. Slugs may contain `/` for subpages. A full freeform canvas remains possible later but is intentionally avoided.
- **Alternatives considered:** **Freeform drag-drop builder** (Elementor/Gutenberg-style — far larger build, heavier runtime, ongoing maintenance); a headless CMS (extra service, against the boring-tech/self-hosted goal); MDX pages (developer-only, not admin-editable).

---

## ADR-0028: GSAP + opt-in cinematic effects

- **Status:** Accepted
- **Date:** 2026-06-17
- **Context:** The owner wanted three signature effects (HTML→WebGL distortion, cinematic 3D scroll, page transitions). The codebase had three.js + react-three-fiber + Lenis but **no animation library**.
- **Decision:** Add **GSAP** (free license) as the one new runtime dependency — flagged per the "ask before new dependency categories" rule and approved. All three effects are **opt-in and feature-gated** through the existing `components/webgl/feature.ts` (reduced-motion/data, WebGL support, idle): page transitions (`template.tsx` + GSAP enter tween, skipped under reduced-motion), banner WebGL distortion (`distortion-canvas`, r3f, via a `HeroMedia` `variant`), and gallery cinematic 3D scroll (`cinematic-scene`, r3f + sticky scroll container). The static image / responsive grid is always the complete, accessible fallback; effects are chosen per block in the page editor.
- **Consequences:** Cinematic polish without compromising the no-JS / reduced-motion / no-WebGL baseline. GSAP loads on public routes (page transitions); the heavy WebGL scenes are dynamic-imported and mount only when gated on. Effects never replace semantic DOM, so screen readers/SEO are unaffected.
- **Alternatives considered:** **CSS / View Transitions API only** (lighter, but couldn't match the reference demos and 3D scroll); **Framer Motion** (React-coupled, heavier for this use); building bespoke tweening (reinventing GSAP).
