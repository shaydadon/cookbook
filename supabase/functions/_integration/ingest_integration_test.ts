import { assertEquals } from "jsr:@std/assert@1";
import { ingest } from "../_shared/ingest-core.ts";
import { createClient } from "../_shared/npm.ts";
import { localEnv } from "./local.ts";

const noResolve = async (u: string) => u;

Deno.test("variants of one URL make one recipe with several shares", async () => {
  const env = await localEnv();
  const db = createClient(env.url, env.serviceKey, { auth: { persistSession: false } });
  const slug = crypto.randomUUID();

  const a = await ingest(db, { text: `נסו! https://www.dedup.test/r/${slug}/?utm_source=wa`, senderName: "רחל", sentAt: "2026-10-01T10:00:00Z", via: "whatsapp", submittedBy: null }, noResolve);
  const b = await ingest(db, { text: `https://m.dedup.test/r/${slug}#x`, senderName: "דני", sentAt: "2026-10-02T10:00:00Z", via: "whatsapp", submittedBy: null }, noResolve);

  assertEquals(a[0].duplicate, false);
  assertEquals(b[0].duplicate, true);
  assertEquals(a[0].recipe_id, b[0].recipe_id);
  const { count } = await db.from("shares").select("*", { count: "exact", head: true }).eq("recipe_id", a[0].recipe_id);
  assertEquals(count, 2);
  await db.from("recipes").delete().eq("id", a[0].recipe_id);
});

Deno.test("the same message delivered twice does not duplicate shares", async () => {
  const env = await localEnv();
  const db = createClient(env.url, env.serviceKey, { auth: { persistSession: false } });
  const msg = { text: `https://dup.test/${crypto.randomUUID()}`, senderName: "רחל", sentAt: "2026-10-03T08:00:00Z", via: "import" as const, submittedBy: null };
  const first = await ingest(db, msg, noResolve);
  await ingest(db, msg, noResolve);
  const { count } = await db.from("shares").select("*", { count: "exact", head: true }).eq("recipe_id", first[0].recipe_id);
  assertEquals(count, 1);
  await db.from("recipes").delete().eq("id", first[0].recipe_id);
});

Deno.test("two links in one message make two recipes; invalid URLs are skipped", async () => {
  const env = await localEnv();
  const db = createClient(env.url, env.serviceKey, { auth: { persistSession: false } });
  const id = crypto.randomUUID();
  const res = await ingest(db, { text: `https://two.test/${id}/a ו- https://two.test/${id}/b וגם http://[bad`, senderName: null, sentAt: null, via: "app", submittedBy: null }, noResolve);
  assertEquals(res.length, 2);
  assertEquals(res.every((r) => r.status === "queued"), true);
  await db.from("recipes").delete().in("id", res.map((r) => r.recipe_id));
});
