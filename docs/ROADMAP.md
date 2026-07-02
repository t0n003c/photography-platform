# ROADMAP

Phased delivery plan for the self-hosted photography platform (Next.js 15 + PostgreSQL 16 + Drizzle + Better Auth + Redis/Valkey + BullMQ + sharp). Each phase is a checklist of concrete, checkable tasks.

> **Process note:** Each phase ends with a written **summary** and a **pause for approval** before the next phase begins. Items requiring sign-off (see _Deferred / Out of scope_) are not started without explicit approval.

---

## Phase 0 — Discovery, architecture & planning

- [x] Define product scope: public photography site, private client galleries, light print store (WordPress/WooCommerce replacement).
- [x] Lock the stack: Next.js 15 App Router + TS, PostgreSQL 16, Drizzle, Better Auth (password + TOTP + passkeys, rate-limit, lockout, sessions), Redis/Valkey, BullMQ worker, sharp pipeline.
- [x] Decide topology: single Next.js app (public + admin + API) + separate worker process, same codebase.
- [x] Decide deployment target: NAS (Synology/Unraid) under Docker; NPM + Cloudflare Tunnel external; no public inbound ports.
- [x] Define provider abstractions: `StorageProvider` (**SeaweedFS/S3 default**, filesystem alternate driver), `EmailProvider` (SMTP/Resend), `PaymentProvider` (stub, deferred).
- [x] Author `DEPLOYMENT.md` (topology, compose plan, volumes, env, networking, backups, upgrade, run-book).
- [x] Author this `ROADMAP.md` (phased plan).
- [x] Cross-reference companion docs: `MEDIA-ARCHITECTURE.md`, `SECURITY.md`, `CACHING-STRATEGY.md` (authored alongside Phase 0).
- [x] **Summary + pause for approval.**

---

## Phase 1 — Scaffold ✅ (completed 2026-06-14)

- [x] Initialize repo structure (app, worker, shared `src/` modules, `docs/`) per `FOLDER-STRUCTURE.md`.
- [x] Configure TypeScript (strict), ESLint, Prettier. _(editorconfig + commit hooks deferred to Phase 2.)_
- [x] Stand up base Next.js 15 App Router project (TS) with a hello-world home route and `/api/health` route.
- [x] Author Dockerfiles (`Dockerfile.web` standalone + `Dockerfile.worker`).
- [x] Author Compose stack: `web`, `db` (postgres 16), `redis`, `worker`, and an S3-compatible media store. The original MinIO plan has since been superseded by SeaweedFS (`seaweedfs` + `seaweedfs-init`) per ADR-0024.
- [x] Add internal network and volumes (`pgdata`, `redisdata`, media storage volume; current stack uses `seaweeddata`).
- [x] Create `.env.example` with all variable names (no secrets) per `DEPLOYMENT.md` §5.
- [x] Implement `/api/health` and per-service healthchecks (`pg_isready`, `redis-cli ping`, web HTTP, worker HTTP heartbeat).
- [x] Wire `depends_on` with `service_healthy` conditions and restart policies.
- [x] Verify a **hello-world** runs end-to-end under `docker compose up` — all five services healthy; worker connected to Redis; bucket created; home page served.
- [x] Push to GitHub (`t0n003c/photography-platform`, private).
- [x] **Summary + pause for approval.**

---

## Phase 2 — Core data & API ✅ (completed 2026-06-14)

- [x] Design and implement the Drizzle schema (auth tables + galleries, grants, photos/variants, categories, locations, favorites, downloads, page-configs, store stubs, audit log, contact).
- [x] Set up Drizzle migrations (generate + apply; worker auto-applies on boot).
- [x] Integrate Better Auth: password authentication.
- [x] Add TOTP (authenticator) second factor _(plugin enabled; enroll/verify routes live under /api/auth)._
- [x] Add passkeys (WebAuthn) _(@better-auth/passkey plugin enabled)._
- [x] Implement account lockout + rate-limiting (Better Auth Redis rate-limit + custom login/2FA/reset rules; app-level Redis limiter for uploads/contact/downloads/unlock).
- [~] Secure sessions (Redis), CSRF (Better Auth + SameSite), security headers, CSP. _CSP ships **Report-Only** first per SECURITY.md §5.2; flip to enforce after the Phase 3/4 UI lands._
- [x] Build the media pipeline: chunked upload → BullMQ → sharp derivatives (AVIF/WebP/JPEG × thumb–xlarge) + LQIP + dominant color → StorageProvider → DB. Idempotent; verified end-to-end.
- [x] `StorageProvider` (SeaweedFS/S3 default) with originals/derivatives separation + authorized media-serving route.
- [x] Build core REST API (public portfolio, client-gallery share-token tier, admin CRUD, contact, store stub) per `API-DESIGN.md`.
- [x] Implement audit logging for sensitive/admin actions.
- [x] **Summary + pause for approval.**

