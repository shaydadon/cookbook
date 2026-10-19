import { assertEquals } from "jsr:@std/assert@1";
import { ingest, isMakeRequest } from "./ingest-core.ts";
import type { SupabaseClient } from "./npm.ts";

const req = (secret?: string) =>
  new Request("http://x/ingest", { method: "POST", headers: secret === undefined ? {} : { "x-ingest-secret": secret } });

Deno.test("isMakeRequest fails closed when INGEST_SECRET is not configured", () => {
  assertEquals(isMakeRequest(req(), undefined), false);
  assertEquals(isMakeRequest(req(""), undefined), false);
  assertEquals(isMakeRequest(req(""), ""), false);
});

Deno.test("isMakeRequest requires the exact secret", () => {
  assertEquals(isMakeRequest(req("s3cret"), "s3cret"), true);
  assertEquals(isMakeRequest(req("wrong"), "s3cret"), false);
  assertEquals(isMakeRequest(req(), "s3cret"), false);
});

Deno.test("ingest skips private/internal URLs and short links that expand to them, without touching the DB", async () => {
  const db = { from: () => { throw new Error("DB must not be used"); } } as unknown as SupabaseClient;
  const resolved: string[] = [];
  const resolve = async (u: string) => {
    resolved.push(u);
    return "http://127.0.0.1:54321/rest/v1/";
  };
  const res = await ingest(db, {
    text: "http://localhost:54321/x http://169.254.169.254/latest https://bit.ly/abc",
    senderName: null, sentAt: null, via: "app", submittedBy: null,
  }, resolve, { allowLocal: false });
  assertEquals(res, []);
  assertEquals(resolved, ["https://bit.ly/abc"]); // private raw URLs are not even resolved
});

// A fake supabase-js query chain that records the recipe insert and answers "not found" to lookups.
function recordingDb() {
  const inserts: Record<string, unknown>[] = [];
  const chain = (table: string) => {
    const q: Record<string, unknown> = {};
    const self = () => q;
    Object.assign(q, {
      select: self, eq: self, single: () => Promise.resolve({ data: { id: "r1", status: "queued" }, error: null }),
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      insert: (row: Record<string, unknown>) => { if (table === "recipes") inserts.push(row); return q; },
      upsert: () => Promise.resolve({ error: null }),
    });
    return q;
  };
  return { db: { from: chain } as unknown as SupabaseClient, inserts };
}

Deno.test("the recipe stores the resolved address to fetch, not a redirect wrapper", async () => {
  const { db, inserts } = recordingDb();
  const wrapper = "https://www.google.com/url?sa=t&url=https://a.test/recipe&usg=AOv";
  await ingest(db, { text: `נסו ${wrapper}`, senderName: "x", sentAt: null, via: "whatsapp", submittedBy: null },
    async () => "https://a.test/recipe", { allowLocal: false });
  assertEquals(inserts.length, 1);
  assertEquals(inserts[0].source_url, "https://a.test/recipe");
  assertEquals(inserts[0].source_url_normalized, "https://a.test/recipe");
});
