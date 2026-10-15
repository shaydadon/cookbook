import { createClient } from "@supabase/supabase-js";
import { E2E_ADMIN, E2E_MEMBER, localSupabase, SEEDED_RECIPE_ID } from "./local";

function check(what: string, error: { message: string } | null) {
  if (error) throw new Error(`e2e global-setup: ${what} failed: ${error.message}`);
}

export default async function globalSetup() {
  const env = localSupabase();
  const db = createClient(env.url, env.serviceKey, { auth: { persistSession: false } });

  check("allowed_emails upsert", (await db.from("allowed_emails").upsert([
    { email: E2E_MEMBER, whatsapp_name: "רחל", role: "member" },
    { email: E2E_ADMIN, whatsapp_name: "שי", role: "admin" },
  ])).error);
  const { data: users, error: listErr } = await db.auth.admin.listUsers({ perPage: 1000 });
  check("listUsers", listErr);
  for (const email of [E2E_MEMBER, E2E_ADMIN]) {
    if (!users!.users.some((u) => u.email === email)) {
      check(`createUser ${email}`, (await db.auth.admin.createUser({ email, email_confirm: true })).error);
    }
  }

  check("seed recipe upsert", (await db.from("recipes").upsert({
    id: SEEDED_RECIPE_ID, status: "published", published_at: new Date().toISOString(),
    source_url: "https://e2e.test/shakshuka", source_url_normalized: "https://e2e.test/shakshuka", source_platform: "web",
    title: "שקשוקה של בדיקה", description: "לבדיקות קצה לקצה.", category: "ארוחת בוקר", tags: ["צמחוני"],
    prep_minutes: 10, cook_minutes: 15, servings: 2,
    ingredients: [
      { group: null, name: "עגבניות", amount: "4", unit: null, note: null },
      { group: null, name: "ביצים", amount: "3", unit: null, note: null },
    ],
    steps: [{ text: "מבשלים את העגבניות." }, { text: "שוברים פנימה את הביצים." }, { text: "מגישים חם." }],
  })).error);
  check("seed share upsert", (await db.from("shares").upsert(
    { recipe_id: SEEDED_RECIPE_ID, shared_by_name: "רחל", shared_at: "2026-10-12T09:00:00Z", via: "whatsapp" },
    { onConflict: "recipe_id,shared_by_name,shared_at", ignoreDuplicates: true },
  )).error);
  check("favorites cleanup", (await db.from("favorites").delete().eq("recipe_id", SEEDED_RECIPE_ID)).error);
}
