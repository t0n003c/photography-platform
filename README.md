# Photography Platform

Self-hosted photography **portfolio + private client galleries + light print store**,
replacing a WordPress/WooCommerce site. Runs on a NAS behind Nginx Proxy Manager + a
Cloudflare Tunnel.

> **New here (human or AI agent)?** Read **[`PROJECT_MEMORY.md`](PROJECT_MEMORY.md)**
> (full project handoff: architecture, decisions, bugs, conventions, unfinished work) and
> **[`AGENTS.md`](AGENTS.md)** (how to work in this repo). Deep docs live in [`docs/`](docs/);
> the founding brief is [`docs/PROJECT-BRIEF.md`](docs/PROJECT-BRIEF.md).

## Status

Core platform is **built and running**: auth (password + TOTP 2FA + passkeys), the
upload→`sharp`→derivatives media pipeline, the public portfolio (categories + locations)
with multiple gallery layouts, private client galleries with expiring share links, and a
full admin **CMS** (upload, library, galleries, page builder, layout/design editor,
settings, menus). The page builder includes curated blocks such as galleries, banners,
contact forms, scroll showcases, logos/FAQs, and testimonials. Store checkout supports
**manual invoice requests**, receipts, fulfillment tracking, refund tracking, and optional
Stripe Checkout from Settings -> Payments only when the account, keys, and webhook secret are configured.
Stripe test-mode validation is documented in [`docs/STRIPE-TEST-RUNBOOK.md`](docs/STRIPE-TEST-RUNBOOK.md). See
[`docs/ROADMAP.md`](docs/ROADMAP.md) and `PROJECT_MEMORY.md` §12 for what's left.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind + shadcn/ui · PostgreSQL 16 + Drizzle ·
Better Auth · Redis + BullMQ worker · `sharp` · SeaweedFS (S3) storage · Serwist PWA ·
GSAP/Lenis/Three.js (progressive enhancement). Rationale: [`docs/TECH-STACK.md`](docs/TECH-STACK.md).

## Architecture in one line

Two stateless processes share one `src/` domain codebase: **`web`** (Next.js: public +
admin + API) and **`worker`** (BullMQ consumer: image/email/video jobs). State lives in
Postgres, Redis, and an S3-compatible object store. Details: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Quick start (local development)

```bash
cp .env.example .env        # fill in / keep dev defaults (never commit .env)
npm install
```

**Run the full stack in Docker (recommended — this is how the app actually runs).**
The web container is served on **http://localhost:3001** (`WEB_PORT`):

```bash
cd docker
docker compose -p photography-platform --env-file ../.env \
  -f compose.yaml -f compose.dev.yaml up -d --build
```

After editing code, rebuild just the web image:

```bash
docker compose -p photography-platform --env-file ../.env \
  -f compose.yaml -f compose.dev.yaml build web && \
docker compose -p photography-platform --env-file ../.env \
  -f compose.yaml -f compose.dev.yaml up -d web
```

- Web: http://localhost:3001 · health: http://localhost:3001/api/health
- Admin: http://localhost:3001/admin (auth-gated; 307→/login when logged out)
- Clear caches if needed: `docker exec photography-platform-redis-1 redis-cli FLUSHALL`

(`npm run dev` runs Next.js standalone on :3000 against external services, but the
canonical local target is the Docker `:3001` stack above.)

## Scripts

| Command                                                        | Purpose                                                                               |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `npm run dev` / `build` / `start`                              | Next.js dev / production build / serve                                                |
| `npm run worker` / `worker:dev`                                | BullMQ worker (run / watch)                                                           |
| `npm run typecheck` / `lint` / `format`                        | TS check / lint / Prettier                                                            |
| `npm test` / `test:watch`                                      | Vitest unit tests                                                                     |
| `npm run test:e2e`                                             | Playwright end-to-end (`E2E_BASE_URL=http://localhost:3001` for the Docker dev stack) |
| `npm run db:generate` / `db:migrate` / `db:studio` / `db:seed` | Drizzle migrations / studio / seed                                                    |

## Repository layout (short)

`app/` routing only · `src/` framework-agnostic domain code shared by web+worker ·
`components/` presentation · `worker/` queue consumer · `docker/` Compose + Dockerfiles ·
`docs/` long-form docs + ADRs · `.claude/` reusable agent skills/subagents. Full tree:
[`docs/FOLDER-STRUCTURE.md`](docs/FOLDER-STRUCTURE.md).

## Deployment

Images publish to GHCR via GitHub Actions on push to `main`; the GitHub repo is public,
so standard GitHub-hosted Actions minutes for these public workflows should be free. The
NAS pulls the published images (Dockge / Container Manager) behind Cloudflare Tunnel →
Nginx Proxy Manager. Volumes, backups, upgrade/rollback:
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Conventions

Commit directly to `main` (no PRs); **push only when the owner asks** so deploys stay
intentional.
No secrets in code (`.env` only). Layouts are data-driven, not hardcoded. Animations are
progressive enhancement (reduced-motion + no-JS fallbacks). Full set: `AGENTS.md` and
[`docs/DEV-WORKFLOW.md`](docs/DEV-WORKFLOW.md).
