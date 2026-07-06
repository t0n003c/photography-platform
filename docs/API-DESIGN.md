# API Design — Phase 0 Planning

> **Status:** Phase 0 planning artifact. No application code yet. Defines the API surface,
> auth boundaries, conventions, and protocols for the self-hosted photography platform.
> Companion to [`DATA-MODEL.md`](./DATA-MODEL.md).

---

## 1. Style Decision

**Primary style: REST via Next.js 15 App Router Route Handlers** under `/api`. Resource-
oriented paths, standard HTTP verbs, JSON request/response bodies. This keeps a clean,
documentable, client-agnostic surface that the PWA, the public site, and any future mobile/CLI
client can consume uniformly.

**Server Actions for admin mutations.** Admin UI form mutations (create gallery, edit
page-config, reorder photos, manage grants) are implemented primarily as **React Server
Actions**, not REST. They run inside the authenticated admin session, get progressive
enhancement and CSRF protection for free, and avoid hand-rolled fetch glue. Where a mutation
also needs to be callable by non-form clients (e.g. the chunked uploader, the worker, external
automation), it is **additionally** exposed as a Route Handler. Read paths and all
public/client-gallery access are Route Handlers (cacheable, cursor-paginated, token-auth'd).

Rule of thumb:

- **Read / public / client-gallery / upload protocol / webhooks** → Route Handlers (`/api/...`).
- **Admin form mutations** → Server Actions (with REST mirror only when an external caller needs it).

**Versioning.** URL-prefixed major versioning: `/api/v1/...`. v1 is the contract; breaking
changes ship under `/api/v2`. Additive, backward-compatible changes stay in v1. Better Auth's
mounted routes live under `/api/auth/*` (its own convention) and are **not** versioned by us.
Responses include an `API-Version` header. Auth scope below is described against the `v1` tree.

---

## 2. Auth Boundaries

Three trust tiers; every endpoint declares exactly one.

| Tier               | Who                | Credential                                                | Enforced by                                           |
| ------------------ | ------------------ | --------------------------------------------------------- | ----------------------------------------------------- |
| **public**         | anonymous visitors | none                                                      | no auth; only published/public data exposed           |
| **client-gallery** | gallery recipients | **share token** (→ active grant), optional grant password | token-hash lookup + grant validity + permission flags |
| **admin**          | owner/admin/staff  | Better Auth **session**                                   | session validation + role check                       |

### 2.1 Public

No authentication. Handlers serve only rows where `visibility='public'` and `status='published'`
and `deleted_at IS NULL`. Private galleries, drafts, EXIF GPS (per policy), and originals are
never reachable on the public tier. Public reads are cache-friendly (CDN/edge cacheable with
revalidation).

### 2.2 Client-gallery (share-token / grant)

- The share URL carries an opaque high-entropy token (e.g. `/g/{token}` → resolves to a grant).
- Server hashes the inbound token (SHA-256) and looks up `gallery_access_grant.token_hash`.
- Grant must be **active**: `revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())`.
- If `password_hash` is set on the grant (or gallery), a password exchange establishes a
  short-lived **gallery session cookie** scoped to that grant (so the password isn't re-sent).
- Every action is checked against the grant's permission flags: `can_view`, `can_favorite`,
  `can_download`. Missing permission → `403`.
- All client-gallery requests carry the grant context server-side; clients never receive admin
  data or other grants' favorites.

### 2.3 Admin (session + role)

- Better Auth session (cookie) validated on every request; unauthenticated → `401`.
- Role gate from `user.role`: `owner` > `admin` > `staff`.
  - `staff`: upload, media library, limited gallery edits.
  - `admin`: all content + client + grant management.
  - `owner`: admin + user/role management + destructive/config ops.
- Sensitive operations may additionally require recent 2FA (step-up), per Better Auth config.
- Admin mutating Route Handlers require CSRF protection (Server Actions handle this natively).

---

## 3. Conventions

### 3.1 Pagination — cursor-based for media lists

Media lists (gallery photos, library, collection/location photos) use **opaque cursor / keyset
pagination**, not offset.

**Justification:** photo lists are large, frequently appended to, and rendered in stable
display order. Offset pagination (`LIMIT/OFFSET`) degrades on deep pages (the DB still scans
skipped rows) and **skips or duplicates** items when rows are inserted/reordered mid-scroll —
unacceptable for an infinite-scroll gallery grid. Keyset pagination on the indexed composite
`(sort_order, id)` (or `(created_at, id)` for the admin library) is O(log n) per page,
stable under inserts, and maps directly to the composite indexes in DATA-MODEL §16.

Request: `?limit=50&cursor=<opaque>`. Response envelope:

```json
{
  "data": [
    /* items */
  ],
  "page": { "nextCursor": "eyJzIjo0MiwiaWQiOiIwMUoifQ", "hasMore": true, "limit": 50 }
}
```

`nextCursor` is a base64url-encoded `{ sort_order, id }` (or `{ created_at, id }`); `null` when
exhausted. `limit` is clamped (default 50, max 200).

Small bounded lists (categories, locations, page-configs) return full arrays, no pagination.

### 3.2 Filtering / sorting

- Filtering via explicit query params, allow-listed per endpoint: e.g.
  `?categoryId=`, `?locationId=`, `?status=`, `?processing=`.
- Sorting via `?sort=` from an allow-list: `manual` (default, uses `sort_order`),
  `capturedAt`, `createdAt`, with `?order=asc|desc`. Unknown sort keys → `400`.
- Filters are AND-combined. No arbitrary/free-form query expressions (injection surface).

### 3.3 Standard error format (JSON Problem-style)

All non-2xx responses share one shape:

```json
{
  "error": {
    "code": "GRANT_EXPIRED",
    "message": "This gallery link has expired.",
    "details": [{ "field": "token", "issue": "expired" }],
    "requestId": "01J9Z8Q7X3K2M5"
  }
}
```

- `code` — stable machine-readable string (SCREAMING_SNAKE).
- `message` — human-safe, no internal/stack leakage.
- `details` — optional array (validation field errors, etc.).
- `requestId` — correlates with server logs; also returned as `X-Request-Id` header.

**HTTP status conventions:** `200` OK, `201` created, `202` accepted (async: zip build, upload
finalize), `204` no content; `400` validation, `401` unauthenticated, `403` forbidden
(authenticated but lacks permission / grant lacks flag), `404` not found (also returned instead
of `403` to avoid leaking existence of private resources), `409` conflict (slug/sku collision,
idempotency), `410` gone (revoked/expired grant or expired zip), `413` payload too large,
`415` unsupported media type, `422` semantic validation, `429` rate-limited (+ `Retry-After`),
`500` internal, `503` dependency down (Redis/DB/storage).

### 3.4 Idempotency

Mutating Route Handlers that create resources accept an `Idempotency-Key` header (especially
upload `complete` and order creation). Re-submitting the same key returns the original result.

---

## 4. Endpoint Catalog

Base: `/api/v1` unless noted. `[public]` `[client]` `[admin:role]` denote auth tier.

### 4.1 Auth — delegated to Better Auth (`/api/auth/*`, unversioned)

These are **mounted and owned by Better Auth**; we do not reimplement them. Representative set:

| Method | Path                             | Purpose                            |
| ------ | -------------------------------- | ---------------------------------- |
| POST   | `/api/auth/sign-in/email`        | password sign-in                   |
| POST   | `/api/auth/sign-up/email`        | create admin (gated/seed only)     |
| POST   | `/api/auth/sign-out`             | end session                        |
| GET    | `/api/auth/get-session`          | current session                    |
| POST   | `/api/auth/two-factor/enable`    | enroll TOTP                        |
| POST   | `/api/auth/two-factor/verify`    | verify TOTP code                   |
| POST   | `/api/auth/two-factor/disable`   | remove 2FA                         |
| POST   | `/api/auth/passkey/register`     | begin/finish WebAuthn registration |
| POST   | `/api/auth/passkey/authenticate` | passkey sign-in                    |
| POST   | `/api/auth/forget-password`      | request reset                      |
| POST   | `/api/auth/reset-password`       | complete reset                     |
| POST   | `/api/auth/verify-email`         | email verification                 |

Rate-limiting + lockout for these is enforced by Better Auth (Redis-backed). See §5.

### 4.2 Public Portfolio `[public]`

| Method | Path                        | Notes                                                     |
| ------ | --------------------------- | --------------------------------------------------------- |
| GET    | `/categories`               | list published collections (ordered)                      |
| GET    | `/categories/{slug}`        | category detail + cover                                   |
| GET    | `/categories/{slug}/photos` | cursor-paginated photos in category                       |
| GET    | `/locations`                | list published locations                                  |
| GET    | `/locations/{slug}`         | location detail                                           |
| GET    | `/locations/{slug}/photos`  | cursor-paginated photos in location                       |
| GET    | `/galleries`                | list **public, published** galleries                      |
| GET    | `/galleries/{slug}`         | public gallery detail + page-config                       |
| GET    | `/galleries/{slug}/photos`  | cursor-paginated public gallery photos                    |
| GET    | `/photos/{id}`              | single public photo (+ variants manifest)                 |
| GET    | `/page-config/{scope}`      | resolved page-config for a public scope (home/about/etc.) |

**Example — `GET /api/v1/categories/nature/photos?limit=24`**

```json
{
  "data": [
    {
      "id": "01J9...",
      "altText": "Aspen grove at dusk",
      "width": 6000,
      "height": 4000,
      "dominantColor": "#3a4a2f",
      "blurhash": "LKO2?U%2Tw=w]~RBVZRi};RPxuwH",
      "lqip": "data:image/webp;base64,UklGR...",
      "variants": [
        {
          "format": "avif",
          "sizeBucket": "medium",
          "width": 1200,
          "height": 800,
          "url": "/media/01J9.../medium.avif"
        },
        {
          "format": "webp",
          "sizeBucket": "medium",
          "width": 1200,
          "height": 800,
          "url": "/media/01J9.../medium.webp"
        }
      ]
    }
  ],
  "page": { "nextCursor": "eyJzIjoyNCwiaWQiOiIwMUo5In0", "hasMore": true, "limit": 24 }
}
```

### 4.3 Client Gallery `[client]` (share-token)

| Method | Path                                   | Auth check                                                    |
| ------ | -------------------------------------- | ------------------------------------------------------------- |
| POST   | `/g/{token}/unlock`                    | exchange grant password → gallery session                     |
| GET    | `/g/{token}`                           | grant active + `can_view`; returns gallery meta + page-config |
| GET    | `/g/{token}/photos`                    | `can_view`; cursor-paginated photos                           |
| GET    | `/g/{token}/favorites`                 | `can_view`; this grant's favorites                            |
| PUT    | `/g/{token}/photos/{photoId}/favorite` | `can_favorite`; idempotent add                                |
| DELETE | `/g/{token}/photos/{photoId}/favorite` | `can_favorite`; idempotent remove                             |
| POST   | `/g/{token}/download`                  | `can_download`; single or zip request                         |
| GET    | `/g/{token}/download/{downloadId}`     | poll zip build status / get link                              |

**Example — `POST /api/v1/g/{token}/download`** (request a zip of favorites)

```json
{ "kind": "zip", "selection": "favorites", "variant": "large" }
```

Response `202 Accepted`:

```json
{
  "download": {
    "id": "01J9...",
    "status": "building",
    "kind": "zip",
    "jobId": "bull:zip:8821"
  },
  "poll": "/api/v1/g/abc123/download/01J9..."
}
```

When ready, the poll endpoint returns `status: "ready"` with a short-lived signed URL
(`expires_at`), backed by the `download` table (DATA-MODEL §11). Single-photo downloads
(`kind: "single"`) may return `200` directly with the link.

### 4.4 Admin — Uploads (chunked/resumable) `[admin:staff]`

See §6 for the full handshake.

| Method | Path                                       | Purpose                                   |
| ------ | ------------------------------------------ | ----------------------------------------- |
| POST   | `/admin/uploads/init`                      | begin upload, get `uploadId` + chunk plan |
| PUT    | `/admin/uploads/{uploadId}/chunks/{index}` | upload one chunk                          |
| GET    | `/admin/uploads/{uploadId}`                | status / which chunks received (resume)   |
| POST   | `/admin/uploads/{uploadId}/complete`       | finalize → enqueue BullMQ pipeline        |
| DELETE | `/admin/uploads/{uploadId}`                | abort, clean temp parts                   |

### 4.5 Admin — Media Library `[admin:staff]`

| Method | Path                           | Purpose                                                             |
| ------ | ------------------------------ | ------------------------------------------------------------------- |
| GET    | `/admin/photos`                | cursor list (filter: `processing`, `categoryId`, `locationId`, `q`) |
| GET    | `/admin/photos/{id}`           | full photo incl. EXIF + variants + memberships                      |
| PATCH  | `/admin/photos/{id}`           | edit alt text, capture date, category/location membership           |
| DELETE | `/admin/photos/{id}`           | soft delete                                                         |
| POST   | `/admin/photos/{id}/reprocess` | re-run pipeline (enqueue)                                           |

### 4.6 Admin — Galleries `[admin:admin]` (staff: limited edits)

| Method | Path                                   | Purpose                                       |
| ------ | -------------------------------------- | --------------------------------------------- |
| GET    | `/admin/galleries`                     | list (filter status/visibility)               |
| POST   | `/admin/galleries`                     | create                                        |
| GET    | `/admin/galleries/{id}`                | detail                                        |
| PATCH  | `/admin/galleries/{id}`                | edit meta, cover, page-config, expiry, status |
| DELETE | `/admin/galleries/{id}`                | soft delete                                   |
| PUT    | `/admin/galleries/{id}/photos`         | set membership + sort order (bulk)            |
| PATCH  | `/admin/galleries/{id}/photos/reorder` | reorder (sort_order patch)                    |

### 4.7 Admin — Access Grants `[admin:admin]`

| Method | Path                             | Purpose                                   |
| ------ | -------------------------------- | ----------------------------------------- |
| GET    | `/admin/galleries/{id}/grants`   | list grants for a gallery                 |
| POST   | `/admin/galleries/{id}/grants`   | create grant → returns **raw token once** |
| PATCH  | `/admin/grants/{grantId}`        | edit permissions/expiry/password          |
| POST   | `/admin/grants/{grantId}/revoke` | revoke (sets `revoked_at`)                |
| POST   | `/admin/grants/{grantId}/rotate` | rotate token (invalidate old, return new) |

**Example — `POST /api/v1/admin/galleries/{id}/grants`** request:

```json
{
  "clientId": "01J9...",
  "label": "Smith wedding — gallery 1",
  "permissions": { "view": true, "favorite": true, "download": true },
  "password": "optional-passphrase",
  "expiresAt": "2026-09-01T00:00:00Z"
}
```

Response `201` (raw token shown exactly once):

```json
{
  "grant": {
    "id": "01J9...",
    "galleryId": "01J8...",
    "expiresAt": "2026-09-01T00:00:00Z"
  },
  "shareUrl": "https://studio.example/g/Zt9...raw...token",
  "tokenShownOnce": true
}
```

### 4.8 Admin — Layout / Page-Config `[admin:admin]`

| Method | Path                                   | Purpose                             |
| ------ | -------------------------------------- | ----------------------------------- |
| GET    | `/admin/layouts`                       | layout type catalog                 |
| GET    | `/admin/page-configs`                  | list (filter `scope`)               |
| POST   | `/admin/page-configs`                  | create config for a scope           |
| GET    | `/admin/page-configs/{id}`             | detail                              |
| PATCH  | `/admin/page-configs/{id}`             | edit grid/spacing/theme/hero/config |
| POST   | `/admin/page-configs/{id}/set-default` | make default for its scope          |

### 4.9 Admin — Categories & Locations `[admin:admin]`

| Method       | Path                        | Purpose       |
| ------------ | --------------------------- | ------------- |
| GET/POST     | `/admin/categories`         | list / create |
| PATCH/DELETE | `/admin/categories/{id}`    | edit / remove |
| PATCH        | `/admin/categories/reorder` | reorder       |
| GET/POST     | `/admin/locations`          | list / create |
| PATCH/DELETE | `/admin/locations/{id}`     | edit / remove |
| PATCH        | `/admin/locations/reorder`  | reorder       |

### 4.10 Admin — Clients & Audit `[admin:admin]`

| Method           | Path                  | Purpose                                                 |
| ---------------- | --------------------- | ------------------------------------------------------- |
| GET/POST         | `/admin/clients`      | list / create lightweight client                        |
| GET/PATCH/DELETE | `/admin/clients/{id}` | detail / edit / soft delete                             |
| GET              | `/admin/audit-log`    | cursor-paginated audit log (filter actor/action/entity) |
| GET              | `/admin/contact`      | list contact submissions (filter status/verdict)        |
| PATCH            | `/admin/contact/{id}` | update status (read/replied/archived)                   |

### 4.11 Contact Form `[public]`

| Method | Path       | Purpose                                       |
| ------ | ---------- | --------------------------------------------- |
| POST   | `/contact` | submit message (spam-protected, rate-limited) |

**Example — `POST /api/v1/contact`**

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "subject": "Wedding inquiry",
  "message": "Hi, do you cover September dates in Colorado?",
  "company": "",
  "_ts": 1718323200000,
  "captchaToken": "0.AbC..."
}
```

`company` is a **honeypot** (must be empty); `_ts` enables a min-fill-time heuristic;
`captchaToken` is verified server-side. Combined into `spam_score`/`spam_verdict`
(DATA-MODEL §15). Success: `202`. High spam score: store as `spam`, return `202` anyway
(don't tip off bots), do not email admin.

### 4.12 Store / checkout `[public]` / `[admin]`

> Product browse/cart/order-request are live. Public checkout stays manual unless
> Settings -> Payments is fully Stripe-ready; then cart orders and issued invoices can
> create hosted Stripe Checkout sessions.

| Method       | Path                             | Auth   | Purpose                                                                                                                         |
| ------------ | -------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| GET          | `/products`                      | public | list active products                                                                                                            |
| GET          | `/products/{id}`                 | public | product detail                                                                                                                  |
| POST         | `/cart`                          | public | resolve browser-local cart lines, selected options, and current active product pricing                                          |
| POST         | `/checkout`                      | public | creates a manual invoice request, or a Stripe Checkout session + pending order/invoice when hosted payments are ready           |
| POST         | `/invoices/{token}/checkout`     | public | creates a Stripe Checkout session for an issued public invoice token                                                            |
| POST         | `/webhooks/stripe`               | public | verifies Stripe signatures and reconciles paid/expired Checkout sessions plus refund status updates                             |
| GET          | `/admin/products`                | admin  | list products                                                                                                                   |
| POST         | `/admin/products`                | admin  | create product                                                                                                                  |
| PATCH/DELETE | `/admin/products/{id}`           | admin  | update/delete product; delete requires fresh auth                                                                               |
| GET          | `/admin/orders`                  | admin  | view recent manual order requests                                                                                               |
| GET/PATCH    | `/admin/orders/{id}`             | admin  | view an order request and update status                                                                                         |
| POST         | `/admin/orders/{id}/fulfillment` | admin  | save fulfillment status, carrier/tracking, milestone dates, internal notes, and optional customer update email                  |
| POST         | `/admin/orders/{id}/checkout`    | admin  | refresh a hosted Stripe Checkout link for an unpaid issued invoice                                                              |
| POST         | `/admin/orders/{id}/refunds`     | admin  | record a manual refund or execute a Stripe refund against a paid invoice, then optionally email the customer an updated receipt |

Cart and checkout line items accept `options` as an option-id to choice-id map. Required
product options must resolve against the current active product definition, or checkout returns
`409 PRODUCT_OPTIONS_REQUIRED`.

`POST /checkout` returns a manual request confirmation when hosted payments are not ready.
When hosted Stripe is ready, it returns the same order shape plus `checkoutUrl`, and the
client redirects to Stripe Checkout. If `store_stripe_tax_enabled` is enabled, public cart
checkout sends Stripe `automatic_tax[enabled]=true`, omits the app's fixed tax line to avoid
double tax, and lets the paid webhook update the order/invoice from the Checkout Session
`amount_total` and `total_details.amount_tax`. Issued invoice checkout links keep the saved
invoice amount and fixed tax breakdown for now.

The admin Settings API also exposes the hosted-payment readiness fields
(`store_online_payments_enabled`, `store_payment_provider`, `store_payment_mode`,
`store_stripe_tax_enabled`, `stripe_publishable_key`, `stripe_secret_key_enc` presence,
`stripe_webhook_secret_enc` presence, and `stripe_statement_descriptor`) through sanitized
camelCase DTO fields.
Secret values are write-only: a non-empty value replaces the encrypted key, `null` clears it,
and GET only returns `*Set` booleans.

Stripe webhook event IDs are stored in `stripe_webhook_event` before invoice/refund state
changes. Processed/ignored duplicate event IDs return success without applying the mutation
again; previously failed event IDs may be retried.

```json
{
  "data": {
    "orderId": "01J9...",
    "status": "pending",
    "totalCents": 7900,
    "currency": "USD",
    "itemCount": 1
  },
  "message": "Order request received. A manual invoice can be sent for this order."
}
```

---

## 5. Rate-Limit Rules (Redis-backed)

All limits enforced via Redis counters (token-bucket / fixed-window). `429` + `Retry-After` +
`X-RateLimit-*` headers on throttle. Keys combine surface + identity (IP, session, grant, or
email) as appropriate.

| Surface                   | Limit (default)                | Key          | Notes                                                                      |
| ------------------------- | ------------------------------ | ------------ | -------------------------------------------------------------------------- |
| **Login / auth**          | 5 fails / 15 min, then lockout | email + IP   | Enforced by **Better Auth** (Redis secondary storage); progressive lockout |
| Password reset request    | 3 / hour                       | email + IP   | Better Auth                                                                |
| 2FA verify                | 5 / 5 min                      | session      | Better Auth                                                                |
| **Contact form**          | 3 / hour, 10 / day             | IP (+ email) | plus honeypot/CAPTCHA gating                                               |
| **Single download**       | 60 / hour                      | grant        | per active grant                                                           |
| **Zip generation**        | 5 / hour, 1 concurrent build   | grant        | guards BullMQ worker load                                                  |
| Gallery unlock (password) | 10 fails / 15 min              | grant + IP   | prevents grant-password brute force                                        |
| **Public API (read)**     | 300 / min                      | IP           | burst-tolerant; CDN absorbs most reads                                     |
| Admin API                 | 600 / min                      | session      | generous; mainly abuse backstop                                            |
| Upload chunk              | 1200 / min                     | session      | high — chunked uploads are chatty                                          |

Limits are configurable via environment/admin config. Trusted reverse-proxy `X-Forwarded-For`
handling is required so per-IP keys are correct behind the self-hosted proxy.

---

## 6. Upload Protocol (chunked / resumable → BullMQ pipeline)

Large originals (RAW/high-res JPEG) upload via a resumable, chunked handshake so flaky
connections can resume and the server never buffers whole files in memory. Originals are
preserved unmodified; derivatives are produced asynchronously.

### 6.1 Handshake

**1. init** — `POST /api/v1/admin/uploads/init`

```json
{
  "filename": "DSC_0042.jpg",
  "byteSize": 18874368,
  "mimeType": "image/jpeg",
  "checksum": "sha256:9f86d08...",
  "chunkSize": 5242880
}
```

Response `201`:

```json
{
  "uploadId": "01J9...",
  "chunkSize": 5242880,
  "totalChunks": 4,
  "receivedChunks": [],
  "expiresAt": "2026-06-14T12:00:00Z"
}
```

Server validates `mimeType`/extension allow-list and size cap (else `415`/`413`), reserves a
temp staging area via `StorageProvider`, and records the upload session (Redis).

**2. chunk** — `PUT /api/v1/admin/uploads/{uploadId}/chunks/{index}`
Raw binary body (`Content-Type: application/octet-stream`), `Content-Range` header. Each chunk
is verified (size/position); duplicate chunk indices are idempotent. Response `200`:

```json
{ "uploadId": "01J9...", "receivedChunks": [0, 1, 2], "remaining": [3] }
```

**3. status / resume** — `GET /api/v1/admin/uploads/{uploadId}`
Returns `receivedChunks` so an interrupted client resumes by sending only missing indices.

**4. complete** — `POST /api/v1/admin/uploads/{uploadId}/complete`
(`Idempotency-Key` supported.) Server assembles chunks, verifies the full-file `checksum`
(else `409 CHECKSUM_MISMATCH`), promotes the assembled file to a permanent
`original_storage_key`, creates the `photo` row with `processing_status='pending'`, and
**enqueues a BullMQ job**. Response `202`:

```json
{
  "photo": { "id": "01J9...", "processingStatus": "pending" },
  "job": { "id": "bull:photo-process:5521", "queue": "photo-process" }
}
```

**5. abort** — `DELETE /api/v1/admin/uploads/{uploadId}` cleans temp parts and the session.

### 6.2 Pipeline (async, BullMQ worker)

The `photo-process` job runs the **sharp** pipeline:

1. Read original (never mutate it), normalize EXIF (apply orientation), extract EXIF subset +
   capture date (UTC), strip GPS per policy.
2. Compute `dominantColor`, `lqip`, `blurhash`.
3. Generate variants: AVIF + WebP (+ JPEG fallback) across size buckets
   (`thumb`→`xlarge`); write each via `StorageProvider`; upsert `photo_variant` rows
   (idempotent on `(photo_id, format, size_bucket)`).
4. Set `photo.processing_status='ready'` (or `failed` + `processing_error`); write `audit_log`.

Clients poll `GET /api/v1/admin/photos/{id}` (or subscribe via admin UI) for status. Zip
downloads (§4.3) use a separate `zip-build` queue with concurrency caps (§5).

---

## 7. Cross-Cutting Notes

- **Caching:** public reads send `Cache-Control` + `ETag`; media variant URLs are
  content-addressed/immutable and far-future cacheable. Private/client-gallery responses are
  `no-store`.
- **Media delivery:** variant URLs are served through the app (or a media route) that resolves
  storage keys via `StorageProvider`; client-gallery originals/large variants require an active
  grant + permission and use short-lived signed URLs.
- **Observability:** every response carries `X-Request-Id`; mutations write `audit_log`.
- **Email:** outbound (grant delivery, contact notifications, future invoices) goes through the
  `EmailProvider` (SMTP/Resend), typically enqueued via BullMQ.
- **PWA:** the service worker caches the public app shell + read endpoints with stale-while-
  revalidate; auth'd endpoints are network-only.
