import { assertEquals, assertMatch } from "jsr:@std/assert@1";
import { createClient } from "../_shared/npm.ts";
import type { PipelineDeps } from "../_shared/pipeline.ts";
import { runWorker } from "../_shared/worker.ts";
import { localEnv } from "./local.ts";

Deno.test("worker drives a queued recipe to published and uploads the image", async () => {
  const env = await localEnv();
  const db = createClient(env.url, env.serviceKey, { auth: { persistSession: false } });
  const url = `https://int.test/${crypto.randomUUID()}`;
  const { data: row } = await db.from("recipes")
    .insert({ source_url: url, source_url_normalized: url, source_platform: "web" }).select("id").single();

  const deps: PipelineDeps & { sendPush: null } = {
    fetchSource: async () => "קמח, ביצים. מערבבים ואופים.",
    loadMessageText: async () => null,
    rewrite: async () => ({
      kind: "ok",
      recipe: {
        insufficient_content: false, title: "עוגת בדיקה", description: "", ingredients: [
          { group: "", name: "קמח", amount: "1", unit: "כוס", note: "" },
        ], steps: [{ text: "אופים." }], prep_minutes: 0, cook_minutes: 30, servings: 8,
        category: "אפייה וקינוחים", tags: ["מתוק"], image_prompt: "cake",
      },
    }),
    generateImage: async () => new Uint8Array([82, 73, 70, 70]),
    uploadImage: async (id, bytes) => {
      const path = `${id}/test.webp`;
      const { error } = await db.storage.from("recipe-images").upload(path, bytes, { contentType: "image/webp", upsert: true });
      if (error) throw error;
      return path;
    },
    now: () => new Date(),
    sendPush: null,
  };

  await runWorker(db, deps, 30_000);

  const { data } = await db.from("recipes").select("status, title, image_path, locked_until, search_text").eq("id", row!.id).single();
  assertEquals(data!.status, "published");
  assertEquals(data!.title, "עוגת בדיקה");
  assertEquals(data!.locked_until, null);
  assertMatch(data!.image_path, /test\.webp$/);
  assertMatch(data!.search_text, /קמח/);

  await db.from("recipes").delete().eq("id", row!.id);
});
