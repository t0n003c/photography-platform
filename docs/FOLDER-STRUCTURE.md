# Folder Structure

> Phase 0 planning document. Proposed repo layout for the self-hosted photography
> platform: **one Next.js 15 app + one BullMQ worker, same repository**, sharing
> domain modules. See [ARCHITECTURE.md](./ARCHITECTURE.md) for how these pieces relate.

## Guiding principles

- **One repo, two processes.** `web` (Next.js) and `worker` (BullMQ consumer) share
  the same `src/` domain code; they differ only at the entry point.
- **Drivers behind interfaces.** Storage, email, and payments are swappable drivers;
  call sites depend on the interface, never the concrete driver.
- **Data-driven presentation.** Gallery render config lives in `src/lib/render-config.ts`
  and page-builder block schemas live in `src/lib/blocks.ts`; new layouts/blocks are
  added through those typed contracts rather than ad hoc route JSX.
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
│   │   ├── product/[slug]/       # Product detail pages with add-to-cart actions
│   │   ├── cart/                 # Browser-local cart + manual or hosted Stripe checkout
│   │   ├── contact/              # Contact form (spam-protected)
│   │   └── g/[token]/            # Private client gallery via expiring share link
│   ├── (admin)/                  # Auth-gated admin UI (uploads, galleries, policy)
│   │   └── admin/                # Dashboard, gallery mgmt, Store, layout editor, settings
│   ├── api/                      # Route handlers — the only mutation ingress
│   │   ├── auth/                 # Better Auth handlers (password, TOTP, WebAuthn)
│   │   ├── uploads/              # Validate original, persist, enqueue process job
│   │   ├── galleries/            # Gallery + share-link CRUD, favorites
│   │   ├── contact/              # Contact form submission + spam check
│   │   ├── products/             # Public product browse/detail API
│   │   ├── cart/                 # Resolve browser cart lines against current product pricing
│   │   ├── checkout/             # Manual invoice request or hosted Stripe session
│   │   └── admin/orders/         # Admin recent manual order requests
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
│   │   └── drivers/             # minio.ts (S3-compatible; SeaweedFS default) + filesystem.ts
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
│   ├── payments/                 # PaymentProvider seam + Stripe checkout/webhook helpers
│   │   ├── provider.ts          # PaymentProvider interface + readiness types
│   │   └── drivers/            # stripe.ts
│   ├── layout-config/            # Legacy descriptor type; new work uses src/lib/render-config.ts
│   ├── validation/               # Shared Zod schemas (client/server/worker)
│   ├── redis/                    # Redis/Valkey client (sessions, cache, rate limit)
│   └── lib/                      # Cross-cutting utils (logging, env parse, helpers)
│
├── components/                   # React components (presentation)
│   ├── ui/                       # shadcn/ui primitives (headless layer)
│   ├── blocks/                   # Page-builder block renderers (gallery, banner, testimonials, etc.)
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
│   ├── compose.yaml              # Base services: web, worker, db, redis, SeaweedFS
│   ├── compose.dev.yaml          # Local dev overlay: publishes db/redis, WEB_PORT defaults to 3001
│   ├── compose.prod.yaml         # NAS/prod overlay: limits, logs, optional tunnel profile
│   ├── compose.ghcr.yaml         # Pull pre-built GHCR web/worker images
│   ├── compose.nas.yaml          # Single-file Synology/Container Manager compose
│   └── compose.override.example  # Optional local conveniences template
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

- **Gallery render config** lives in `src/lib/render-config.ts`. The older
  `src/layout-config/` descriptor remains in the tree for compatibility, but new grid
  types and preview/public rendering behavior should be wired through `render-config`
  and the gallery components.

- **Page-builder blocks** are validated in `src/lib/blocks.ts`, edited from the Pages
  tab, and rendered by `components/blocks/*`. Current examples include banners,
  galleries, contact forms, scroll showcases, logos, FAQs, columns, and testimonials.

- **Shared job contracts** in `src/queue/jobs/` are imported by both the API (producer,
  in `app/api/uploads`) and the worker (consumer, in `worker/index.ts`). Typing them
  once prevents producer/consumer drift.

- **Drivers** (`src/storage/drivers`, `src/email/drivers`, `src/payments/drivers`) sit
  behind their respective `provider.ts` interfaces. **SeaweedFS through the S3-compatible
  driver is the default storage path**; switching to the filesystem alternate, or SMTP→Resend, is a config/driver swap
  with no call-site changes. The payments seam keeps manual checkout as the fallback and
  enables Stripe Checkout sessions/webhook reconciliation when Settings -> Payments is ready.

- **`app/` is routing only.** Business logic lives in `src/`; route handlers and Server
  Components call into `src/` modules. This keeps the worker able to reuse the exact
  same domain code without dragging in Next.js routing.

- **`docker/compose.yaml`** defines `web`, `worker`, `db` (Postgres 16), `redis`,
  `seaweedfs`, and `seaweedfs-init` — all **core, always-on** services. SeaweedFS is the
  default S3-compatible media backend; NPM and the Cloudflare Tunnel are infrastructure
  external to this application stack (see ARCHITECTURE.md §6).

- **`.env.example` is committed and documented**; the real `.env` is gitignored. Both
  `web` and `worker` read the same env (DB URL, Redis URL, storage driver + path/S3
  creds, email driver creds, auth secrets).
