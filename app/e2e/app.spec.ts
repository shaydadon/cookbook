// Prereqs: Docker running; repo root: `npm run db:start` and `npm run functions:serve` (AI_FAKE=1).
import { createClient } from "@supabase/supabase-js";
import { expect, type Page, test } from "@playwright/test";
import { E2E_ADMIN, E2E_MEMBER, localSupabase, SEEDED_RECIPE_ID } from "./local";

const sb = localSupabase();
const admin = createClient(sb.url, sb.serviceKey, { auth: { persistSession: false } });

async function login(page: Page, email: string) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink", email, options: { redirectTo: "http://localhost:5173/" },
  });
  if (error) throw error;
  await page.goto(data.properties.action_link);
  await expect(page.getByRole("navigation")).toBeVisible();
}

test("member: feed, search, recipe, cooking mode, favourite", async ({ page }) => {
  await login(page, E2E_MEMBER);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("searchbox").fill("עגבניות");
  await page.getByRole("link", { name: /שקשוקה של בדיקה/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "שקשוקה של בדיקה" })).toHaveText("שקשוקה של בדיקה");
  await expect(page.getByText("מקור: e2e.test · שותף ע״י רחל ב-12.10.2026")).toBeVisible();

  await page.getByRole("button", { name: "הוספה למועדפים" }).click();
  await page.getByRole("link", { name: "מועדפים" }).click();
  await expect(page.getByRole("link", { name: /שקשוקה של בדיקה/ })).toBeVisible();

  await page.goto(`/recipe/${SEEDED_RECIPE_ID}/cook`);
  await expect(page.getByText("שלב 1 מתוך 3")).toBeVisible();
  await page.getByRole("button", { name: "הבא" }).click();
  await expect(page.getByText("שוברים פנימה את הביצים.")).toBeVisible();
  await expect(page.getByText("3 ביצים")).toBeVisible();
});

test("member: share-target link goes all the way to published", async ({ page }) => {
  await login(page, E2E_MEMBER);
  const link = `http://host.docker.internal:5199/omelette-${Date.now()}`;
  await page.goto(`/add?text=${encodeURIComponent(`חביתה מעולה ${link}`)}`);
  await expect(page.getByLabel("קישור למתכון")).toHaveValue(link);
  await page.getByRole("button", { name: "הוספה" }).click();
  await expect(page.getByText("פורסם")).toBeVisible({ timeout: 90_000 });
  await page.getByRole("link", { name: "לצפייה במתכון" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "מתכון בדיקה" })).toHaveText("מתכון בדיקה"); // AI_FAKE output
});

test("non-member is shown the members-only screen", async ({ page }) => {
  const email = `outsider-${Date.now()}@test.local`;
  await admin.from("allowed_emails").insert({ email });
  await admin.auth.admin.createUser({ email, email_confirm: true });
  await admin.from("members").delete().eq("email", email); // simulate removal after sign-up
  const { data } = await admin.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo: "http://localhost:5173/" } });
  await page.goto(data.properties.action_link);
  await expect(page.getByText("הגישה מותרת לחברי הקבוצה בלבד")).toBeVisible();
});

test("admin: review queue retry with pasted text", async ({ page }) => {
  const url = `https://e2e.test/broken-${Date.now()}`;
  const { data: r } = await admin.from("recipes").insert({
    source_url: url, source_url_normalized: url, source_platform: "instagram", status: "needs_review", error: "לא נמצא תוכן מתכון בקישור",
  }).select("id").single();

  await login(page, E2E_ADMIN);
  await page.getByRole("link", { name: "ניהול" }).click();
  const item = page.getByRole("listitem").filter({ hasText: url });
  await item.getByLabel("הדבקת טקסט המתכון").fill("2 ביצים, מלח. טורפים ומטגנים.");
  await item.getByRole("button", { name: "עיבוד מחדש" }).click();
  await expect.poll(async () => (await admin.from("recipes").select("status").eq("id", r!.id).single()).data?.status,
    { timeout: 90_000 }).toBe("published");
});
