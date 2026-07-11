# AI & Third-Party Integrations

Status: living integration notes. Instagram Graph and Remotion slideshow video are
implemented behind opt-in gates; tagging/alt-text remains proposal-only.

> **Owner sign-off gate.** New external integrations still require explicit approval.
> Instagram is abstracted behind `InstagramProvider` and is **inert without a token**
> (`IG_ACCESS_TOKEN` unset → it falls back to recent public photos and makes no
> external calls). **Remotion is IMPLEMENTED but OPT-IN and OFF by default**
> (`VIDEO_RENDER_ENABLED=false`; the admin endpoint returns 501 and the worker
> never loads Remotion until enabled) — enabling it changes the deployment shape
> (see below). The tagging/alt-text integration is still **not wired**.

> **Status: Remotion slideshow video — IMPLEMENTED (opt-in).** A `video-render`
> BullMQ queue + worker renders an MP4 slideshow (`remotion/` composition,
> `src/video/render.ts`) and stores it; the gallery editor has a "Slideshow video"
> card. To enable: build the worker with `--build-arg INSTALL_REMOTION_DEPS=true`
> (bakes the headless Chromium) and set `VIDEO_RENDER_ENABLED=true`. The
> `compose.prod.yaml` worker `build.args` already wires the build arg. ADR-0023.

---

## 1. Remotion — auto-generated gallery highlight / slideshow video

### What it does
Generate an MP4 "highlight reel" / slideshow from a client gallery (e.g. an
Instagram-ready 30–60s recap with cross-fades, captions, and music) using
[Remotion](https://www.remotion.dev/) (React → video). The owner could offer this
as a deliverable alongside a client gallery.

### ⚠️ Deployment-shape warning (implemented, but opt-in)
Server-side Remotion rendering runs frames through a **headless Chromium**. That
means:

- The render worker image must ship a **full headless Chromium** (Remotion's
  `@remotion/renderer` downloads/uses a Chromium build) — a large image and a new
  attack surface.
- Rendering is **CPU- and RAM-heavy** and bursty (encoding many frames + an
  ffmpeg mux). It competes directly with the existing sharp pipeline for cores.
- This is a **different deployment shape** from the default "sharp in a lean
  worker" model: bigger images, higher memory ceilings, possibly a dedicated
  render worker / separate machine, and longer job durations.

Because it changes the deployment shape and resource budget, it remains disabled unless
`VIDEO_RENDER_ENABLED=true` and the worker is built with Chromium dependencies.

### Implementation shape

The implemented path uses a dedicated BullMQ `video-render` queue, dynamic Remotion import
inside the worker, `src/video/render.ts`, and the `remotion/` composition. The pseudo-interface
below is the original design sketch; the live code is the source of truth.

```ts
// src/video/provider.ts  (proposed — not implemented)
export interface VideoRenderRequest {
  galleryId: string;
  photoIds: string[];        // ordered; resolved to large/xlarge variants
  preset: "highlight" | "slideshow";
  music?: string;            // licensed track key
}
export interface VideoRenderResult {
  storageKey: string;        // MP4 written via StorageProvider
  durationSeconds: number;
  width: number;
  height: number;
}
export interface VideoRenderProvider {
  render(req: VideoRenderRequest): Promise<VideoRenderResult>;
}
```

Where it plugs in:

- **Gate**: `VIDEO_RENDER_ENABLED=false` keeps the admin endpoint disabled; building the
  worker with `INSTALL_REMOTION_DEPS=true` bakes the Chromium dependencies needed to render.
- **Queue**: a BullMQ `video-render` queue (separate from `media-processing`),
  low priority, low concurrency (1–2), high per-job memory ceiling. A
  `RemotionVideoRenderProvider` runs `@remotion/renderer` inside the worker.
- **Persistence**: the resulting MP4 is written through the existing
  `StorageProvider` to a `derivatives/`-style key; a DB row tracks status
  (`pending`/`rendering`/`ready`/`failed`) so the gallery UI can poll/show it.
- **Trigger**: an owner action ("Generate highlight video") enqueues a job; never
  automatic on upload.

### Trade-offs
- **Cost:** all-self-hosted (no per-render API fee), but pays in CPU/RAM/time and a
  heavier worker image; may need a dedicated render box to avoid starving sharp.
- **Privacy:** fully self-hosted — image data never leaves the box. Best privacy
  posture of the three. (Music licensing is a separate, non-technical concern.)
- **Self-hosting:** entirely self-hosted; the cost is operational (Chromium in the
  image, bigger memory budget, the deployment-shape change above).

---

## 2. Instagram Graph API — "From the field" feed (IMPLEMENTED, token-gated)

### Status: implemented behind `InstagramProvider`, inert without a token
The home "From the field" section now reads `getInstagramProvider().getFeed(6)`:

- `src/instagram/provider.ts` — `InstagramProvider` / `InstagramItem` types.
- `src/instagram/drivers/graph.ts` — `GraphInstagramProvider`: `GET`
  `https://graph.instagram.com/me/media?fields=id,media_type,media_url,permalink,caption&access_token=…&limit=…`
  over `fetch`, filters to `IMAGE` / `CAROUSEL_ALBUM`, maps to `InstagramItem`,
  and **returns `[]` on any error** (so the section just hides).
- `src/instagram/drivers/fallback.ts` — `FallbackInstagramProvider`: recent READY
  public photos mapped to a small/medium WebP variant URL; keeps the current
  visual behavior when IG is not configured.
- `src/instagram/index.ts` — `getInstagramProvider()`: Graph driver when
  `IG_ACCESS_TOKEN` is set, otherwise the fallback driver.

No external call is made unless `IG_ACCESS_TOKEN` is set. The integration is
therefore **inert by default** and needs no further sign-off to ship — wiring a
token is the owner's deliberate opt-in.

### Setup (Meta app + long-lived token)
1. Create a **Meta app** (Instagram Graph API / Instagram Basic Display
   successor) and connect the studio's Instagram account.
2. Obtain a **long-lived access token** (long-lived user tokens last ~60 days).
3. Set `IG_ACCESS_TOKEN` in `.env`. The section flips to the live feed
   automatically.
4. **Token refresh:** long-lived tokens must be refreshed before expiry
   (exchange the current long-lived token for a fresh one). A future scheduled
   BullMQ job can rotate it; for now it is a manual/operational step. An expired
   token simply causes `getFeed()` to return `[]` (section hides) — no error page.

### Privacy
- Only **published** Instagram media URLs and permalinks are fetched; nothing
  about visitors is sent to Meta server-side.
- We deliberately **do not** use Instagram's embed iframe (heavy JS, layout shift,
  client-side tracking — see `PERFORMANCE.md` §5). We fetch server-side and render
  our own static grid linking out to Instagram.