> Deferred within Phase 2 (small, tracked): full EXIF/capture-date extraction (needs an EXIF parser dep — pending approval), the zip-build worker for multi-photo downloads (rows + endpoints exist, builder stubbed), admin category/location membership editing on photos, CSP enforce-mode, and step-up (fresh-auth) gating on destructive admin ops.

---

## Phase 3 — Public site ✅ (completed 2026-06-14)

- [x] Implement responsive grid layouts: masonry, justified, and uniform (data-driven from page-config).
- [x] Build category browsing (index + detail with cursor "load more").
- [x] Build location browsing (index + detail).
- [x] Implement an accessible lightbox (keyboard nav, focus trap + restore, scroll lock, backdrop close).
- [x] Build hero and about sections.
- [x] Build a spam-protected contact form (honeypot `company` + min-fill-time + server-side validation + Redis rate limit).
- [x] Build the Instagram-style section _(recent photos as feed; real IG API integration deferred)._
- [x] SEO: metadata, JSON-LD (Organization/Breadcrumb/ImageGallery), sitemap.ts, robots.ts, OpenGraph/Twitter.
- [x] Add PWA support (manifest, Serwist service worker, installability).
- [~] Performance targets — built to spec (AVIF/WebP `<picture>` srcset, lazy + priority LCP, LQIP/no-CLS, RSC, minimal client JS). **Formal Lighthouse audit deferred to Phase 6** (performance-lighthouse agent).
- [x] **Summary + pause for approval.**

> Deferred within Phase 3 (tracked): public pages render **dynamically** (`force-dynamic`) so the Docker image builds without a DB — CDN/ISR caching is layered in Phase 6 per `CACHING-STRATEGY.md`; the public **client-gallery viewer UI** (`/g/[token]`) is Phase 5 (API already exists); real Instagram API integration; formal Lighthouse pass.

---

## Phase 4 — High-end interaction layer ✅ (completed 2026-06-14)

- [x] Integrate Three.js / React Three Fiber with custom GLSL shaders.
- [x] Add Lenis smooth scroll (rAF-driven; disabled under reduced-motion).
- [x] Implement rAF-driven effects (pointer-lerped parallax + focal breathing).
- [x] Add WebGL depth-of-field on the hero (multi-tap disk blur, pointer focal point).
- [x] Respect `prefers-reduced-motion` (WebGL + smooth scroll fully disabled).
- [x] Lazy-load effects **off the critical path** (ssr:false dynamic chunk; Three.js excluded from the 119 kB home First-Load JS; mounted after an idle + capability gate).
- [x] Ensure the site is fully usable with WebGL disabled (static `<picture>` is the SSR LCP + fallback; also gated on Save-Data + WebGL support).
- [~] Re-verify performance — code-split + SSR-fallback verified headlessly; **interactive WebGL render + a formal Lighthouse pass are best confirmed in-browser (Phase 6)**.
- [x] **Summary + pause for approval.**

---

## Phase 5 — Admin / CMS ✅ (completed 2026-06-14)

- [x] Build drag-and-drop upload with chunked, resumable transfer and progress UI.
- [x] Build the media library with batch operations (select, reprocess, delete, organize).
- [x] Organize media into galleries, categories, and locations (incl. new category/location membership endpoints).
- [x] Create and manage **private client galleries** (settings, photo-membership picker).
- [x] Implement per-client access grants (create with one-time share token, revoke, rotate, edit).
- [x] Implement expiring share links (per-grant expiry + per-gallery expiry).
- [x] Implement per-gallery download + per-grant favorites/download/view controls.
- [x] Build a data-driven layout/design manager persisted as **page-config** (per-scope grid/spacing/theme/hero + set default).
- [x] Plus: auth-gated shell, **login** (password + TOTP + passkey), **account/security** (2FA enroll, passkeys, sessions), clients CRUD, taxonomy CRUD + reorder, contact inbox, dashboard.
- [x] **Summary + pause for approval.**

> Deferred within Phase 5 (tracked): in-gallery drag-to-reorder of photos (membership order = selection order for now); 2FA QR image (the `otpauth://` URI is shown as text); richer hero editor (photo picker/height/overlay — currently enabled + headline); the interactive admin UI is build- + API-verified but a full click-through visual pass is recommended in-browser.

