import type { SourceInput } from "./fetch-source.ts";
import type { RewriteResult } from "./rewrite.ts";
import type { RecipePatch, RecipeRow } from "./types.ts";

export const MAX_ATTEMPTS = 3;
export const BACKOFF_MINUTES = [1, 5];

export interface PipelineDeps {
  fetchSource(input: SourceInput): Promise<string | null>;
  loadMessageText(recipeId: string): Promise<string | null>;
  rewrite(raw: string): Promise<RewriteResult>;
  generateImage(prompt: string): Promise<Uint8Array>;
  uploadImage(recipeId: string, bytes: Uint8Array): Promise<string>;
  now(): Date;
}

const RUNNABLE = new Set(["queued", "rewriting", "imaging"]);

const orNull = (s: string) => (s.trim() === "" ? null : s.trim());
const positiveOrNull = (n: number) => (n > 0 ? n : null);

export function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((t) => t.trim()).filter(Boolean))].slice(0, 5);
}

export function resumeStatus(r: Pick<RecipeRow, "raw_content" | "title">): "queued" | "rewriting" | "imaging" {
  if (!r.raw_content) return "queued";
  if (!r.title) return "rewriting";
  return "imaging";
}

/**
 * What an admin retry changes. Pasted text replaces the content and is rewritten. Without it, a
 * needs_review recipe is fetched again: its saved content is what proved insufficient, so reusing it would
 * fail the same way. Other failures (e.g. the image step) resume from the first missing output.
 */
export function retryPatch(
  r: Pick<RecipeRow, "status" | "raw_content" | "title">,
  pasted: string | null | undefined,
): { status: "queued" | "rewriting" | "imaging"; raw_content?: string | null; title?: null } {
  const text = pasted?.trim();
  if (text) return { status: "rewriting", raw_content: text.slice(0, 15000), title: null };
  if (r.status === "needs_review") return { status: "queued", raw_content: null, title: null };
  return { status: resumeStatus(r) };
}

async function runStep(r: RecipeRow, deps: PipelineDeps): Promise<RecipePatch> {
  switch (r.status) {
    case "queued": {
      const raw = r.raw_content ??
        await deps.fetchSource({ url: r.source_url, platform: r.source_platform, messageText: await deps.loadMessageText(r.id) });
      if (!raw) return { status: "needs_review", error: "לא נמצא תוכן מתכון בקישור", attempts: 0 };
      return { status: "rewriting", raw_content: raw, attempts: 0, error: null };
    }
    case "rewriting": {
      const res = await deps.rewrite(r.raw_content ?? "");
      if (res.kind === "insufficient") {
        return { status: "needs_review", error: "לא נמצא מתכון מלא בתוכן (חסרים מרכיבים או אופן הכנה)", attempts: 0 };
      }
      const x = res.recipe;
      return {
        status: "imaging",
        title: x.title.trim(),
        description: orNull(x.description),
        ingredients: x.ingredients.map((i) => ({
          group: orNull(i.group), name: i.name.trim(), amount: orNull(i.amount), unit: orNull(i.unit), note: orNull(i.note),
        })),
        steps: x.steps.map((s) => ({ text: s.text.trim() })).filter((s) => s.text),
        prep_minutes: positiveOrNull(x.prep_minutes),
        cook_minutes: positiveOrNull(x.cook_minutes),
        servings: positiveOrNull(x.servings),
        category: x.category,
        tags: normalizeTags(x.tags),
        image_prompt: x.image_prompt.trim() || x.title,
        attempts: 0,
        error: null,
      };
    }
    case "imaging": {
      const bytes = await deps.generateImage(r.image_prompt ?? r.title ?? "");
      const path = await deps.uploadImage(r.id, bytes);
      return { status: "published", image_path: path, published_at: deps.now().toISOString(), attempts: 0, error: null };
    }
    default:
      throw new Error(`advanceRecipe: status ${r.status} is not runnable`);
  }
}

export async function advanceRecipe(r: RecipeRow, deps: PipelineDeps): Promise<RecipePatch> {
  if (!RUNNABLE.has(r.status)) throw new Error(`advanceRecipe: status ${r.status} is not runnable`);
  try {
    return await runStep(r, deps);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const attempts = r.attempts + 1;
    if (attempts < MAX_ATTEMPTS) {
      const delayMs = BACKOFF_MINUTES[attempts - 1] * 60_000;
      return { attempts, error: msg, next_attempt_at: new Date(deps.now().getTime() + delayMs).toISOString() };
    }
    if (r.status === "imaging") {
      return {
        status: "published", image_path: null, published_at: deps.now().toISOString(),
        attempts, error: `יצירת התמונה נכשלה: ${msg}`,
      };
    }
    return { status: "failed", attempts, error: msg };
  }
}