- The access token is a secret (treat like any API key); it grants read access to
  the connected account's media list.

### Trade-offs
- **Cost:** free (Graph API has generous read limits for this volume).
- **Privacy:** good — server-side fetch, no third-party client script, no visitor
  data leaves the box. The studio's own IG content is, by definition, already
  public.
- **Self-hosting:** the feed source is Meta's API (not self-hostable), but the
  rendering and caching are ours. The fallback driver means the feature degrades
  gracefully to fully-self-hosted behavior.

---

## 3. Hugging Face (or local model) — auto-tagging + smart alt-text

### What it does
On upload (after the sharp pipeline), run an image-understanding model to produce:

- **Tags / keywords** (subjects, scene, setting) for search and organization.
- **Smart alt-text** — a short natural-language description for **accessibility**
  and **SEO**, used as a default `alt` the owner can edit.

### Abstraction (proposed)
A `TaggingProvider` seam, invoked as a **worker step after the sharp pipeline**
(it needs a generated derivative to send/score, and must never block `ready`):

```ts
// src/tagging/provider.ts  (proposed — not implemented)
export interface TaggingResult {
  tags: string[];            // normalized keywords
  altText: string | null;    // suggested alt; owner can override
  confidence: number;        // 0..1, for thresholding/review
}
export interface TaggingProvider {
  describe(imageBytes: Buffer): Promise<TaggingResult>;
}
```

Where it plugs in:

- **Factory** `getTaggingProvider()` env-gated by `TAGGING_DRIVER`
  (default `disabled`; `hf` hosted or `local` self-hosted).
- **Worker step:** after variants are written and **after** `status=ready`
  (or as a separate low-priority `auto-tag` job), so tagging latency/failures
  never delay a photo going live. Results are written to DB columns
  (`altText` suggestion + a tags table); the owner reviews/edits.
- **Input:** send a **small** derivative (e.g. the `small` WebP), never the
  original, to bound bandwidth and (for hosted) what leaves the box.

### Self-hosted (local model) vs. hosted (HF Inference API)

| | **Local model (self-hosted)** | **Hosted (HF Inference API)** |
|---|---|---|
| **Cost** | No per-call fee; pays in GPU/CPU + RAM, model storage, and ops. CPU-only inference is slow; a GPU is a real hardware cost. | Per-call / per-token pricing or a subscription; near-zero infra/ops. |
| **Privacy** | **Image data never leaves the box.** Best posture. | **Image bytes are uploaded to a third party** (Hugging Face). Even a small derivative leaves the network — a privacy cost, and unacceptable for private client galleries unless explicitly approved. |
| **Self-hosting** | Fully self-hosted; aligns with the platform's "your data on your hardware" stance. | Not self-hosted; adds an external dependency + outbound network requirement. |
| **Quality/effort** | Depends on the chosen open model + hardware; more setup. | Easy access to strong hosted models; least setup. |

### Recommendation & default
- **Off by default** (`TAGGING_DRIVER=disabled`). Tagging/alt-text is a
  convenience, never required for a photo to publish.
- For **private client galleries**, prefer the **local** driver (or skip tagging)
  so client images never leave the box. The hosted driver should only ever be
  enabled for **public** content, and only with owner sign-off, because image data
  leaves the box.

### Trade-offs (summary)
- **Cost:** local = hardware/ops; hosted = per-call fee, minimal ops.
- **Privacy:** local = images stay on-box; **hosted = images leave the box**.
- **Self-hosting:** local fully self-hosted; hosted adds an external dependency.

---

## 4. Sign-off checklist

| Integration | Wired today? | Gate | Default |
|---|---|---|---|
| **Instagram Graph** | Yes, behind `InstagramProvider` | `IG_ACCESS_TOKEN` | Inert (fallback to public photos) |
| **Remotion video** | Yes | `VIDEO_RENDER_ENABLED=true` + worker build arg `INSTALL_REMOTION_DEPS=true` | Disabled (changes deployment shape) |
| **HF / local tagging** | **No** | owner approval + `TAGGING_DRIVER` | Disabled (hosted = data leaves box) |

**Tagging/alt-text remains proposal-only and requires explicit owner sign-off before wiring.**
