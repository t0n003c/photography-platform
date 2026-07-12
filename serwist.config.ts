// PWA service-worker configuration — opt-in.
//
// Serwist is wired via next.config.ts (withSerwist) which compiles app/sw.ts
// into public/sw.js. The worker is manually registered from Settings only when
// PWA push notifications are enabled. It does not precache or runtime-cache the
// admin app.
//
// This object documents the source/dest mapping used by next.config.ts and is
// kept in sync with it.

export const serwistConfig = {
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
} as const;
