import { assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "./npm.ts";
import type { PipelineDeps } from "./pipeline.ts";
import type { RecipeRow } from "./types.ts";
import { runOne, runWorker, START_NO_NEW_STEP_AFTER_MS } from "./worker.ts";

/** Fake DB for runOne: records the recipes update, answers shares/push_subscriptions queries. */
function fakeDb(shareVias: string[]) {
  const writes: Record<string, unknown>[] = [];
  const db = {
    from: (table: string) => {
      if (table === "recipes") {
        return {
          update: (w: Record<string, unknown>) => {
            writes.push(w);
            const chain = { eq: () => chain, select: async () => ({ data: [{ id: "r1" }], error: null }) };
            return chain;
          },
        };
      }
      if (table === "shares") {
        return { select: () => ({ eq: async () => ({ data: shareVias.map((via) => ({ via })), error: null }) }) };
      }
      // push_subscriptions
      return {
        select: async () => ({ data: [{ id: "s1", endpoint: "https://push.test/1", p256dh: "p", auth: "a" }], error: null }),
        delete: () => ({ in: async () => ({ error: null }) }),
      };
    },
  } as unknown as SupabaseClient;
  return { db, writes };
}

function imagingDeps(onPush: () => void) {
  return {
    generateImage: async () => new Uint8Array(),
    uploadImage: async () => "p",
    now: () => new Date(),
    sendPush: async () => onPush(),
  } as unknown as PipelineDeps & { sendPush: () => Promise<void> };
}

const imagingRow = () =>
  ({ id: "r1", status: "imaging", attempts: 0, claims: 2, title: "t", image_prompt: "p", locked_until: "2026-01-01T00:00:00Z" }) as unknown as RecipeRow;

Deno.test("no push when every share of the recipe came from a chat import", async () => {
  let pushes = 0;
  const { db } = fakeDb(["import", "import"]);
  const patch = await runOne(db, imagingDeps(() => pushes++) as never, imagingRow());
  assertEquals(patch.status, "published");
  assertEquals(pushes, 0);
});

Deno.test("push is sent when at least one share is live (whatsapp/app)", async () => {
  let pushes = 0;
  const { db } = fakeDb(["import", "whatsapp"]);
  await runOne(db, imagingDeps(() => pushes++) as never, imagingRow());
  assertEquals(pushes, 1);
});

Deno.test("a finished step (status change) resets claims; a retry patch does not", async () => {
  const ok = fakeDb(["app"]);
  await runOne(ok.db, imagingDeps(() => {}) as never, imagingRow());
  assertEquals(ok.writes[0].claims, 0);
  assertEquals(ok.writes[0].locked_until, null);

  const failing = fakeDb(["app"]);
  const deps = { ...imagingDeps(() => {}), generateImage: async () => { throw new Error("rate limited"); } };
  const patch = await runOne(failing.db, deps as never, imagingRow());
  assertEquals(patch.status, undefined);
  assertEquals("claims" in failing.writes[0], false);
});

Deno.test("worker starts no new step after 20 s", () => {
  assertEquals(START_NO_NEW_STEP_AFTER_MS, 20_000);
});

Deno.test("runWorker catch-path write is fenced on the claimed lease", async () => {
  const row = { id: "r1", status: "queued", attempts: 0, claims: 1, title: null, locked_until: "2026-02-02T00:00:00Z" } as unknown as RecipeRow;
  let claimed = 0, updates = 0;
  const fences: Array<[string, unknown]>[] = [];
  const db = {
    rpc: async () => ({ data: claimed++ === 0 ? [row] : [], error: null }),
    from: () => ({
      update: () => {
        const n = updates++;
        fences[n] = [];
        const result = n === 0 ? { data: null, error: { message: "boom" } } : { data: [], error: null };
        const chain = {
          eq: (c: string, v: unknown) => {
            fences[n].push([c, v]);
            return chain;
          },
          select: async () => result,
          then: (res: (v: typeof result) => unknown) => Promise.resolve(result).then(res),
        };
        return chain;
      },
    }),
  } as unknown as SupabaseClient;
  const deps = { fetchSource: async () => "x", loadMessageText: async () => null, now: () => new Date(), sendPush: null };
  await runWorker(db, deps as never, 5_000);
  assertEquals(updates, 2);
  assertEquals(fences[1], [["id", "r1"], ["locked_until", "2026-02-02T00:00:00Z"]]);
});

Deno.test("runWorker isolates a failing row and records the failure", async () => {
  const row = { id: "r1", status: "queued", attempts: 0, title: null } as unknown as RecipeRow;
  let claims = 0;
  const updates: Record<string, unknown>[] = [];
  const db = {
    rpc: async () => ({ data: claims++ === 0 ? [row] : [], error: null }),
    from: () => ({
      update: (patch: Record<string, unknown>) => {
        updates.push(patch);
        const result = updates.length === 1
          ? { data: null, error: { message: "boom" } }
          : { data: [], error: null };
        // Chainable and awaitable, like a PostgREST builder.
        const chain = {
          eq: () => chain,
          select: async () => result,
          then: (res: (v: typeof result) => unknown) => Promise.resolve(result).then(res),
        };
        return chain;
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
  assertEquals(last.error, "update recipe r1: boom");
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
