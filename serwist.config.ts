// PWA service-worker configuration — PLACEHOLDER (wired in Phase 3).
//
// Phase 3 enables Serwist via next.config.ts (withSerwist) to precache the app
// shell, runtime-cache gallery thumbnails (stale-while-revalidate), and make the
// site installable. See docs/CACHING-STRATEGY.md and docs/PERFORMANCE.md.
//
// Kept as an inert config object so the documented file exists without pulling
// the dependency into the Phase 1 build.

export const serwistConfig = {
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // runtimeCaching / precache rules added in Phase 3.
} as const;
