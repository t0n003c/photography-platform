---
name: image-optimization
description: Apply when generating, reviewing, or wiring up responsive image variants, srcset/sizes, formats/quality, LQIP/blurhash, or EXIF handling for the photography platform. Triggers on work in src/image/*, the <Picture> wrapper/next-image loader, app/api/uploads, or any code emitting image URLs.
---

# Image Optimization Ruleset

The concrete rules for producing and serving photo variants. Derived from `docs/MEDIA-ARCHITECTURE.md` §4–§5 and `docs/PERFORMANCE.md` §2, reflecting the **implemented WebP-primary strategy (ADR-0019)**. Apply these verbatim.

## 1. Size buckets (fixed width ladder)
Generate a fixed ladder of widths; heights follow the source aspect ratio. **Never crop in the pipeline.**

| Bucket     | Target CSS px | Generated width | Use |
|------------|---------------|-----------------|-----|
| `thumb`    | 400           | 400             | grid thumbnails, contact sheets |
| `small`    | 800           | 800             | mobile full-bleed, list views |
| `medium`   | 1600          | 1600            | desktop gallery / lightbox default |
| `large`    | 2400          | 2400            | hi-DPI lightbox, large displays |
| `xlarge`   | 3840          | 3840            | 4K / very large displays |
| `original` | native        | native          | **full-quality client ZIP downloads** / print sales only |

- Responsive buckets handle DPR via `srcset` width descriptors, **not** separate 2× files.
- `original` is **preserved untouched, never web-optimized, never in `srcset`** — served only via authenticated download (client ZIP) / print paths.

## 2. Formats & quality (WebP-primary — ADR-0019)
App delivery is **WebP at every responsive bucket** + **one JPEG fallback** at the `large` bucket only. AVIF and per-bucket JPEG proliferation are dropped to cut storage + encode CPU.

| Format | Role | Buckets | sharp settings |
|--------|------|---------|----------------|
| WebP | primary `<source>` | all five | `{ quality: 82, effort: 4 }` |
| JPEG | single `<img>` fallback | `large` **only** | `{ quality: 82, mozjpeg: true }`, progressive |

## 3. Never upscale
- `sharp.resize(width, null, { withoutEnlargement: true })`.
- If the original is narrower than a bucket's target width, **skip that bucket and every larger one**.
- The DB (`photo_variants`) records exactly which variants exist; `srcset` must only list real files.

## 4. srcset / sizes generation
- A server helper reads the photo's variant rows and emits a `<picture>`: one `<source type="image/webp">` (the WebP ladder), and an `<img>` pointing at the single `large` JPEG fallback.
- The WebP `<source>` `srcset` = `"<url> <width>w"` entries for every existing WebP variant, plus a gallery-context `sizes` string.
- **Always set `width`/`height`** (from extracted dimensions) on the `<img>` to reserve layout space and eliminate CLS.
- Below-the-fold images: `loading="lazy" decoding="async"`. Gallery grids virtualize/lazy-load (never fetch 500 images up front).
- **Exactly one priority/LCP image per page** (hero or first gallery image): eager + `fetchpriority="high"` + preload, **not** lazy. Never more than one.

Reference output shape:
```html
<picture>
  <source type="image/webp" srcset="…/thumb.webp 400w, …/small.webp 800w, …/medium.webp 1600w, …/large.webp 2400w, …/xlarge.webp 3840w" sizes="(max-width: 768px) 100vw, 50vw">
  <img src="…/large.jpg" width="1600" height="1067" loading="lazy" decoding="async"
       style="background-image:url(data:…lqip…)">
</picture>
```

## 5. LQIP / blurhash / dominant color
- LQIP: sharp resize original to ~20px wide → blur → minimal JPEG → base64 (target < 1 KB).
- Also compute a **blurhash** string and **dominant color** (`sharp.stats()`).
- Store all three **in the DB on the photo row** — DB is the render-time source of truth, inlined into HTML with zero extra requests. Dominant color is the `<img>` background before the LQIP paints. A `lqip.txt` in derivatives is optional regeneration convenience only.

## 6. EXIF handling (privacy-critical)
| | Original | Web variants |
|---|---|---|
| All EXIF/IPTC/XMP | **preserved verbatim** | **stripped** |
| GPS / geolocation | preserved | **stripped** (unless explicitly opted in per gallery) |
| Orientation | preserved | **baked into pixels + tag removed** (`sharp.rotate()` no args) |
| Color profile | preserved (Adobe RGB/ProPhoto for print) | **converted to sRGB** for web |

- For web variants do **not** call `withMetadata()` (except to set the sRGB ICC). sharp drops metadata by default — rely on that so no GPS can leak even if extraction logic changes.
- Extract displayable fields (`capturedAt`, camera/make/model/lens, exposure, dimensions) to DB columns and render from the DB — never re-read metadata off the served file.
- **Originals are immutable, preserved untouched, and never stripped**; they back full-quality client ZIP downloads / print sales, are access-controlled, and never served raw.

## 7. Delivery / caching
- Variant URLs are content-addressed + opaque (content hash + per-photo salt) → served `Cache-Control: public, max-age=31536000, immutable`, cached at Cloudflare. New versions get new URLs (no purge).
- Default to `next/image` in custom-loader/unoptimized mode pointing at our content-addressed variant URLs (our pipeline already produced the bytes); keep next/image's layout-stability + lazy + priority ergonomics. A thin custom `<Picture>` wrapper is fine where full `<picture>` art-direction is needed.
- **Private gallery variants** use signed/opaque keys and are `private, no-store` — never publicly cacheable.

## Quick review checklist
- [ ] WebP present at every responsive bucket; exactly ONE JPEG fallback at `large`; no AVIF.
- [ ] No upscaling; skipped buckets reflect a narrow original; `srcset` lists only existing files.
- [ ] `width`/`height` set; below-fold lazy; exactly one priority image.
- [ ] LQIP + blurhash + dominant color in DB; inlined.
- [ ] Web variants stripped of EXIF/GPS, orientation baked, sRGB; original untouched.
- [ ] Variant URLs immutable-cached (public) or signed `no-store` (private).
