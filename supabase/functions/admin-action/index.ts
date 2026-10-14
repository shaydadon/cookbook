import { getMember } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/db.ts";
import { buildDeps } from "../_shared/deps.ts";
import { background, json, preflight, withErrors } from "../_shared/http.ts";
import { resumeStatus } from "../_shared/pipeline.ts";
import { kickWorker } from "../_shared/worker.ts";

Deno.serve(withErrors(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const db = serviceClient();
  const member = await getMember(req, db);
  if (member?.role !== "admin") return json({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => null) as { action?: string; recipe_id?: string; raw_content?: string } | null;
  if (!body?.recipe_id) return json({ error: "recipe_id_required" }, 400);
  const { data: recipe } = await db.from("recipes")
    .select("id, raw_content, title, image_prompt, image_path, status, locked_until")
    .eq("id", body.recipe_id).maybeSingle();
  if (!recipe) return json({ error: "not_found" }, 404);

  switch (body.action) {
    case "retry": {
      if (recipe.locked_until && new Date(recipe.locked_until).getTime() > Date.now()) {
        return json({ error: "busy", message: "המתכון בעיבוד כרגע, נסו שוב בעוד כמה דקות" }, 409);
      }
      if (recipe.status === "published") {
        return json({ error: "published", message: "מתכון שפורסם — השתמשו ביצירת תמונה חדשה" }, 409);
      }
      const pasted = body.raw_content?.trim();
      const status = pasted ? "rewriting" : resumeStatus(recipe);
      const { error } = await db.from("recipes").update({
        status, attempts: 0, error: null, next_attempt_at: new Date().toISOString(), locked_until: null,
        // Pasted text clears the title on purpose, so the rewrite step refills it from the new text.
        ...(pasted ? { raw_content: pasted.slice(0, 15000), title: null } : {}),
      }).eq("id", recipe.id);
      if (error) return json({ error: error.message }, 500);
      background(kickWorker());
      return json({ status });
    }
    case "regenerate-image": {
      if (!recipe.title) return json({ error: "recipe_not_rewritten_yet" }, 409);
      const deps = buildDeps(db);
      const path = await deps.uploadImage(recipe.id, await deps.generateImage(recipe.image_prompt ?? recipe.title));
      const { error } = await db.from("recipes").update({ image_path: path }).eq("id", recipe.id);
      if (error) return json({ error: error.message }, 500);
      if (recipe.image_path && recipe.image_path !== path) {
        await db.storage.from("recipe-images").remove([recipe.image_path]).catch(() => {});
      }
      return json({ image_path: path });
    }
    case "delete": {
      const { error } = await db.from("recipes").delete().eq("id", recipe.id);
      if (error) return json({ error: error.message }, 500);
      try {
        const { data: files } = await db.storage.from("recipe-images").list(recipe.id);
        if (files?.length) await db.storage.from("recipe-images").remove(files.map((f) => `${recipe.id}/${f.name}`));
      } catch (_) { /* best effort */ }
      return json({ deleted: true });
    }
    default:
      return json({ error: "unknown_action" }, 400);
  }
}));
