// Visual review only: `SCREENS=1 npx playwright test e2e/screens.spec.ts --project=dev` writes PNGs to e2e/screenshots/.
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { E2E_ADMIN, localSupabase } from "./local";
import { login } from "./login";

const sb = localSupabase();
const admin = createClient(sb.url, sb.serviceKey, { auth: { persistSession: false } });

const SIZES = [{ name: "phone", width: 390, height: 844 }, { name: "desktop", width: 1280, height: 800 }];
const THEMES = ["light", "dark"] as const;

test.skip(!process.env.SCREENS, "screenshots only when SCREENS=1");

for (const size of SIZES) {
  for (const theme of THEMES) {
    test(`screens ${size.name} ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.addInitScript((t) => { try { localStorage.setItem("theme-pref", t); } catch { /* ignore */ } }, theme);
      await login(admin, page, E2E_ADMIN);
      const shot = async (n: string) => {
        await page.waitForTimeout(400); // let sheet/page animations settle
        await page.screenshot({ path: `e2e/screenshots/${size.name}-${theme}-${n}.png` });
      };
      await expect(page.getByRole("heading", { level: 1, name: "המתכונים" })).toBeVisible();
      await shot("feed");
      await page.getByRole("button", { name: "הגדרות" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await shot("settings");
      await page.keyboard.press("Escape");
      await page.getByRole("link", { name: "הוספה" }).click();
      await expect(page.getByRole("dialog", { name: "מתכון חדש" })).toBeVisible();
      await shot("add");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.locator('a[href^="/recipe/"]').first().click();
      await expect(page.getByRole("link", { name: "התחילו לבשל" })).toBeVisible();
      await shot("recipe");
      await page.getByRole("link", { name: "התחילו לבשל" }).click();
      await expect(page.getByRole("progressbar")).toBeVisible();
      await shot("cooking");
      await page.goto("/admin");
      await expect(page.getByRole("tablist")).toBeVisible();
      await shot("admin");
    });
  }
}
