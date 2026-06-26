# Folder Structure

> Phase 0 planning document. Proposed repo layout for the self-hosted photography
> platform: **one Next.js 15 app + one BullMQ worker, same repository**, sharing
> domain modules. See [ARCHITECTURE.md](./ARCHITECTURE.md) for how these pieces relate.

## Guiding principles

- **One repo, two processes.** `web` (Next.js) and `worker` (BullMQ consumer) share
  the same `src/` domain code; they differ only at the entry point.
- **Drivers behind interfaces.** Storage, email, and payments are swappable drivers;
  call sites depend on the interface, never the concrete driver.
- **Config-driven layouts.** Gallery/portfolio layouts are data in `src/layout-config/`,
  not hardcoded JSX, so new arrangements are config edits.
- **Realistic, not over-engineered.** A single `src/` domain folder — no premature
  package/workspace split. Promote to a monorepo only if a second app appears.

## Tree

```text
photography-platform/
├── app/                          # Next.js 15 App Router — routing layer only
│   ├── (public)/                 # Public portfolio + client galleries (SSG/ISR)
│   │   ├── page.tsx              # Home: hero / About / Instagram-style feed
│   │   ├── portraits/            # Category route (Portraits)
│   │   ├── events/               # Category route (Events)
│   │   ├── nature/               # Category route (Nature)
│   │   ├── locations/            # Location/travel portfolio routes
│   │   ├── store/                # Light print store (browse only; checkout deferred)
│   │   ├── contact/              # Contact form (spam-protected)
│   │   └── g/[token]/            # Private client gallery via expiring share link
│   ├── (admin)/                  # Auth-gated admin UI (uploads, galleries, policy)
│   │   └── admin/                # Dashboard, gallery mgmt, layout editor, settings
│   ├── api/                      # Route handlers — the only mutation ingress
│   │   ├── auth/                 # Better Auth handlers (password, TOTP, WebAuthn)
│   │   ├── uploads/              # Validate original, persist, enqueue process job
│   │   ├── galleries/            # Gallery + share-link CRUD, favorites
│   │   ├── contact/              # Contact form submission + spam check
│   │   └── payments/             # Payment seam endpoints — STUB / DEFERRED
│   ├── layout.tsx                # Root layout (theme provider, fonts, PWA shell)
│   ├── manifest.ts               # PWA web app manifest
│   └── globals.css               # Tailwind base + global styles
│
├── src/                          # Framework-agnostic domain code (shared web+worker)
│   ├── db/                       # Database layer (Drizzle, SQL-first)
│   │   ├── schema/               # Drizzle table schemas (single source of truth)
│   │   ├── migrations/           # Generated SQL migrations (committed)
│   │   ├── queries/              # Reusable typed query helpers
│   │   └── client.ts            # Drizzle client / connection pool
│   ├── auth/                     # Better Auth config, MFA policy, session helpers
│   ├── storage/                  # StorageProvider abstraction
│   │   ├── provider.ts          # StorageProvider interface
│   │   └── drivers/             # minio.ts (S3, default) + filesystem.ts (alternate)
│   ├── image/                    # sharp pipeline: derivatives, LQIP, EXIF normalize
│   │   ├── derivatives.ts       # AVIF/WebP responsive variant generation
│   │   ├── lqip.ts              # Blur placeholder generation
│   │   └── exif.ts             # Strip/normalize EXIF (orientation kept, GPS dropped)
│   ├── queue/                    # BullMQ queue + typed job contracts
│   │   ├── queues.ts            # Queue definitions (shared producer/consumer)
│   │   └── jobs/               # Job payload types + handler logic (image, email, zip)
│   ├── email/                    # EmailProvider abstraction
│   │   ├── provider.ts          # EmailProvider interface
│   │   └── drivers/            # smtp.ts + resend.ts
│   ├── payments/                 # PaymentProvider STUB (Stripe likely later)
│   │   ├── provider.ts          # PaymentProvider interface — seams only
│   │   └── drivers/            # stripe.ts (stub, not implemented)
│   ├── layout-config/            # Config-driven gallery/portfolio layout definitions
│   ├── validation/               # Shared Zod schemas (client/server/worker)
│   ├── redis/                    # Redis/Valkey client (sessions, cache, rate limit)
│   └── lib/                      # Cross-cutting utils (logging, env parse, helpers)
│
├── components/                   # React components (presentation)
│   ├── ui/                       # shadcn/ui primitives (headless layer)
│   ├── gallery/                  # Gallery, grid, lightbox, favorites, downloads
│   ├── webgl/                    # WebGL/shader enhancement layer (degrades gracefully)
│   ├── layout/                   # Header, footer, nav, theme toggle (next-themes)
│   └── forms/                    # Contact + admin forms
│
├── worker/                       # BullMQ consumer process — no HTTP
│   └── index.ts                  # Worker entry: registers job handlers from src/queue
│
├── public/                       # Static assets (icons, PWA assets, favicons, robots)
│
├── docs/                         # Project documentation (ARCHITECTURE, this file, etc.)
│
├── docker/                       # Container + orchestration definitions
│   ├── Dockerfile.web            # Build/run image for the Next.js web process
│   ├── Dockerfile.worker         # Build/run image for the BullMQ worker process
│   ├── compose.yaml              # Services: web, worker, db, redis, minio (core/default)
│   └── compose.override.example  # Local/dev overrides template
│
├── scripts/                      # Ops/dev scripts (seed, backup, migrate, healthcheck)
│
├── tests/                        # Test suites
│   ├── unit/                     # Domain/unit tests (image, validation, drivers)
│   ├── integration/              # DB/queue/storage integration tests
│   └── e2e/                      # End-to-end (auth, gallery access, upload flow)
│
├── .claude/                      # Claude Code workspace config
│   ├── agents/                   # Subagent definitions (placeholder)
│   └── skills/                   # Project skills (placeholder)
│
├── drizzle.config.ts             # Drizzle Kit config (schema path, migrations out dir)
├── next.config.ts                # Next.js config (images, Serwist PWA, headers)
├── serwist.config.ts             # Serwist service worker config (offline + thumb cache)
├── tailwind.config.ts            # Tailwind theme/tokens (dark mode class strategy)
├── components.json               # shadcn/ui generator config
├── tsconfig.json                 # TypeScript config (path aliases to src/)
├── package.json                  # Scripts: dev, build, worker, db:*, test
├── .env.example                  # Documented env template (committed)
├── .env                          # Local secrets (gitignored)
└── README.md                     # Repo entry doc
```

