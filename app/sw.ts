import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Self-destruct service worker. A previous Serwist PWA worker was caching the
// admin app and serving stale code (uploads/edits never reflecting deploys).
// This worker takes over, deletes all caches, unregisters itself, and reloads
// open windows so every client recovers to fresh, SW-free code. The app no
// longer registers a SW (next.config register:false), so this won't re-install.

// Reference the injected manifest so Serwist's build step is satisfied (unused).
void self.__SW_MANIFEST;

self.addEventListener("install", () => {
  void self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch {
        /* ignore */
      }
      try {
        await self.registration.unregister();
      } catch {
        /* ignore */
      }
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        const wc = client as WindowClient;
        try {
          await wc.navigate(wc.url);
        } catch {
          /* ignore */
        }
      }
    })(),
  );
});
