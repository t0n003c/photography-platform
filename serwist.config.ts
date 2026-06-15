// PWA service-worker configuration — ACTIVE.
//
// Serwist is wired via next.config.ts (withSerwist) which compiles app/sw.ts
// into public/sw.js. The actual service-worker logic (precache of the app
// shell + runtime caching via defaultCache) lives in app/sw.ts.
//
// This object documents the source/dest mapping used by next.config.ts and is
// kept in sync with it.

export const serwistConfig = {
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
} as const;
