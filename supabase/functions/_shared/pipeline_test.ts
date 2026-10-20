import { assertEquals, assertRejects, assertStringIncludes } from "jsr:@std/assert@1";
import { advanceRecipe, normalizeTags, type PipelineDeps, resumeStatus, retryPatch } from "./pipeline.ts";
import type { RecipeAi } from "./recipe-schema.ts";
import type { RecipeRow } from "./types.ts";

const NOW = new Date("2026-10-14T10:00:00Z");

const base: RecipeRow = {
  id: "r1", status: "queued", source_url: "https://a.test", source_url_normalized: "https://a.test",
  source_platform: "web", raw_content: null, title: null, description: null, ingredients: [], steps: [],
  prep_minutes: null, cook_minutes: null, servings: null, category: null, tags: [], image_prompt: null,
  image_path: null, error: null, attempts: 0, claims: 0, next_attempt_at: NOW.toISOString(), locked_until: null, published_at: null,
  fetch_retries: 0,
};

const AI: RecipeAi = {
  insufficient_content: false, title: "עוגה", description: "", ingredients: [
    { group: "", name: "קמח", amount: "2", unit: "כוסות", note: "" },
  ], steps: [{ text: "אופים." }], prep_minutes: 10, cook_minutes: 0, servings: 0,
  category: "אפייה וקינוחים", tags: [" מתוק ", "מתוק", ""], image_prompt: "A cake",
};

function deps(over: Partial<PipelineDeps> = {}): PipelineDeps {
  return {
    fetchSource: async () => "RAW",
    loadMessageText: async () => "msg",
    rewrite: async () => ({ kind: "ok", recipe: AI }),
    generateImage: async () => new Uint8Array([1]),
    uploadImage: async (id) => `${id}/abc.webp`,
    now: () => NOW,
    ...over,
  };
}

Deno.test("queued → rewriting with raw content", async () => {
  const p = await advanceRecipe(base, deps());
  assertEquals(p, { status: "rewriting", raw_content: "RAW", attempts: 0, error: null });
});

Deno.test("queued with nothing found → needs_review (Hebrew reason)", async () => {
  const p = await advanceRecipe(base, deps({ fetchSource: async () => null }));
  assertEquals(p.status, "needs_review");
  assertStringIncludes(p.error!, "לא נמצא");
});

Deno.test("queued with admin-pasted raw_content skips fetching", async () => {
  let fetched = false;
  const p = await advanceRecipe({ ...base, raw_content: "PASTED" }, deps({ fetchSource: async () => { fetched = true; return "X"; } }));
  assertEquals(fetched, false);
  assertEquals(p.raw_content, "PASTED");
});

Deno.test("rewriting → imaging with mapped fields (0 and '' become null)", async () => {
  const p = await advanceRecipe({ ...base, status: "rewriting", raw_content: "RAW" }, deps());
  assertEquals(p.status, "imaging");
  assertEquals(p.title, "עוגה");
  assertEquals(p.description, null);
  assertEquals(p.cook_minutes, null);
  assertEquals(p.servings, null);
  assertEquals(p.prep_minutes, 10);
  assertEquals(p.ingredients, [{ group: null, name: "קמח", amount: "2", unit: "כוסות", note: null }]);
  assertEquals(p.tags, ["מתוק"]);
  assertEquals(p.image_prompt, "A cake");
});

Deno.test("rewriting insufficient → needs_review, never invented", async () => {
  const p = await advanceRecipe({ ...base, status: "rewriting", raw_content: "meme" }, deps({ rewrite: async () => ({ kind: "insufficient" }) }));
  assertEquals(p.status, "needs_review");
  assertEquals(p.title, undefined);
});

Deno.test("imaging → published with image path", async () => {
  const p = await advanceRecipe({ ...base, status: "imaging", title: "עוגה", image_prompt: "A cake" }, deps());
  assertEquals(p.status, "published");
  assertEquals(p.image_path, "r1/abc.webp");
  assertEquals(p.published_at, NOW.toISOString());
});

Deno.test("error on attempt 1 schedules retry in 1 minute, status unchanged", async () => {
  const p = await advanceRecipe({ ...base, status: "rewriting", raw_content: "RAW" }, deps({ rewrite: () => Promise.reject(new Error("529 overloaded")) }));
  assertEquals(p.status, undefined);
  assertEquals(p.attempts, 1);
  assertEquals(p.error, "529 overloaded");
  assertEquals(p.next_attempt_at, "2026-10-14T10:01:00.000Z");
});

Deno.test("error on attempt 2 backs off 5 minutes", async () => {
  const p = await advanceRecipe({ ...base, attempts: 1 }, deps({ fetchSource: () => Promise.reject(new Error("x")) }));
  assertEquals(p.next_attempt_at, "2026-10-14T10:05:00.000Z");
});

