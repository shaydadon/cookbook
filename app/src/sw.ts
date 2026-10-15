/// <reference lib="webworker" />
import { ExpirationPlugin } from "workbox-expiration";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";

declare let self: ServiceWorkerGlobalScope;

self.skipWaiting();
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")));

// Opened recipes and their shares: readable offline
registerRoute(
  ({ url, request }) => request.method === "GET" && /\/rest\/v1\/(recipes|shares)/.test(url.pathname),
  new StaleWhileRevalidate({ cacheName: "recipes-api", plugins: [new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 })] }),
);

// Recipe images
registerRoute(
  ({ url }) => url.pathname.includes("/storage/v1/object/public/recipe-images/"),
  new CacheFirst({ cacheName: "recipe-images", plugins: [new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 60 })] }),
);

self.addEventListener("push", (event) => {
  const data = (() => {
    try { return event.data?.json() as { title: string; body: string; url: string }; } catch { return null; }
  })() ?? { title: "מתכון חדש", body: "", url: "/" };
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, dir: "rtl", lang: "he", icon: "/pwa-192x192.png", badge: "/pwa-64x64.png", data: { url: data.url },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string })?.url ?? "/";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = all.find((c) => new URL(c.url).origin === self.location.origin);
    if (existing) {
      await existing.navigate(url);
      return existing.focus();
    }
    return self.clients.openWindow(url);
  })());
});
