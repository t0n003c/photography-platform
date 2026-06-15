# ROADMAP

Phased delivery plan for the self-hosted photography platform (Next.js 15 + PostgreSQL 16 + Drizzle + Better Auth + Redis/Valkey + BullMQ + sharp). Each phase is a checklist of concrete, checkable tasks.

> **Process note:** Each phase ends with a written **summary** and a **pause for approval** before the next phase begins. Items requiring sign-off (see _Deferred / Out of scope_) are not started without explicit approval.

---

## Phase 0 — Discovery, architecture & planning

- [x] Define product scope: public photography site, private client galleries, light print store (WordPress/WooCommerce replacement).
- [x] Lock the stack: Next.js 15 App Router + TS, PostgreSQL 16, Drizzle, Better Auth (password + TOTP + passkeys, rate-limit, lockout, sessions), Redis/Valkey, BullMQ worker, sharp pipeline.
- [x] Decide topology: single Next.js app (public + admin + API) + separate worker process, same codebase.
- [x] Decide deployment target: NAS (Synology/Unraid) under Docker; NPM + Cloudflare Tunnel external; no public inbound ports.
- [x] Define provider abstractions: `StorageProvider` (**MinIO/S3 default**, filesystem alternate driver), `EmailProvider` (SMTP/Resend), `PaymentProvider` (stub, deferred).
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
- [x] Author Compose stack: `web`, `db` (postgres 16), `redis`, `worker`, and `minio` (+ `minio-init` bucket bootstrap) — all **core, always-on** services.
- [x] Add internal network and volumes (`pgdata`, `redisdata`, `miniodata`).
- [x] Create `.env.example` with all variable names (no secrets) per `DEPLOYMENT.md` §5.
- [x] Implement `/api/health` and per-service healthchecks (`pg_isready`, `redis-cli ping`, web HTTP, worker HTTP heartbeat).
- [x] Wire `depends_on` with `service_healthy` conditions and restart policies.
- [x] Verify a **hello-world** runs end-to-end under `docker compose up` — all five services healthy; worker connected to Redis; bucket created; home page served.
- [x] Push to GitHub (`t0n003c/photography-platform`, private).
- [x] **Summary + pause for approval.**

---

## Phase 2 — Core data & API

- [ ] Design and implement the Drizzle schema (users, sessions, media, galleries, categories, locations, client grants, audit log, page-config).
- [ ] Set up Drizzle migrations (generate, apply, CI gate).
- [ ] Integrate Better Auth: password authentication.
- [ ] Add TOTP (authenticator) second factor.
- [ ] Add passkeys (WebAuthn).
- [ ] Implement account lockout + rate-limiting (login, sensitive endpoints).
- [ ] Configure secure sessions, CSRF protection, security headers, and a strict Content-Security-Policy.
- [ ] Build the media pipeline: upload → enqueue (BullMQ) → worker runs sharp → generate derivatives → persist metadata to DB.
- [ ] Implement `StorageProvider` (**MinIO/S3 default**, filesystem alternate driver) with originals/derivatives separation per `MEDIA-ARCHITECTURE.md`.
- [ ] Build core REST API (media, galleries, categories, locations, auth, admin operations).
- [ ] Implement audit logging for sensitive/admin actions.
- [ ] **Summary + pause for approval.**

---

## Phase 3 — Public site

- [ ] Implement responsive grid layouts: masonry, justified, and uniform.
- [ ] Build category browsing.
- [ ] Build location browsing.
- [ ] Implement an accessible lightbox (keyboard, swipe, focus management).
- [ ] Build hero and about sections.
- [ ] Build a spam-protected contact form (honeypot/challenge + server-side validation).
- [ ] Build the Instagram-style section.
- [ ] SEO: metadata, JSON-LD, sitemap, robots, OpenGraph/Twitter cards.
- [ ] Add PWA support (manifest, service worker, installability).
- [ ] Hit performance targets (Core Web Vitals: LCP / INP / CLS).
- [ ] **Summary + pause for approval.**

---

## Phase 4 — High-end interaction layer

- [ ] Integrate Three.js / React Three Fiber with custom GLSL shaders.
- [ ] Add Lenis smooth scroll.
- [ ] Implement rAF-driven effects.
- [ ] Add WebGL depth-of-field on hero / featured imagery.
- [ ] Respect `prefers-reduced-motion` (disable/reduce effects).
- [ ] Lazy-load effects **off the critical path**; never block LCP/INP.
- [ ] Ensure the site is fully usable with WebGL disabled (graceful fallback).
- [ ] Re-verify performance targets still met with effects enabled.
- [ ] **Summary + pause for approval.**

---

## Phase 5 — Admin / CMS

- [ ] Build drag-and-drop upload with chunked, resumable transfer and progress UI.
- [ ] Build the media library with batch operations (select, move, tag, delete).
- [ ] Organize media into galleries, categories, and locations.
- [ ] Create and manage **private client galleries**.
- [ ] Implement per-client access grants.
- [ ] Implement expiring share links.
- [ ] Implement per-gallery download and favorites controls.
- [ ] Build a data-driven layout/design manager persisted as **page-config**.
- [ ] **Summary + pause for approval.**

---

## Phase 6 — Integrations & hardening

- [ ] Implement email flows: contact form notifications and gallery invites (`EmailProvider`: SMTP/Resend).
- [ ] Add `PaymentProvider` / invoice seams (stubbed; real payments deferred).
- [ ] Security pass against `SECURITY.md` + automated security tests.
- [ ] Performance pass + Lighthouse audits across key pages.
- [ ] Wire caching per `CACHING-STRATEGY.md` (HTTP, data, image/derivative, Redis layers).
- [ ] **Summary + pause for approval.**

---

## Phase 7 — Deployment

- [ ] Finalize the Compose stack for the NAS (resource limits, healthchecks, profiles).
- [ ] Configure the NPM proxy host + Cloudflare Tunnel ingress path (egress-only, no inbound ports).
- [ ] Finalize volumes and backups (Postgres dumps, media originals, optional R2 offsite).
- [ ] Finalize the operational run-book (start/stop, logs, common ops).
- [ ] Document and rehearse the upgrade + rollback procedure (Drizzle migration caution, previous image tag).
- [ ] **Summary + pause for approval.**

---

## Deferred / Out of scope for now

These require explicit sign-off before any work begins:

- [ ] Real payments / checkout (live `PaymentProvider`, gateway integration, tax, fulfillment).
- [ ] AI auto-tagging / auto alt-text generation (pending approval).
- [ ] Anything else needing explicit owner sign-off (new external integrations, scope expansions).

---

> **Reminder:** every phase concludes with a summary and an approval pause before proceeding.
