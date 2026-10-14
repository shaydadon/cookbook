import type { SupabaseClient } from "./npm.ts";
import { advanceRecipe, MAX_ATTEMPTS, type PipelineDeps } from "./pipeline.ts";
import { type PushSubscriptionRow, type SendFn, sendPushToAll } from "./push.ts";
import type { RecipePatch, RecipeRow } from "./types.ts";

// Free plan wall clock is 150 s: a step started at 20 s + the 120 s Anthropic timeout still fits.
export const START_NO_NEW_STEP_AFTER_MS = 20_000;

/** Chat-history imports must not push a notification per recipe: true when every share is an import. */
export async function onlyImported(db: SupabaseClient, recipeId: string): Promise<boolean> {
  const { data, error } = await db.from("shares").select("via").eq("recipe_id", recipeId);
  if (error || !data?.length) return false;
  return (data as { via: string }[]).every((s) => s.via === "import");
}

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
  // Fence on the lease we claimed: if an admin reset the row meanwhile, do not overwrite it.
  // A patch that changes status is a finished step: reset the claim counter (see claim_next_recipe).
  const write = { ...patch, locked_until: null, ...(patch.status ? { claims: 0 } : {}) };
  const { data: updated, error } = await db.from("recipes").update(write)
    .eq("id", recipe.id).eq("locked_until", recipe.locked_until).select("id");
  if (error) throw new Error(`update recipe ${recipe.id}: ${error.message}`);
  if (!updated?.length) {
    console.warn(`lease lost for recipe ${recipe.id}`);
    return patch;
  }
  if (patch.status === "published" && deps.sendPush && !(await onlyImported(db, recipe.id))) {
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
    try {
      await runOne(db, deps, recipe);
    } catch (e) {
      console.error(`recipe ${recipe.id} failed`, e);
      const attempts = recipe.attempts + 1;
      try {
        await db.from("recipes").update({
          attempts,
          error: e instanceof Error ? e.message : String(e),
          next_attempt_at: new Date(Date.now() + 5 * 60_000).toISOString(),
          locked_until: null,
          ...(attempts >= MAX_ATTEMPTS ? { status: "failed" } : {}),
        }).eq("id", recipe.id).eq("locked_until", recipe.locked_until); // same lease fence as runOne
      } catch (_) { /* best effort */ }
    }
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
