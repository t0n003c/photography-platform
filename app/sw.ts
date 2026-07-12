import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
}

// Reference the injected manifest so Serwist's build step is satisfied (unused).
void self.__SW_MANIFEST;

function parsePushPayload(event: PushEvent): PushPayload {
  if (!event.data) return {};
  try {
    return event.data.json() as PushPayload;
  } catch {
    return { body: event.data.text() };
  }
}

function sameOriginUrl(path: string | undefined): string {
  try {
    const url = new URL(path || "/admin", self.location.origin);
    return url.origin === self.location.origin
      ? `${url.pathname}${url.search}${url.hash}`
      : "/admin";
  } catch {
    return "/admin";
  }
}

self.addEventListener("install", () => {
  void self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Keep the replacement worker cache-free and clear caches left by older
      // Serwist builds that precached the admin app.
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch {
        /* ignore */
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("push", (event) => {
  const payload = parsePushPayload(event);
  const title = payload.title || "Photography Platform";
  const url = sameOriginUrl(payload.url);

  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body,
      icon: payload.icon || "/icon.svg",
      badge: payload.badge || "/icon.svg",
      tag: payload.tag,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data as { url?: string } | undefined;
  const path = sameOriginUrl(data?.url);
  const targetUrl = new URL(path, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clients) {
        const windowClient = client as WindowClient;
        if (new URL(windowClient.url).origin !== self.location.origin) continue;
        if (windowClient.url !== targetUrl) {
          try {
            await windowClient.navigate(targetUrl);
          } catch {
            /* ignore */
          }
        }
        await windowClient.focus();
        return;
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});
