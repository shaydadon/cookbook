import { fetchSource } from "./fetch-source.ts";
import { generateImage } from "./image.ts";
import { Anthropic, type SupabaseClient } from "./npm.ts";
import type { PipelineDeps } from "./pipeline.ts";
import { type SendFn, webPushSender } from "./push.ts";
import type { RecipeAi } from "./recipe-schema.ts";
import { rewriteRecipe } from "./rewrite.ts";

const FAKE_RECIPE: RecipeAi = {
  insufficient_content: false,
  title: "מתכון בדיקה",
  description: "נוצר במצב AI_FAKE לבדיקות מקומיות.",
  ingredients: [{ group: "", name: "ביצים", amount: "2", unit: "יחידות", note: "" }],
  steps: [{ text: "מערבבים." }, { text: "מבשלים חמש דקות." }],
  prep_minutes: 5, cook_minutes: 5, servings: 2,
  category: "ארוחת בוקר", tags: ["בדיקה"], image_prompt: "Test dish",
};
// 1x1 transparent WebP
const FAKE_WEBP = Uint8Array.from(atob("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA=="), (c) => c.charCodeAt(0));

export function buildDeps(db: SupabaseClient): PipelineDeps & { sendPush: SendFn | null } {
  const fake = Deno.env.get("AI_FAKE") === "1";
  const anthropic = fake ? null : new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");

  return {
    fetchSource: (input) => fetchSource(input),
    loadMessageText: async (recipeId) => {
      const { data } = await db.from("shares").select("message_text")
        .eq("recipe_id", recipeId).order("shared_at", { ascending: true }).limit(1).maybeSingle();
      return data?.message_text ?? null;
    },
    rewrite: fake ? async () => ({ kind: "ok", recipe: FAKE_RECIPE }) : (raw) => rewriteRecipe(raw, anthropic!),
    generateImage: fake ? async () => FAKE_WEBP : (prompt) =>
      generateImage(prompt, {
        apiKey: Deno.env.get("OPENAI_API_KEY")!,
        model: Deno.env.get("OPENAI_IMAGE_MODEL") ?? "gpt-image-1",
      }),
    uploadImage: async (recipeId, bytes) => {
      const path = `${recipeId}/${crypto.randomUUID()}.webp`;
      const { error } = await db.storage.from("recipe-images").upload(path, bytes, { contentType: "image/webp" });
      if (error) throw new Error(`storage upload: ${error.message}`);
      return path;
    },
    now: () => new Date(),
    sendPush: vapidPublic && vapidPrivate
      ? webPushSender({ publicKey: vapidPublic, privateKey: vapidPrivate, subject: Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com" })
      : null,
  };
}
