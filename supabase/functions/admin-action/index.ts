import { getMember } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/db.ts";
import { buildDeps } from "../_shared/deps.ts";
import { background, json, preflight } from "../_shared/http.ts";
import { resumeStatus } from "../_shared/pipeline.ts";
import { kickWorker } from "../_shared/worker.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const db = serviceClient();
  const member = await getMember(req, db);
  if (member?.role !== "admin") return json({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => null) as { action?: string; recipe_id?: string; raw_content?: string } | null;
  if (!body?.recipe_id) return json({ error: "recipe_id_required" }, 400);
  const { data: recipe } = await db.from("recipes").select("id, raw_content, title, image_prompt").eq("id", body.recipe_id).maybeSingle();
  if (!recipe) return json({ error: "not_found" }, 404);

  switch (body.action) {
    case "retry": {
      const pasted = body.raw_content?.trim();
      const status = pasted ? "rewriting" : resumeStatus(recipe);
      const { error } = await db.from("recipes").update({
        status, attempts: 0, error: null, next_attempt_at: new Date().toISOString(), locked_until: null,
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
      return json({ image_path: path });
    }
    case "delete": {
      const { data: files } = await db.storage.from("recipe-images").list(recipe.id);
      if (files?.length) await db.storage.from("recipe-images").remove(files.map((f) => `${recipe.id}/${f.name}`));
      const { error } = await db.from("recipes").delete().eq("id", recipe.id);
      if (error) return json({ error: error.message }, 500);
      return json({ deleted: true });
    }
    default:
      return json({ error: "unknown_action" }, 400);
  }
});
