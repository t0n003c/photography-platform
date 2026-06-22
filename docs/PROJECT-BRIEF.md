# Project Brief — Self-Hosted Photography Platform

> This is the **original founding brief** for the project, captured verbatim as the durable
> source of truth for intent and scope. Everything in `/docs` derives from it. When a decision
> seems to conflict with this brief, this brief and `docs/DECISIONS.md` win — flag the drift.
> Pasted into the first Claude Code session in an empty project folder.

---

You are the lead engineer and architect for a self-hosted photography website + client-gallery platform + light print store. Treat this as a long-lived production product, not a demo. Optimize for scalability, maintainability, security, and real-world self-hosted operation.

## Rules of engagement (read first)
- **Plan before you build.** Complete Phase 0 fully and stop for my approval before writing any application code. Do not scaffold the app until I approve the plan.
- **Work in small, reviewable increments.** One concern per change. Commit frequently with clear messages. After each phase, summarize what changed and what's next, then pause.
- **Document every meaningful decision in /docs** as you go (see doc list below). When you choose between options, record the trade-off and why.
- **No secrets in code.** Everything sensitive goes in `.env` (provide `.env.example`). Never hardcode keys, passwords, or tokens.
- **Prefer boring, well-supported tech over novelty,** except where high-end visual interaction is explicitly requested. Every "fancy" feature must degrade gracefully and must not tank Lighthouse or accessibility.
- **Ask me before** introducing a new paid service, a new top-level dependency category, or anything that changes the deployment shape.
- If a requirement is ambiguous or you see a better approach, **say so and recommend — don't silently comply.**

