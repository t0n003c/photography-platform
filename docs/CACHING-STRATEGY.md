# CACHING-STRATEGY.md — Phase 0 Caching Plan

> Self-hosted photography platform behind Cloudflare Tunnel + NPM.
> Layered caching with explicit WHAT / TTL / INVALIDATION per layer.

**Hard rule up front:** *private client-gallery content must NEVER be cached at any shared layer*
(Cloudflare edge, public Redis caches, or proxy caches). See §7.

Layers, outermost to innermost:

1. Cloudflare edge (CDN)
2. App-level (Next.js ISR / route segment / fetch cache / `'use cache'`)
3. Redis/Valkey (sessions, rate limits, hot queries, computed configs)
4. Image-variant cache (derivatives generated once by the worker)
5. Browser / PWA (Serwist service worker)

---

## 1. Cloudflare Edge (CDN)

**What is cached:**
- Hashed static assets (`/_next/static/*`, fonts, JS/CSS bundles) — content-hashed filenames.
- Public image **variants** (thumbnails/derivatives) served with content-hash/immutable URLs.
- Public marketing/portfolio pages that are safe to share across all anonymous users.

**TTLs / headers:**
- Hashed immutable assets: `Cache-Control: public, max-age=31536000, immutable`.
- Public image variants: `public, max-age=31536000, immutable` (URL changes when content changes).
- Public HTML pages: short edge TTL (e.g. `s-maxage=60`, `stale-while-revalidate=300`) so publishes
  propagate quickly, OR cached indefinitely and **purged on publish** (preferred for portfolio).
- Never cache: anything with a session cookie, `/api/*` auth/mutation routes, admin routes, and all
  private gallery content (`Cache-Control: private, no-store`).

**Invalidation triggers:**
- **Purge on publish**: when an admin publishes/edits a public page or portfolio item, the app
  issues a Cloudflare cache **purge** (by URL/tag) for affected paths.
- Hashed assets self-invalidate (new hash = new URL) — no purge needed; old URLs simply age out.
- A deploy that changes the asset manifest produces new hashed URLs automatically.

---

## 2. App-Level (Next.js)

**What is cached:**
- **ISR / route segment cache**: statically rendered public portfolio pages and public listings.
- **`fetch` cache / `'use cache'`**: data reads for public pages (gallery indexes, page content,
  print-store catalog) tagged for targeted revalidation.
- Admin and private routes are **dynamic / uncached** (`no-store`, `dynamic = 'force-dynamic'`
  where appropriate).

**TTLs:**
- Public portfolio/listing segments: time-based `revalidate` (e.g. 60–300s) as a safety net, with
  on-demand revalidation as the primary mechanism.
- Catalog/print-store: similar short revalidate plus on-demand on price/inventory changes.

**Invalidation triggers (primary = on-demand):**
- `revalidateTag('gallery:<id>')` / `revalidateTag('portfolio')` after an admin edits/publishes.
- `revalidatePath('/work/<slug>')` for specific routes.
- Tag taxonomy (suggested): `portfolio`, `gallery:<id>`, `page:<slug>`, `catalog`,
  `print:<id>`. Mutations call the matching tag(s) so only affected pages rebuild.
- Time-based `revalidate` covers anything missed by explicit triggers.

---

## 3. Redis / Valkey

Key-naming convention: `<domain>:<purpose>:<identifier>` with a deployment/version prefix where
useful. TTLs always set; nothing immortal except where explicitly intended.

| Purpose | Key pattern | TTL | Invalidation |
|---------|-------------|-----|--------------|
| Sessions | `sess:<id>` | sliding idle + absolute cap | delete on logout/revoke/password change |
| Rate-limit counters | `rl:<action>:<ip|acct>` | window length (sec–min) | expire naturally |
| Lockout state | `lock:acct:<id>` | cooldown window | delete on admin/user unlock |
| Hot query: public gallery listing | `q:gallery:list:<scope>` | short (30–120s) | delete/`revalidateTag` on gallery mutation |
| Hot query: portfolio index | `q:portfolio:index` | short (60–300s) | delete on publish |
| Computed layout config | `cfg:layout:<page>` | medium (5–15m) | delete on layout/admin edit |
| Catalog/price snapshot | `q:catalog:<scope>` | short (60s) | delete on price/inventory change |

**What is cached:** sessions, rate-limit/lockout counters, **hot query results** (gallery listings,
portfolio index), and **computed layout configs** (e.g. masonry/grid layout math, ordering).

**Invalidation:** on any mutation that affects the underlying data, the writing path deletes the
relevant keys (cache-aside / write-invalidate). For private galleries, only **non-content** metadata
needed for authorization may be cached, and **never** the private image bytes or private listings at
a shared key without scoping to the authorized principal.

---

## 4. Image-Variant Cache

**Model:** originals are uploaded and **preserved** as-is; the **BullMQ + sharp worker** generates
derivatives (thumbnails, responsive sizes, web formats) **once**, then stores them via the
StorageProvider (SeaweedFS/S3-compatible default / filesystem alternate).