Deno.test("third failure → failed", async () => {
  const p = await advanceRecipe({ ...base, status: "rewriting", raw_content: "R", attempts: 2 }, deps({ rewrite: () => Promise.reject(new Error("boom")) }));
  assertEquals(p.status, "failed");
  assertEquals(p.attempts, 3);
});

Deno.test("third image failure → published without image", async () => {
  const p = await advanceRecipe({ ...base, status: "imaging", title: "עוגה", image_prompt: "x", attempts: 2 }, deps({ generateImage: () => Promise.reject(new Error("img down")) }));
  assertEquals(p.status, "published");
  assertEquals(p.image_path, null);
  assertStringIncludes(p.error!, "img down");
});

Deno.test("non-runnable status throws", async () => {
  await assertRejects(() => advanceRecipe({ ...base, status: "published" }, deps()));
});

Deno.test("resumeStatus picks the first missing output", () => {
  assertEquals(resumeStatus({ raw_content: null, title: null }), "queued");
  assertEquals(resumeStatus({ raw_content: "r", title: null }), "rewriting");
  assertEquals(resumeStatus({ raw_content: "r", title: "t" }), "imaging");
});

Deno.test("normalizeTags trims, dedupes, drops empties, caps at 5", () => {
  assertEquals(normalizeTags([" א ", "א", "", "ב", "ג", "ד", "ה", "ו"]), ["א", "ב", "ג", "ד", "ה"]);
});

// Admin "retry" (עיבוד מחדש) without pasted text.
Deno.test("retryPatch: a needs_review recipe fetches its link again instead of reusing the old content", () => {
  const p = retryPatch({ status: "needs_review", raw_content: "הודעת הוואטסאפ ששותפה עם הקישור:\nhttps://www.facebook.com/share/v/x/", title: null }, null);
  assertEquals(p.status, "queued");
  assertEquals(p.raw_content, null);
  assertEquals(p.title, null);
});

Deno.test("retryPatch: a failed recipe resumes from its first missing step", () => {
  assertEquals(retryPatch({ status: "failed", raw_content: "טקסט", title: "עוגה" }, null).status, "imaging");
  assertEquals("raw_content" in retryPatch({ status: "failed", raw_content: "טקסט", title: "עוגה" }, null), false);
});

Deno.test("retryPatch: pasted text replaces the content and is rewritten", () => {
  const p = retryPatch({ status: "needs_review", raw_content: "old", title: null }, "  מצרכים: קמח. אופן הכנה: אופים.  ");
  assertEquals(p.status, "rewriting");
  assertEquals(p.raw_content, "מצרכים: קמח. אופן הכנה: אופים.");
  assertEquals(p.title, null);
});

// Facebook/Instagram sometimes answer servers with a login wall: retry later before asking a person.
const fb: RecipeRow = { ...base, source_platform: "facebook", source_url: "https://www.facebook.com/share/v/x/" };
const minutesFromNow = (iso: string) => (Date.parse(iso) - NOW.getTime()) / 60_000;

Deno.test("social link with no content is retried after 30 min, 2 h, then 6 h before needs_review", async () => {
  const d = deps({ fetchSource: async () => null });
  const first = await advanceRecipe(fb, d);
  assertEquals(first.status, undefined); // stays queued
  assertEquals(first.fetch_retries, 1);
  assertEquals(first.claims, 0); // a long wait must not trip the stuck-row guard
  assertEquals(minutesFromNow(first.next_attempt_at!), 30);
  assertEquals(minutesFromNow((await advanceRecipe({ ...fb, fetch_retries: 1 }, d)).next_attempt_at!), 120);
  assertEquals(minutesFromNow((await advanceRecipe({ ...fb, fetch_retries: 2 }, d)).next_attempt_at!), 360);
  const last = await advanceRecipe({ ...fb, fetch_retries: 3 }, d);
  assertEquals(last.status, "needs_review");
});

Deno.test("social link whose content was only a preview (insufficient) is fetched again later", async () => {
  const p = await advanceRecipe({ ...fb, status: "rewriting", raw_content: "כיתוב הפוסט: עוגת גבינה…" },
    deps({ rewrite: async () => ({ kind: "insufficient" }) }));
  assertEquals(p.status, "queued");
  assertEquals(p.raw_content, null);
  assertEquals(p.fetch_retries, 1);
  assertEquals(minutesFromNow(p.next_attempt_at!), 30);
});

Deno.test("ordinary websites are not retried: no content goes straight to needs_review", async () => {
  const p = await advanceRecipe(base, deps({ fetchSource: async () => null }));
  assertEquals(p.status, "needs_review");
});

Deno.test("admin-pasted text is never discarded for an automatic refetch", () => {
  const pasted = retryPatch({ status: "needs_review", raw_content: null, title: null }, "מצרכים: קמח. אופן הכנה: אופים.");
  assertEquals(pasted.fetch_retries, 3); // retries exhausted: an insufficient paste goes to needs_review
  const plain = retryPatch({ status: "needs_review", raw_content: "x", title: null }, null);
  assertEquals(plain.fetch_retries, 0); // a fresh retry cycle
});
