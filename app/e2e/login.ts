import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";
import { DEV_ORIGIN } from "./local";

/** Signs in through a generated magic link that redirects back to `origin`. */
export async function login(admin: SupabaseClient, page: Page, email: string, origin = DEV_ORIGIN) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink", email, options: { redirectTo: `${origin}/` },
  });
  if (error) throw error;
  await page.goto(data.properties.action_link);
  await expect(page.getByRole("navigation")).toBeVisible();
}