---

## Phase 6 — Integrations & hardening ✅ (completed 2026-06-15)

- [x] Email flows: contact notifications + gallery invites via `EmailProvider` (log default / SMTP / Resend), enqueued through BullMQ, sent by the worker.
- [x] `PaymentProvider` / invoice seams (factory + `isPaymentsEnabled`; checkout gated, still 501 — real payments deferred).
- [x] Security pass against `SECURITY.md` (audit) + fixes: fail-closed prod secret (`instrumentation.ts`), contact dual rate-limit keys, XFF trusted only outside prod, token-resolution rate-limit ordering. Vitest + 37 unit tests.
- [~] Performance: Lighthouse CI budgets (`lighthouserc.json`) wired; **the actual Lighthouse run needs a browser/CI — run `npx @lhci/cli autorun` against the built app**.
- [x] Caching per `CACHING-STRATEGY.md`: middleware enforces private `no-store` (admin/login/client-gallery/auth) + CDN `s-maxage`+SWR on public read APIs; media route immutable vs no-store; CSP report endpoint.
- [x] **Summary + pause for approval.**

> Deferred within Phase 6 (tracked, from the security audit): **step-up auth** (`isFresh` exists but isn't enforced on destructive admin ops — needs a real `lastStrongAuthAt` + UI support); a **Redis query cache** for hot public lists (HTTP/CDN layer done; data-layer cache is a follow-up); flipping CSP from Report-Only to **enforce** (after a clean report window); tighter AVIF magic-byte sniffing. Real secrets must be set at deploy (now fail-closed in prod).

---

## Phase 7 — Deployment ✅ (completed 2026-06-15)

- [x] Finalize the Compose stack for the NAS (`compose.prod.yaml`: resource limits, log rotation, `tunnel` profile; healthchecks in base).
- [x] Document the NPM proxy host + Cloudflare Tunnel ingress path (egress-only, no inbound ports; optional in-compose `cloudflared`).
- [x] Finalize volumes and backups (`scripts/backup.sh` pg_dump + media volume tar + retention; `scripts/restore.sh`; offsite R2/rclone note).
- [x] Finalize the operational run-book (start/stop, logs, health, psql, SeaweedFS storage triage) in `DEPLOYMENT.md`.
- [x] Document the upgrade + rollback procedure (worker auto-migrates; forward-only migration caution + pg-backup restore fallback).
- [x] **Summary + pause for approval.**

---

## Post-v1 enhancements ✅ (completed 2026-06-15)

- [x] **Media optimization:** WebP-primary delivery + single JPEG fallback (AVIF dropped); originals preserved (ADR-0019). Full EXIF extraction.
- [x] **Original-quality downloads:** single original stream + zip-build worker bundling originals (ADR-0020).
- [x] **Step-up auth** on destructive admin ops + re-auth modal (ADR-0021).
- [x] **Enforced nonce-based CSP** (was Report-Only) + CSP report endpoint (ADR-0022).
- [x] **Redis query cache** for hot public lists with mutation invalidation.
- [x] **2FA QR code**, **in-gallery drag-to-reorder**, swappable **InstagramProvider** (Graph + fallback).
- [x] **CI** (GitHub Actions: lint/typecheck/test/build + Lighthouse + Playwright) and a **Playwright WebGL e2e**.
- [x] Remotion **evaluated** (skill added locally) and proposed in `AI-INTEGRATIONS.md` (not wired — changes deployment shape).

> Still needing a browser/CI to *execute* (set up, not run here): the Lighthouse pass and the Playwright suite run in CI. Smaller follow-ups: streaming zip for very large galleries, `lastStrongAuthAt` step-up refinement, tightening `style-src`.

---

## Post-v1, round 2 ✅ (completed 2026-06-15)

- [x] **Public client-gallery viewer UI** (`/g/[token]`) — unlock, favorites, single + zip downloads, lightbox.
- [x] **Remotion slideshow video** — implemented **opt-in** (off by default; Chromium baked only when enabled). ADR-0023; `AI-INTEGRATIONS.md`.

## Deferred / Out of scope (require explicit sign-off)

- [ ] Real payments / checkout (live `PaymentProvider`, gateway integration, tax, fulfillment).
- [ ] **AI auto-tagging / smart alt-text** (Hugging Face / local model) — proposed in `AI-INTEGRATIONS.md`.
- [ ] Anything else needing explicit owner sign-off (new external integrations, scope expansions).

---

> **Reminder:** every phase concludes with a summary and an approval pause before proceeding.
