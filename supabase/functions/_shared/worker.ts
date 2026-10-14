import type { SupabaseClient } from "./npm.ts";
import { advanceRecipe, type PipelineDeps } from "./pipeline.ts";
import { type PushSubscriptionRow, type SendFn, sendPushToAll } from "./push.ts";
import type { RecipePatch, RecipeRow } from "./types.ts";

const START_NO_NEW_STEP_AFTER_MS = 60_000;

export async function notifyPublished(db: SupabaseClient, send: SendFn | null, recipe: { id: string; title: string }) {
  if (!send) return;
  const { data: subs, error } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth");
  if (error || !subs?.length) return;
  const dead = await sendPushToAll(subs as PushSubscriptionRow[], {
    title: "מתכון חדש באפליקציה 🍳",
    body: recipe.title,
    url: `/recipe/${recipe.id}`,
  }, send);
  if (dead.length) await db.from("push_subscriptions").delete().in("id", dead);
}

export async function runOne(
  db: SupabaseClient,
  deps: PipelineDeps & { sendPush: SendFn | null },
  recipe: RecipeRow,
): Promise<RecipePatch> {
  const patch = await advanceRecipe(recipe, deps);
  const { error } = await db.from("recipes").update({ ...patch, locked_until: null }).eq("id", recipe.id);
  if (error) throw new Error(`update recipe ${recipe.id}: ${error.message}`);
  if (patch.status === "published") {
    await notifyPublished(db, deps.sendPush, { id: recipe.id, title: patch.title ?? recipe.title ?? "" });
  }
  return patch;
}

export async function runWorker(
  db: SupabaseClient,
  deps: PipelineDeps & { sendPush: SendFn | null },
  budgetMs = START_NO_NEW_STEP_AFTER_MS,
): Promise<number> {
  const started = Date.now();
  let steps = 0;
  while (Date.now() - started < budgetMs) {
    const { data, error } = await db.rpc("claim_next_recipe", { lease_seconds: 300 });
    if (error) throw new Error(`claim: ${error.message}`);
    const recipe = (data as RecipeRow[] | null)?.[0];
    if (!recipe) break;
    await runOne(db, deps, recipe);
    steps++;
  }
  return steps;
}

export async function kickWorker(): Promise<void> {
  await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/process-recipe`, {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("WORKER_SECRET")}`, "Content-Type": "application/json" },
    body: "{}",
  }).then((r) => r.body?.cancel());
}