**Originals vs variants:**
- **Originals**: stored, never served raw, never publicly cached; access-controlled (may retain
  EXIF). Served only to authorized parties through the app.
- **Variants**: re-encoded, EXIF-stripped (for public), addressed by **content-hash filenames** so
  the URL is stable-per-content and changes when the image changes.

**Serving / TTL:**
- Variants served with `Cache-Control: public, max-age=31536000, immutable` — safe because the
  filename is a content hash. Generated once, cached forever at edge + browser.
- **Private** gallery variants are an exception: served through the authorized handler with
  `Cache-Control: private, no-store` and never placed at a shared cache (§7).

**Invalidation:**
- Re-processing an image (crop/replace) yields a **new content hash → new URL**; old variant URLs
  are abandoned and aged out. No active purge needed for public immutable variants.
- Deleting an image removes originals + variants from storage; any references are revoked.

---

## 5. Browser / PWA (Serwist)

**Precache (app shell):** Serwist precaches the app shell + hashed build assets at install; updated
on each deploy via the generated precache manifest (revisioned).

**Runtime caching strategies by resource type:**

| Resource | Strategy | Rationale |
|----------|----------|-----------|
| Hashed JS/CSS/font assets (`/_next/static/*`) | **Cache-first** | content-hashed, immutable |
| Public image thumbnails/variants | **Stale-while-revalidate** | fast paint, refresh in background |
| API / data reads | **Network-first** (with timeout fallback) | freshness matters; cache as fallback |
| Mutations / auth / private gallery | **Network-only / NetworkOnly** | never cache; must hit server |
| HTML navigations (public) | Network-first or SWR | balance freshness vs offline |

**Versioning / cache busting on deploy:**
- New deploy → new precache manifest revision → Serwist installs the new SW, then activates and
  **clears stale precaches** (cleanup of outdated caches).
- Hashed asset URLs change on content change, so runtime cache-first entries self-bust.
- Use `skipWaiting`/`clientsClaim` carefully (prompt-to-update UX recommended) to avoid serving a
  half-updated shell.
- **Private gallery responses are excluded from all SW caching** (NetworkOnly route rules).

---

## 6. Content Type → Layer → TTL → Invalidation (master table)

| Content type | Cloudflare edge | App (Next) | Redis | Image-variant | Browser/PWA | Invalidation trigger |
|--------------|-----------------|------------|-------|---------------|-------------|----------------------|
| Hashed static assets (`/_next/static`) | 1y immutable | n/a | n/a | n/a | cache-first | new build hash |
| Public image variants (content-hash) | 1y immutable | n/a | listing only | stored once, 1y immutable | SWR | new content hash / delete |
| Public portfolio/landing pages | short s-maxage or purge-on-publish | ISR + tags | `q:portfolio:index` short | n/a | network-first/SWR | publish → purge + `revalidateTag` |
| Public gallery listings | short s-maxage | tagged fetch cache | `q:gallery:list:*` 30–120s | n/a | network-first | gallery mutation → tag + Redis delete |
| Print-store catalog | short | tagged | `q:catalog:*` 60s | n/a | network-first | price/inventory change |
| Computed layout config | not at edge | n/a | `cfg:layout:*` 5–15m | n/a | n/a | layout/admin edit |
| Auth/API mutations | never | dynamic/no-store | rate-limit/session keys | n/a | network-only | n/a |
| Sessions | never | n/a | `sess:*` idle+absolute | n/a | never | logout/revoke |
| **Private gallery pages/images** | **never (no-store)** | **dynamic/no-store** | **no shared cache** | **private/no-store** | **network-only** | per-request authorization (§7) |

---

## 7. Explicit Rule: Private Client-Gallery Content Must NOT Be Shared-Cached

Private galleries are authorized per request (share token + optional gallery password + grant). Such
content must never be served from a cache that could leak it to a different principal.

**How to mark it:**
- Response headers: `Cache-Control: private, no-store, max-age=0, must-revalidate`. Use `private`
  (not `public`) and `no-store` so neither Cloudflare nor any shared proxy retains it.
- Add `Vary: Cookie, Authorization` (and any token header) so caches key on the credential and
  cannot serve one client's response to another. Prefer `no-store` over relying on `Vary` alone.
- **Cloudflare**: ensure cache rules exclude all private gallery paths; presence of a session/gallery
  cookie should bypass the cache. Do not put private content behind cacheable, guessable URLs.
- **Next.js**: render private routes dynamically (`no-store` fetches, `dynamic = 'force-dynamic'`);
  never `revalidate` private data into a shared ISR artifact.
- **Redis**: do not cache private image bytes or private listings under a shared key; any
  authorization metadata cached must be scoped to the authorized principal and short-TTL.
- **Image variants**: private variants served through the authorized handler with `private, no-store`,
  even though they are content-hashed — possession of the hash must not grant access (no IDOR; see
  SECURITY.md §7).
- **PWA/Serwist**: private gallery routes/assets use NetworkOnly; never precached or runtime-cached.

**Audit cross-check:** the security-auditor checklist (SECURITY.md §9) includes verifying that no
private content appears in any shared cache and that the headers above are present on every private
gallery response.
