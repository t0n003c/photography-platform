---
name: lighthouse-audit
description: Apply when asked to run a Lighthouse audit for this project, set up or interpret Lighthouse CI budgets, or decide whether a route passes the performance bar before opening a PR. Triggers on "run lighthouse", "check performance budgets", LHCI config work, or triaging a failing budget assertion.
---

# Lighthouse Audit

How to run Lighthouse for the photography platform and the exact budgets that fail a build. Budgets are pulled verbatim from `docs/PERFORMANCE.md` §1, §7, §8.

## 1. Tracked routes (always audit these; mobile, throttled)
- Home
- Public gallery grid
- Lightbox / photo view
- Print-store product page

## 2. Budgets — a build FAILS if any is breached on any tracked route

### Core Web Vitals (p75)
| Metric | Target | Stretch |
|---|---|---|
| LCP | ≤ 2.5 s | ≤ 1.8 s |
| INP (field) / TBT (lab proxy) | ≤ 200 ms | ≤ 150 ms |
| CLS | ≤ 0.1 | ≤ 0.05 |

Supporting: TTFB ≤ 0.8 s, FCP ≤ 1.8 s.

### Lighthouse category min scores
| Category | Min score |
|---|---|
| Performance | ≥ 90 (target 95) |
| Accessibility | ≥ 95 |
| Best Practices | ≥ 95 |
| SEO | ≥ 95 |

### Resource budgets (initial route)
| Resource | Budget | LHCI assertion |
|---|---|---|
| Total JS (home/gallery) | ≤ 150 KB gzip | `resource-summary:script:size` |
| Above-the-fold image weight | ≤ 600 KB | `resource-summary:image:size` |
| Total page transfer | ≤ 1.0 MB | `resource-summary:total:size` |
| Web font weight | ≤ 100 KB | font budget |
| Third-party JS (critical path) | ≈ 0 KB | third-party audit + code review |
| WebGL/Three.js chunk | not in initial bundle | bundle-analyzer check |

## 3. How to run

### Always against a production build (never dev mode)
```bash
npm run build && npm run start   # next build + next start on :3000
```

### Lighthouse CI (preferred — gates PRs)
```bash
npx lhci autorun                 # uses lighthouserc.* (collect + assert + upload)
```
- Run on every PR against the production build of the four tracked routes on a consistent mobile-throttled profile (GitHub Actions or the NAS CI runner).
- LHCI `assert` enforces the §2 score + budget assertions; any assertion below budget **fails the build** — regressions cannot merge. Reports upload as build artifacts.
- Optional pre-deploy run against a staging URL.

`lighthouserc.json` shape (assertions mirror §2):
```jsonc
{
  "ci": {
    "collect": { "url": ["http://localhost:3000/", "http://localhost:3000/portraits", "http://localhost:3000/<gallery>", "http://localhost:3000/store/<product>"],
                 "settings": { "preset": "mobile" }, "numberOfRuns": 3 },
    "assert": {
      "assertions": {
        "categories:performance":   ["error", { "minScore": 0.90 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:best-practices":["error", { "minScore": 0.95 }],
        "categories:seo":           ["error", { "minScore": 0.95 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift":  ["error", { "maxNumericValue": 0.1 }],
        "total-blocking-time":      ["error", { "maxNumericValue": 200 }],
        "resource-summary:script:size": ["error", { "maxNumericValue": 153600 }],
        "resource-summary:image:size":  ["error", { "maxNumericValue": 614400 }],
        "resource-summary:total:size":  ["error", { "maxNumericValue": 1048576 }]
      }
    },
    "upload": { "target": "filesystem", "outputDir": ".lighthouseci" }
  }
}
```

### Ad-hoc single route (local, before opening a PR)
```bash
npx lighthouse http://localhost:3000/<route> \
  --form-factor=mobile --throttling-method=simulate \
  --only-categories=performance,accessibility,best-practices,seo \
  --output=html --output=json --output-path=./lh-<route>
```
Confirm the WebGL chunk stays out of the initial bundle with `@next/bundle-analyzer` (`ANALYZE=true npm run build`).

## 4. What fails a build
Any of: a category below its min score, LCP > 2.5 s, CLS > 0.1, TBT > 200 ms, or a resource budget exceeded — on **any** tracked route. INP is monitored via field RUM (not lab); TBT is the lab gate that stands in for it.

## 5. Triage (map failure → cause → fix)
- **LCP high** → inspect the LCP element. Should be a real image, AVIF/WebP, priority/preloaded, correctly sized by `srcset`/`sizes`. Not a WebGL canvas. (PERFORMANCE.md §2, §4)
- **CLS high** → missing `width`/`height` on images, missing LQIP/dominant-color reservation, font swap shift (use `next/font` size-adjust). (§2, §5)
- **TBT/INP high** → too much initial JS, heavy hydration, lightbox gesture cost, WebGL not deferred. Check the WebGL chunk is dynamically imported on idle and out of the initial bundle. (§3, §4)
- **JS budget exceeded** → un-split heavy interactive pieces (lightbox/cart/WebGL) in the initial bundle; verify route-level code-splitting. (§3, §7)
- **Image budget exceeded** → oversized variant served (wrong `sizes`), non-AVIF/WebP, too many above-the-fold images eager. (§2)
- **Font budget exceeded** → too many families/weights, not subsetted. (§5)
- **Third-party JS present** → especially Instagram embeds; proxy server-side and serve our own optimized thumbnails instead. (§5)
- **Best Practices/SEO/A11y** → check CSP/console errors, meta/canonical, alt text, color contrast, landmark structure.

## 6. Output of an audit
A per-route pass/fail table (metric → measured → budget → PASS/FAIL), a prioritized list of breaches with the offending resource/element and concrete fix, and an explicit "would this fail CI? yes/no". Escalate complex regressions to the `performance-lighthouse` subagent. If the app/Chrome cannot be launched here, interpret an existing `.lighthouseci/` report instead of guessing.