## What I'm replacing & the reference
I currently run a WordPress/WooCommerce photography site (reference aesthetic & feature set: https://toramochie.com). Carry over these proven patterns and improve on them:

- Public portfolio organized by **category** (e.g. Portraits, Events, Nature) and by **location/travel** (e.g. Arkansas, Colorado, Seattle).
- **Private client galleries** — access-controlled pages where a specific client views/downloads their shoot (the old site did this with separate "private" pages; do it properly with real auth + shareable access).
- **Light store / print sales** — currently a cart; I want this architected for invoicing & payments later (not necessarily built now).
- **Contact form** with spam protection, Instagram-style feed/section, an About/hero.

Also reference the feature/UX bar set by leading photography platforms — study and borrow the good ideas (not the code) from: **Pixieset** and **Pic-Time** (client galleries, favorites, download controls, print store), **Format / Adobe Portfolio / Squarespace** (portfolio layout systems, theming), **SmugMug / Zenfolio** (organization at scale). I want client-gallery UX on par with Pixieset/Pic-Time.

## Phase 0 — Discovery, architecture & planning (DO THIS FIRST, THEN STOP)
Create these documents in `/docs` and present a summary in chat:

- `docs/ARCHITECTURE.md` — system overview, component diagram (text/mermaid), request lifecycle, data flow (upload → process → store → serve), and how public site / admin / API / worker relate.
- `docs/TECH-STACK.md` — proposed stack with trade-off analysis for each major choice (framework, DB, ORM, auth, media storage, cache, image processing, job queue, PWA, email, payments). For each: 2–3 options, pros/cons, and your recommendation with reasoning.
- `docs/FOLDER-STRUCTURE.md` — the proposed repo layout with one-line purpose per directory.
- `docs/DATA-MODEL.md` — entities & relationships (users/admins, clients, galleries, gallery-access grants, photos, collections/categories, locations, layouts/page-configs, orders/invoices-stub, audit log). Include the schema and indexing strategy.
- `docs/API-DESIGN.md` — REST (or RPC) endpoints, auth boundaries, request/response shapes, pagination, error format, rate-limit rules.
- `docs/CACHING-STRATEGY.md` — layered: CDN/Cloudflare, app-level (ISR/route cache), Redis, image-variant cache, browser/PWA. What's cached, TTLs, invalidation triggers.
- `docs/SECURITY.md` — auth flows, 2FA, lockout policy, session handling, CSRF, headers/CSP, upload validation, private-gallery access control, secrets handling, threat model for a self-hosted box behind Cloudflare Tunnel.
- `docs/MEDIA-ARCHITECTURE.md` — folder/storage layout for originals + derivatives, naming, variant strategy (sizes/formats), metadata/EXIF handling, backup considerations.
- `docs/DEPLOYMENT.md` — Docker Compose topology for a NAS, how it sits behind Nginx Proxy Manager and a Cloudflare Tunnel, env config, volumes, backups, upgrade procedure.
- `docs/PERFORMANCE.md` — how we hit a great Lighthouse/PageSpeed score (Core Web Vitals targets, image strategy, code-splitting, how the WebGL effects stay off the critical path).
- `docs/ROADMAP.md` — the phased plan below, with checkboxes, plus what's deferred (payments, etc.).
- `docs/DECISIONS.md` — running ADR-style log of choices and reversals.

### My strong default recommendations (challenge them in TECH-STACK.md if you disagree, but justify any change)
- **Framework:** Next.js (App Router) + React + TypeScript — for SSR/SSG/ISR, image optimization, SEO, and PWA support in one app.
- **Styling/UI:** Tailwind CSS + a headless component layer (e.g. shadcn/ui). Built-in dark mode (system + manual toggle, persisted).
- **DB:** PostgreSQL. **ORM:** Drizzle (lighter, SQL-first) — compare against Prisma.
- **Auth:** a modern self-hostable auth lib supporting TOTP 2FA + WebAuthn/passkeys (biometric) + password, with built-in rate limiting, max-attempt lockout, session management. (Evaluate Better Auth vs. Lucia-style custom vs. Auth.js + extensions.) Note: treat passkeys/biometric as a **stronger** factor, not a weaker "override" — design it as passwordless-capable, with admin policy controlling what's required.
- **Cache/queue:** Redis (or Valkey) for sessions, rate limiting, and caching; BullMQ worker for async image processing.
- **Image pipeline:** sharp generating responsive AVIF/WebP derivatives + LQIP/blur placeholders; strip/normalize EXIF; preserve originals.
- **Media storage:** compare filesystem volume on the NAS vs. MinIO (S3-compatible). Recommend based on simplicity vs. future portability.
- **PWA:** Serwist/next-pwa — offline shell, installable, manifest, caching of gallery thumbnails.
- **Email:** provider-abstracted (interface) with SMTP + a transactional provider (e.g. Resend) as drivers — for contact form, client-gallery invites, and future invoices.
- **Payments (deferred):** define a `PaymentProvider` interface and stub it (Stripe as the likely driver) so invoicing/checkout can be added later without rework. Do not build real payments now — just the seams.

Output a single **Plan Summary** at the end of Phase 0 and wait for my go-ahead.

## Phases 1–7 (after I approve Phase 0)
- **Phase 1 — Scaffold:** repo structure per FOLDER-STRUCTURE.md, TypeScript/lint/format config, base Next.js app, Docker + docker-compose (web, db, redis, worker, optional minio), `.env.example`, healthchecks, a "hello world" that runs under compose.
- **Phase 2 — Core data & API:** schema + migrations, auth (password + TOTP 2FA + passkeys + lockout/rate-limit), session/CSRF/security headers/CSP, the media upload→queue→sharp→derivatives→DB pipeline, core REST API per API-DESIGN.md, audit logging.
- **Phase 3 — Public site:** responsive grid gallery layouts (masonry + justified + uniform grid options), category & location browsing, photo lightbox, hero/about, contact form (spam-protected), Instagram-style section, SEO (metadata, JSON-LD, sitemap, robots, OpenGraph), and the PWA. Hit the PERFORMANCE.md targets.
- **Phase 4 — High-end interaction layer (progressive enhancement):** a tasteful WebGL layer using Three.js / React Three Fiber + GLSL shaders, Lenis smooth scroll, requestAnimationFrame-driven effects, and a WebGL depth-of-field treatment on hero/featured imagery. Hard requirements: respects `prefers-reduced-motion`, lazy-loaded off the critical path, never blocks LCP/interaction, and the site is fully usable with WebGL disabled.
- **Phase 5 — Admin / CMS ("the back page"):** authenticated admin to manage everything without touching code: drag-and-drop upload (chunked, resumable, progress), media library with batch ops, organize into galleries/categories/locations, create & manage private client galleries (per-client access grants, expiring share links, download/favorites controls), and a layout/design manager — pick per-page layout (grid type, spacing, theme/dark-mode defaults, hero) via UI, persisted as page-config in the DB and rendered by the public site. Make layouts **data-driven, not hardcoded.**
- **Phase 6 — Integrations & hardening:** email flows (contact, gallery invites), the stubbed PaymentProvider/invoice seams, security pass (review against SECURITY.md, add tests), performance pass (Lighthouse run + fixes), caching wired per CACHING-STRATEGY.md.
- **Phase 7 — Deployment:** finalize docker-compose.yml for the NAS, document the Nginx Proxy Manager + Cloudflare Tunnel path, volumes/backups, and a one-page run-book. Provide upgrade and rollback steps.

## AI agents & skills to create in the project
Set up Claude Code subagents in `.claude/agents/` and skills in `.claude/skills/` so future work on this repo is consistent. Create at least:

**Subagents (`.claude/agents/*.md`):**
- `architecture-reviewer` — checks changes against `/docs`, flags architecture drift.
- `security-auditor` — reviews auth, uploads, access control, headers, secrets.
- `media-pipeline` — specialist for the sharp/queue/derivative/EXIF logic.
- `frontend-webgl` — specialist for the Three.js/GLSL/Lenis layer and reduced-motion fallbacks.
- `performance-lighthouse` — runs/interprets Lighthouse, enforces Core Web Vitals budgets.
- `devops-docker` — compose, env, NPM/Cloudflare Tunnel, backups.

**Skills (`.claude/skills/*`):** create reusable skills for `image-optimization` (variant/format rules), `gallery-layout` (the layout-config contract between admin and public site), and `lighthouse-audit` (how to run and what budgets to enforce). Write each with a clear description so it triggers correctly.

If a task genuinely benefits from an external model (e.g. Hugging Face for auto-tagging photos, smart alt-text for accessibility/SEO, or image upscaling), propose it in `docs/AI-INTEGRATIONS.md` with cost/privacy/self-hosting trade-offs and an abstraction so it's optional and swappable — don't wire it in without my OK.

## Acceptance criteria
- Runs end-to-end via `docker compose up` on a NAS; documented path behind Nginx Proxy Manager + Cloudflare Tunnel.
- Admin can upload (drag-and-drop), organize, build private client galleries, and change page layouts/themes without code.
- Dark mode, responsive, installable PWA, strong Lighthouse scores, accessible.
- Security: password + TOTP 2FA + passkey/biometric, login rate-limiting & lockout, access-controlled private galleries, sane CSP/headers, validated uploads.
- WebGL/shader effects enhance but never block; fully degrades.
- Payments/invoicing are stubbed behind an interface, ready to implement later.
- Every major decision is captured in `/docs`.

Begin with Phase 0 only. Produce the docs and the Plan Summary, then stop and wait for my approval.
