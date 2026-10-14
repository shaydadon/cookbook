import { assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "./npm.ts";
import type { PipelineDeps } from "./pipeline.ts";
import type { RecipeRow } from "./types.ts";
import { runWorker } from "./worker.ts";

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
