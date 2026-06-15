# Performance

Phase 0 planning document. Defines the performance bar for the self-hosted photography
platform, the strategies to hit it, and how it is measured and enforced in CI.

The product UX bar is Pixieset / Pic-Time: image-heavy pages that still feel instant. That
means our hardest performance problem is delivering many high-res photos without wrecking
LCP/CLS. Media storage and the variant pipeline are covered in `MEDIA-ARCHITECTURE.md`;
this document covers delivery, rendering, and enforcement.

---

## 1. Targets

### 1.1 Core Web Vitals (field + lab, 75th percentile)

| Metric | Target ("good") | Stretch |
| ------ | --------------- | ------- |
| **LCP** (Largest Contentful Paint) | ≤ 2.5 s | ≤ 1.8 s |
| **INP** (Interaction to Next Paint) | ≤ 200 ms | ≤ 150 ms |
| **CLS** (Cumulative Layout Shift) | ≤ 0.1 | ≤ 0.05 |

Supporting metrics: **TTFB** ≤ 0.8 s, **FCP** ≤ 1.8 s, **TBT** (lab proxy for INP) ≤ 200 ms.

### 1.2 Lighthouse score budgets

Measured on mobile (throttled) for representative routes: home, public gallery grid,
lightbox/photo view, print-store product page.

| Category        | Budget (min score) |
| --------------- | ------------------ |
| Performance     | ≥ 90 (target 95)   |
| Accessibility   | ≥ 95               |
| Best Practices  | ≥ 95               |
| SEO             | ≥ 95               |

A build that drops any category below budget on any tracked route fails CI (§8).

---

## 2. Image strategy (the main event)

Photos dominate bytes and the LCP element, so this is where most of the budget is spent.

- **Modern formats first.** Serve AVIF, then WebP, then JPEG via `<picture>`/`srcset`
  (formats and size ladder defined in `MEDIA-ARCHITECTURE.md` §4). AVIF typically cuts
  bytes 30–50% vs. JPEG at equivalent quality.
- **Responsive `srcset`/`sizes`.** Every image ships width-descriptor `srcset` entries for
  exactly the variants that exist, plus a context-appropriate `sizes` so the browser
  downloads the smallest sufficient file for its viewport × DPR. No oversized downloads.
- **Lazy loading.** All below-the-fold images use `loading="lazy"` + `decoding="async"`.
  Gallery grids virtualize/lazy so a 500-photo gallery does not fetch 500 images up front.
- **LCP / priority image.** The single most likely LCP element per page (hero, first
  gallery row's first image, or product hero) is marked **high priority** (`priority` on
  `next/image`, i.e. `fetchpriority="high"` + eager, and `preload`). It is **not** lazy.
  Exactly one priority image per page to avoid bandwidth contention.
- **LQIP to kill CLS.** Inline base64 LQIP (or blurhash) plus always-present
  `width`/`height` reserve exact layout space, so images fade in without shifting. Dominant
  color is the background before the LQIP paints (see media doc §4.4).
- **`next/image` vs. custom.** Default to **`next/image`** in *unoptimized/custom-loader*
  mode: our sharp pipeline already produced the derivatives, so we point a custom loader at
  our content-addressed variant URLs rather than letting Next re-optimize. We keep
  `next/image`'s layout-stability, lazy, and priority ergonomics while owning the actual
  bytes. (A thin custom `<Picture>` wrapper is acceptable where we need full `<picture>`
  art-direction control.)
- **CDN immutable caching.** Variant URLs are content-addressed and immutable, served with
  `Cache-Control: public, max-age=31536000, immutable` and cached at Cloudflare. Repeat
  views and warm-cache visitors pay near-zero. Cloudflare Tunnel fronts the NAS so origin
  bandwidth is spent once per object.

---

## 3. Rendering strategy

- **SSG + ISR for public pages.** Marketing pages, public galleries, and store product
  pages are statically generated and revalidated via ISR (e.g. on publish or a short TTL).
  Static HTML → fast TTFB → fast LCP.
- **RSC by default.** React Server Components render the data-heavy gallery/store UI on the
  server and ship **zero client JS** for non-interactive parts. Client Components are
  opt-in islands (lightbox controls, cart, filters).
- **Streaming + Suspense.** Pages stream: the shell + LCP image flush first, slower data
  (e.g. EXIF panels, related photos) stream in under `<Suspense>` boundaries so they never
  block first paint.
- **Code-splitting / route-level bundles.** Each route ships only its own JS. Heavy
  interactive pieces (lightbox, WebGL layer, cart) are dynamically imported so they are not
  in the initial bundle of a page that does not use them.
- **Private galleries** are dynamic (auth-gated) but still RSC-rendered and stream; their
  images are private-signed URLs (media doc §2) and not publicly cacheable, so we lean on
  browser cache + small variant sizes for speed.

---

## 4. Keeping WebGL/Three.js off the critical path

The Three.js enhancement layer (subtle 3D/effects) is a *progressive enhancement*. It must
never cost LCP, INP, or CLS.

- **Separate chunk, dynamic import.** Three.js and the WebGL scene live in their own
  dynamically-imported chunk (`next/dynamic`, `ssr: false`). They are **never** in the
  initial or critical bundle.
- **Load after hydration / on idle.** The chunk is imported on `requestIdleCallback` (or
  after the page is interactive), so it never competes with the LCP image or first
  interaction.
