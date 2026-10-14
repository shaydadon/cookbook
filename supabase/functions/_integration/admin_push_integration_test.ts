import { assertEquals } from "jsr:@std/assert@1";
import { createClient } from "../_shared/npm.ts";
import { localEnv } from "./local.ts";

async function signIn(env: { url: string; serviceKey: string; anonKey: string }, email: string, role: "admin" | "member") {
  const admin = createClient(env.url, env.serviceKey, { auth: { persistSession: false } });
  await admin.from("allowed_emails").upsert({ email, whatsapp_name: email.split("@")[0], role });
  const password = crypto.randomUUID();
  const existing = (await admin.auth.admin.listUsers()).data.users.find((u) => u.email === email);
  if (existing) await admin.auth.admin.updateUserById(existing.id, { password });
  else await admin.auth.admin.createUser({ email, password, email_confirm: true });
  const client = createClient(env.url, env.anonKey, { auth: { persistSession: false } });
  const { data } = await client.auth.signInWithPassword({ email, password });
  return { token: data.session!.access_token, userId: data.user!.id, admin };
}

const call = (env: { url: string }, fn: string, token: string, body: unknown, method = "POST") =>
  fetch(`${env.url}/functions/v1/${fn}`, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });

Deno.test("member cannot run admin actions; admin retry with pasted text → rewriting", async () => {
  const env = await localEnv();
  const m = await signIn(env, "member-int@test.local", "member");
  const a = await signIn(env, "admin-int@test.local", "admin");
  const url = `https://adm.test/${crypto.randomUUID()}`;
  const { data: r } = await a.admin.from("recipes")
    .insert({ source_url: url, source_url_normalized: url, source_platform: "web", status: "needs_review", error: "x" })
    .select("id").single();

  const denied = await call(env, "admin-action", m.token, { action: "retry", recipe_id: r!.id });
  assertEquals(denied.status, 403);
  await denied.body?.cancel();

  const ok = await call(env, "admin-action", a.token, { action: "retry", recipe_id: r!.id, raw_content: "2 ביצים, מלח. מטגנים." });
  assertEquals((await ok.json()).status, "rewriting");
  // The kicked worker may already have advanced it (AI_FAKE=1), so accept any later step.
  const { data } = await a.admin.from("recipes").select("status, raw_content").eq("id", r!.id).single();
  assertEquals(data!.raw_content, "2 ביצים, מלח. מטגנים.");
  assertEquals(["rewriting", "imaging", "published"].includes(data!.status), true);

  const del = await call(env, "admin-action", a.token, { action: "delete", recipe_id: r!.id });
  assertEquals((await del.json()).deleted, true);
});

Deno.test("push-subscribe stores and removes the caller's subscription", async () => {
  const env = await localEnv();
  const m = await signIn(env, "member-int@test.local", "member");
  const endpoint = `https://push.test/${crypto.randomUUID()}`;
  const add = await call(env, "push-subscribe", m.token, { endpoint, keys: { p256dh: "p", auth: "a" } });
  assertEquals((await add.json()).ok, true);
  const { count } = await m.admin.from("push_subscriptions").select("*", { count: "exact", head: true }).eq("endpoint", endpoint);
  assertEquals(count, 1);
  const del = await call(env, "push-subscribe", m.token, { endpoint }, "DELETE");
  assertEquals((await del.json()).ok, true);
});