## Notes on key locations

- **Config-driven gallery layouts** live in `src/layout-config/`. These are typed
  layout descriptors (grid styles, masonry/justified arrangements, cover behavior,
  ordering) consumed by `components/gallery/`. Adding a layout = adding config, not
  rewriting components.

- **Shared job contracts** in `src/queue/jobs/` are imported by both the API (producer,
  in `app/api/uploads`) and the worker (consumer, in `worker/index.ts`). Typing them
  once prevents producer/consumer drift.

- **Drivers** (`src/storage/drivers`, `src/email/drivers`, `src/payments/drivers`) sit
  behind their respective `provider.ts` interfaces. **SeaweedFS through the S3-compatible
  driver is the default storage path**; switching to the filesystem alternate, or SMTP→Resend, is a config/driver swap
  with no call-site changes. The payments driver is a **stub**: the interface and seams
  exist, the implementation does not.

- **`app/` is routing only.** Business logic lives in `src/`; route handlers and Server
  Components call into `src/` modules. This keeps the worker able to reuse the exact
  same domain code without dragging in Next.js routing.

- **`docker/compose.yaml`** defines `web`, `worker`, `db` (Postgres 16), `redis`
  (Redis/Valkey), and `minio` — all **core, always-on** services (`minio` is the default
  media-storage backend, not profile-gated). NPM and the Cloudflare Tunnel are
  infrastructure external to this application stack (see ARCHITECTURE.md §6).

- **`.env.example` is committed and documented**; the real `.env` is gitignored. Both
  `web` and `worker` read the same env (DB URL, Redis URL, storage driver + path/S3
  creds, email driver creds, auth secrets).
