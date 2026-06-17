import { defaultCache } from "@serwist/next/worker";
import { Serwist, NetworkOnly } from "serwist";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // The admin app and the API must NEVER be served from the cache — they're
    // private (no-store) and operators must always get the latest. Without this,
    // a stale cached admin bundle can break dynamic flows like uploads.
    {
      matcher: ({ url, sameOrigin }) =>
        sameOrigin &&
        (url.pathname.startsWith("/admin") ||
          url.pathname.startsWith("/api") ||
          url.pathname.startsWith("/preview") ||
          url.pathname.startsWith("/g/")),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
