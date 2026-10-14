import { assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "./npm.ts";
import type { PipelineDeps } from "./pipeline.ts";
import type { RecipeRow } from "./types.ts";
import { runOne, runWorker } from "./worker.ts";

Deno.test("runWorker isolates a failing row and records the failure", async () => {
  const row = { id: "r1", status: "queued", attempts: 0, title: null } as unknown as RecipeRow;
  let claims = 0;
  const updates: Record<string, unknown>[] = [];
  const db = {
    rpc: async () => ({ data: claims++ === 0 ? [row] : [], error: null }),
    from: () => ({
      update: (patch: Record<string, unknown>) => {
        updates.push(patch);
        return { eq: async () => (updates.length === 1 ? { error: { message: "boom" } } : { error: null }) };
      },
    }),
  } as unknown as SupabaseClient;
  const deps = {
    fetchSource: async () => "x",
    loadMessageText: async () => null,
    rewrite: async () => ({ kind: "ok", recipe: null }),
    generateImage: async () => new Uint8Array(),
    uploadImage: async () => "p",
    now: () => new Date(),
    sendPush: null,
  } as unknown as PipelineDeps & { sendPush: null };

  const steps = await runWorker(db, deps, 5_000);
  assertEquals(steps, 1);
  assertEquals(updates.length >= 2, true);
  const last = updates[updates.length - 1];
  assertEquals(last.attempts, 1);
  assertEquals(last.locked_until, null);
});

Deno.test("runOne does not notify when the lease was lost (update affected 0 rows)", async () => {
  const row = { id: "r1", status: "imaging", attempts: 0, title: "t", image_prompt: "p", locked_until: "2026-01-01T00:00:00Z" } as unknown as RecipeRow;
  const fenced: Array<[string, unknown]> = [];
  let pushCalls = 0;
  const chain = {
    eq: (col: string, val: unknown) => {
      fenced.push([col, val]);
      return chain;
    },
    select: async () => ({ data: [], error: null }),
  };
  const db = { from: () => ({ update: () => chain }) } as unknown as SupabaseClient;
  const deps = {
    generateImage: async () => new Uint8Array(),
    uploadImage: async () => "p",
    now: () => new Date(),
    sendPush: async () => {
      pushCalls++;
    },
  } as unknown as PipelineDeps & { sendPush: () => Promise<void> };

  const patch = await runOne(db, deps as never, row);
  assertEquals(patch.status, "published");
  assertEquals(pushCalls, 0);
  assertEquals(fenced.some(([c, v]) => c === "locked_until" && v === "2026-01-01T00:00:00Z"), true);
});
