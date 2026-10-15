// Review fix: fixed chrome (tab bar, sheets) must stay on screen after the content scrolls.
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_MEMBER, localSupabase } from "./local";
import { login } from "./login";

const sb = localSupabase();
const admin = createClient(sb.url, sb.serviceKey, { auth: { persistSession: false } });

test("tab bar and sheets stay in the viewport after scrolling", async ({ page }) => {
  await login(admin, page, E2E_MEMBER);
  // Make the feed tall enough to scroll, then scroll the app's scroller well down.
  await page.evaluate(() => {
    const filler = document.createElement("div");
    filler.style.height = "3000px";
    document.querySelector("main")!.appendChild(filler);
    document.getElementById("app-scroll")!.scrollTop = 2000;
  });
  const viewport = page.viewportSize()!;
  const nav = await page.getByRole("navigation", { name: "ניווט ראשי" }).boundingBox();
  expect(nav!.y + nav!.height).toBeLessThanOrEqual(viewport.height + 1);
  expect(nav!.y).toBeGreaterThan(viewport.height / 2);

  await page.getByRole("button", { name: "הגדרות" }).evaluate((b: HTMLButtonElement) => b.click());
  const dialog = await page.getByRole("dialog").boundingBox();
  expect(dialog!.y + dialog!.height).toBeLessThanOrEqual(viewport.height + 1);
  expect(dialog!.y).toBeGreaterThanOrEqual(0);
});
