/// <reference lib="webworker" />
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { ExpirationPlugin } from "workbox-expiration";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { RECIPE_IMAGES_CACHE, RECIPES_API_CACHE } from "./lib/cache-names";

declare let self: ServiceWorkerGlobalScope;

self.skipWaiting();
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")));

// Opened recipes and their shares: readable offline (cleared on sign-out / user change by the app)
registerRoute(
  ({ url, request }) => request.method === "GET" && /\/rest\/v1\/(recipes|shares)/.test(url.pathname),
  new StaleWhileRevalidate({ cacheName: RECIPES_API_CACHE, plugins: [new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 })] }),
);

// Recipe images (CORS requests only; opaque responses are not cached)
registerRoute(
  ({ url }) => url.pathname.includes("/storage/v1/object/public/recipe-images/"),
  new CacheFirst({
    cacheName: RECIPE_IMAGES_CACHE,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 60, purgeOnQuotaError: true }),
    ],
  }),
);

self.addEventListener("push", (event) => {
  const raw = (() => {
    try { return (event.data?.json() ?? null) as Partial<{ title: string; body: string; url: string }> | null; } catch { return null; }
  })();
  const payload = {
    title: raw?.title || "מתכון חדש",
    body: raw?.body ?? "",
    url: raw?.url || "/",
  };
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body, dir: "rtl", lang: "he", icon: "/pwa-192x192.png", badge: "/pwa-64x64.png", data: { url: payload.url },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string })?.url ?? "/";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = all.find((c) => new URL(c.url).origin === self.location.origin);
    if (existing) {
      await existing.focus();
      await existing.navigate(url).catch(() => self.clients.openWindow(url));
      return;
    }
    await self.clients.openWindow(url);
  })());
});
