/// <reference lib="webworker" />
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { ExpirationPlugin } from "workbox-expiration";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst } from "workbox-strategies";
import { RECIPE_IMAGES_CACHE, RECIPES_API_CACHE } from "./lib/cache-names";
import { isAppNavigation, isRecipesApiRequest, notificationTarget } from "./lib/sw-helpers";

declare let self: ServiceWorkerGlobalScope;

self.skipWaiting();
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
// App routes get the shell; public static pages (privacy policy) go to the network as plain files.
const appShell = createHandlerBoundToURL("index.html");
registerRoute(({ request, url }) => request.mode === "navigate" && isAppNavigation(url), appShell);

// Opened recipes, their shares and feed pages: readable offline (cleared on sign-out / user change by the app).
// Deliberate deviation from spec §6 ("stale-while-revalidate"): NetworkFirst keeps online data fresh
// (SWR served the previous response first, so edits/deletes showed up one visit late); offline readability
// is preserved because the cached copy is used when the network fails or takes longer than 4 s.
// Only single-recipe reads (id=eq.), shares, the search_recipes GET and the member's own row (needed to
// start the app offline) are cached; the admin list (status=in.), favourites and every other request bypass
// the SW. See isRecipesApiRequest.
registerRoute(
  ({ url, request }) => isRecipesApiRequest(url, request.method),
  new NetworkFirst({
    cacheName: RECIPES_API_CACHE,
    networkTimeoutSeconds: 4,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  }),
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
  const url = notificationTarget((event.notification.data as { url?: string } | null)?.url, self.location.origin);
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
