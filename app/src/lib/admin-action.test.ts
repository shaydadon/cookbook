import { FunctionsHttpError } from "@supabase/supabase-js";
import { beforeEach, expect, test, vi } from "vitest";
import { adminAction } from "./recipes";

// `supabase.functions` is a getter returning a fresh client, so mock the module's invoke instead.
const invoke = vi.fn();
vi.mock("./supabase", async (orig) => {
  const real = await orig<typeof import("./supabase")>();
  return {
    ...real,
    supabase: new Proxy(real.supabase, {
      get: (t, p, r) => (p === "functions" ? { invoke: (...a: unknown[]) => invoke(...a) } : Reflect.get(t, p, r)),
    }),
  };
});

beforeEach(() => {
  invoke.mockReset();
});

function mockInvoke(error: unknown) {
  invoke.mockResolvedValue({ data: null, error });
}

test("surfaces the server's Hebrew message from a 409", async () => {
  mockInvoke(new FunctionsHttpError(new Response(JSON.stringify({ error: "busy", message: "עסוק" }), { status: 409 })));
  await expect(adminAction({ action: "retry", recipe_id: "x" })).rejects.toThrow("עסוק");
});

test("non-JSON body falls back to a Hebrew message", async () => {
  mockInvoke(new FunctionsHttpError(new Response("<html>oops</html>", { status: 500 })));
  await expect(adminAction({ action: "retry", recipe_id: "x" })).rejects.toThrow("הפעולה נכשלה.");
});

test("other errors never surface English", async () => {
  mockInvoke(new Error("Failed to send a request to the Edge Function"));
  await expect(adminAction({ action: "retry", recipe_id: "x" })).rejects.toThrow("הפעולה נכשלה.");
});
