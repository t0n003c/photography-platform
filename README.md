# Photography Platform

Self-hosted photography **portfolio + private client galleries + light print store**,
replacing a WordPress/WooCommerce site. Built to run on a NAS behind Nginx Proxy
Manager + a Cloudflare Tunnel.

> **Status:** Phase 1 — Scaffold. The app boots, dark mode works, and the full
> service topology (web · worker · postgres · redis · minio) comes up under Docker
> Compose. Core data, auth, the media pipeline, and the public site arrive in
> later phases. See [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind + shadcn/ui · PostgreSQL 16 +
Drizzle · Better Auth · Redis + BullMQ worker · sharp · MinIO (S3) storage ·
Serwist PWA. Full rationale in [`docs/TECH-STACK.md`](docs/TECH-STACK.md).

## Local development

```bash
cp .env.example .env       # fill in / keep dev defaults
npm install
npm run dev                # http://localhost:3000
```

Supporting services for local dev (Postgres / Redis / MinIO):

```bash
docker compose -f docker/compose.yaml --env-file .env up -d db redis minio minio-init
```

## Run the full stack in Docker

```bash
cp .env.example .env
docker compose -f docker/compose.yaml --env-file .env up --build
```

- Web: http://localhost:3000  ·  health: http://localhost:3000/api/health
- MinIO console: http://localhost:9001

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run worker` | Run the BullMQ worker locally |
| `npm run lint` / `npm run format` | Lint / format |
| `npm run typecheck` | TypeScript check (no emit) |
| `npm run db:generate` / `db:migrate` | Drizzle migrations (Phase 2+) |

## Repository layout

See [`docs/FOLDER-STRUCTURE.md`](docs/FOLDER-STRUCTURE.md). In short:
`app/` is routing only, `src/` holds framework-agnostic domain code shared by the
web and worker processes, `components/` is presentation, `worker/` is the queue
consumer, and `docker/` holds the Compose + Dockerfiles.

## Documentation

Architecture, data model, API, security, caching, media, performance, deployment
and decisions all live in [`docs/`](docs/).
