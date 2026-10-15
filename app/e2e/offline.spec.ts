// SW / offline smoke: runs only in the `pwa-preview` project (production build served by `vite preview`).
// Prereqs: Docker running; repo root: `npm run db:start`.
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_MEMBER, localSupabase, PREVIEW_ORIGIN, SEEDED_RECIPE_ID } from "./local";
import { login } from "./login";

const sb = localSupabase();
const admin = createClient(sb.url, sb.serviceKey, { auth: { persistSession: false } });

test("an opened recipe is readable offline after a reload", async ({ page, context }) => {
  await login(admin, page, E2E_MEMBER, PREVIEW_ORIGIN);

  // Wait for the service worker to activate and control this page (clients.claim()); reload once if needed.
  const controlled = () => page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    return !!navigator.serviceWorker.controller;
  });
  if (!(await controlled())) {
    await page.reload();
    await expect.poll(controlled, { timeout: 15_000 }).toBe(true);
  }

  // Open the recipe while controlled, so its API reads go through the SW and land in the cache.
  await page.goto(`/recipe/${SEEDED_RECIPE_ID}`);
  const title = page.getByRole("heading", { level: 1, name: "שקשוקה של בדיקה" });
  await expect(title).toBeVisible();
  await expect.poll(() => page.evaluate(async (id) => {
    const keys = await (await caches.open("recipes-api")).keys();
    return keys.some((r) => r.url.includes("/rest/v1/recipes") && r.url.includes(`id=eq.${id}`));
  }, SEEDED_RECIPE_ID), { timeout: 15_000 }).toBe(true);

  await context.setOffline(true);
  try {
    // Prove the offline emulation reaches the service worker too, so the reload below is served from its cache.
    const [sw] = context.serviceWorkers();
    expect(sw, "service worker").toBeTruthy();
    const swNetwork = await sw.evaluate((u) => fetch(u, { cache: "no-store" }).then(() => "online", () => "offline"), `${sb.url}/rest/v1/`);
    expect(swNetwork).toBe("offline");
    await page.reload();
    await expect(title).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("מבשלים את העגבניות.")).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