- **Intersection-triggered.** WebGL canvases only initialize when scrolled near the
  viewport (`IntersectionObserver`); off-screen scenes do no work.
- **Graceful fallbacks.** Respect `prefers-reduced-motion` and detect WebGL support — when
  reduced motion is requested or WebGL is unavailable, render a static image/CSS fallback
  and skip loading the chunk entirely.
- **Never blocks LCP/INP.** The LCP element is always a real image, never a WebGL canvas.
  The 3D layer is decorative and degrades to nothing without affecting content or
  interactivity. Frame work is throttled/paused when the tab is hidden.

---

## 5. Fonts, CSS, third-party scripts

### Fonts
- Use **`next/font`** (self-hosted, no external request to Google Fonts) with automatic
  **subsetting** to the character sets we use.
- `font-display: swap` (or `optional` for non-critical faces) to avoid invisible-text
  blocking. Preload the primary font. Prefer 1–2 families, few weights, to bound bytes and
  avoid layout shift (size-adjust fallback metrics via `next/font`).

### CSS
- **Tailwind** with content-based purge so only used utilities ship. Critical CSS is small
  and inlined by the framework; no global mega-stylesheet.
- Avoid runtime CSS-in-JS that adds client JS; prefer compile-time styles.

### Third-party scripts
- **Strict discipline — every third party is guilty until measured.**
- **Instagram embeds are expensive** (heavy JS, layout shift, privacy cost). Do **not** use
  the official embed iframe in the critical path. Instead, **proxy/fetch the feed
  server-side**, store thumbnails through our own pipeline, and render a **static** grid
  that links out to Instagram. This turns a multi-hundred-KB third-party widget into a few
  of our own optimized images.
- Any unavoidable third-party script uses `next/script` with `strategy="lazyOnload"` and is
  budgeted explicitly.

---

## 6. PWA contribution (Serwist)

- **Precache the app shell** (HTML shell, core CSS/JS, fonts, icons) so the chrome paints
  instantly on repeat visits and offline.
- **Runtime caching** for images: cache-first with the immutable variant URLs, so
  previously-seen photos load from disk with no network.
- **Repeat-visit speed:** combined with immutable CDN caching, returning visitors get a
  near-instant shell + cached imagery. The service worker must not delay first load or the
  install must be deferred until after the page is interactive.
- The PWA layer is additive: a first-time visitor's performance never depends on it.

---

## 7. Budget table (metric → target → enforcement)

| Metric / resource            | Target                         | Enforcement                                   |
| ---------------------------- | ------------------------------ | --------------------------------------------- |
| LCP (mobile, p75)            | ≤ 2.5 s                        | Lighthouse CI assertion → fails build         |
| INP (field) / TBT (lab)      | ≤ 200 ms                       | TBT asserted in LHCI; INP via field RUM       |
| CLS                          | ≤ 0.1                          | Lighthouse CI assertion → fails build         |
| Lighthouse Performance       | ≥ 90                           | LHCI `assert` min-score → fails build         |
| Lighthouse A11y / BP / SEO   | ≥ 95 each                      | LHCI `assert` min-score → fails build         |
| Total JS (initial route)     | ≤ 150 KB gzip (home/gallery)   | LHCI `resource-summary:script:size` budget    |
| Total image weight (initial) | ≤ 600 KB above the fold        | LHCI `resource-summary:image:size` budget     |
| Total page transfer (initial)| ≤ 1.0 MB                       | LHCI `resource-summary:total:size` budget     |
| Web font weight              | ≤ 100 KB                       | LHCI font budget                              |
| Third-party JS               | ≈ 0 KB in critical path        | Code review + LHCI third-party audit          |
| WebGL chunk                  | Not in initial bundle          | Bundle analyzer check in CI                    |

Numbers are starting budgets to tighten as we measure real pages in Phase 1.

---

## 8. Measurement & enforcement

- **Lighthouse CI (LHCI)** runs on every PR against a production build of the tracked
  routes (home, public gallery grid, lightbox/photo, store product). It uses
  `assert` (score + budget assertions from §1/§7) and uploads reports as build artifacts.
  Assertions that fall below budget **fail the build** — performance regressions cannot
  merge.
- **Where it runs:** in CI (GitHub Actions or the NAS CI runner) on a consistent
  mobile-throttled profile, plus an optional pre-deploy run against a staging URL.
- **Bundle analysis** (`@next/bundle-analyzer`) gates initial JS size and confirms the
  WebGL/Three.js chunk stays split out of the critical path.
- **Field RUM (optional but recommended):** capture real-user CWV (web-vitals lib → a
  lightweight endpoint, or Cloudflare Web Analytics) for INP/LCP/CLS at p75 from real
  devices, since lab numbers under-represent INP.
- **Subagent / skill hooks:**
  - Use the **`performance-lighthouse` subagent** to investigate regressions, interpret
    LHCI reports, and propose fixes when a budget is breached.
  - Use the **`lighthouse-audit` skill** to run ad-hoc audits locally against a route
    before opening a PR, so budget breaches are caught before CI.

---

## 9. Open questions for Phase 1

- Final per-route JS/image byte budgets after measuring real galleries.
- INP hot spots in the lightbox (gesture handling, large-image decode) and whether to
  decode off-main-thread.
- Whether private galleries warrant their own (authenticated) edge cache layer.
- RUM backend choice (self-hosted vs. Cloudflare Web Analytics).
