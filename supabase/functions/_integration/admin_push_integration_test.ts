import { assertEquals, assertNotEquals } from "jsr:@std/assert@1";
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

type Admin = Awaited<ReturnType<typeof signIn>>["admin"];

async function insertRecipe(admin: Admin, fields: Record<string, unknown>) {
  const url = `https://adm.test/${crypto.randomUUID()}`;
  const { data, error } = await admin.from("recipes")
    .insert({ source_url: url, source_url_normalized: url, source_platform: "web", ...fields })
    .select("id").single();
  if (error) throw new Error(error.message);
  return data!.id as string;
}

Deno.test("member cannot run admin actions; admin retry with pasted text → rewriting", async () => {
  const env = await localEnv();
  const m = await signIn(env, "member-int@test.local", "member");
  const a = await signIn(env, "admin-int@test.local", "admin");
  const id = await insertRecipe(a.admin, { status: "needs_review", error: "x" });
  try {
    const denied = await call(env, "admin-action", m.token, { action: "retry", recipe_id: id });
    assertEquals(denied.status, 403);
    await denied.body?.cancel();

    const ok = await call(env, "admin-action", a.token, { action: "retry", recipe_id: id, raw_content: "2 ביצים, מלח. מטגנים." });
    assertEquals((await ok.json()).status, "rewriting");
    // The kicked worker may already have advanced it (AI_FAKE=1), so accept any later step.
    const { data } = await a.admin.from("recipes").select("status, raw_content").eq("id", id).single();
    assertEquals(data!.raw_content, "2 ביצים, מלח. מטגנים.");
    assertEquals(["rewriting", "imaging", "published"].includes(data!.status), true);

    const del = await call(env, "admin-action", a.token, { action: "delete", recipe_id: id });
    assertEquals((await del.json()).deleted, true);
  } finally {
    await a.admin.from("recipes").delete().eq("id", id);
  }
});

Deno.test("retry is refused (409) while leased or already published", async () => {
  const env = await localEnv();
  const a = await signIn(env, "admin-int@test.local", "admin");
  const leased = await insertRecipe(a.admin, {
    status: "rewriting", locked_until: new Date(Date.now() + 5 * 60_000).toISOString(),
  });
  const published = await insertRecipe(a.admin, { status: "published", title: "t" });
  try {
    const r1 = await call(env, "admin-action", a.token, { action: "retry", recipe_id: leased });
    assertEquals(r1.status, 409);
    assertEquals((await r1.json()).error, "busy");
    const r2 = await call(env, "admin-action", a.token, { action: "retry", recipe_id: published });
    assertEquals(r2.status, 409);
    assertEquals((await r2.json()).error, "published");
  } finally {
    await a.admin.from("recipes").delete().in("id", [leased, published]);
  }
});

Deno.test("delete removes the row", async () => {
  const env = await localEnv();
  const a = await signIn(env, "admin-int@test.local", "admin");
  const id = await insertRecipe(a.admin, { status: "failed" });
  try {
    const del = await call(env, "admin-action", a.token, { action: "delete", recipe_id: id });
    assertEquals((await del.json()).deleted, true);
    const { count } = await a.admin.from("recipes").select("*", { count: "exact", head: true }).eq("id", id);
    assertEquals(count, 0);
  } finally {
    await a.admin.from("recipes").delete().eq("id", id);
  }
});

Deno.test("regenerate-image replaces the image and removes the old file", async () => {
  const env = await localEnv();
  const a = await signIn(env, "admin-int@test.local", "admin");
  const id = crypto.randomUUID();
  const oldPath = `${id}/old.webp`;
  const bucket = a.admin.storage.from("recipe-images");
  await bucket.upload(oldPath, new Uint8Array([1, 2, 3]), { contentType: "image/webp" });
  const url = `https://adm.test/${crypto.randomUUID()}`;
  await a.admin.from("recipes").insert({
    id, source_url: url, source_url_normalized: url, source_platform: "web",
    status: "published", title: "שקשוקה", image_path: oldPath,
  });
  try {
    const res = await call(env, "admin-action", a.token, { action: "regenerate-image", recipe_id: id });
    assertEquals(res.status, 200);
    const { image_path } = await res.json();
    assertNotEquals(image_path, oldPath);
    const { data: row } = await a.admin.from("recipes").select("image_path, status").eq("id", id).single();
    assertEquals(row!.image_path, image_path);
    assertEquals(row!.status, "published");
    const { data: files } = await bucket.list(id);
    const names = (files ?? []).map((f) => f.name);
    assertEquals(names.includes("old.webp"), false);
    assertEquals(names.includes(image_path.split("/")[1]), true);
  } finally {
    const { data: files } = await bucket.list(id);
    if (files?.length) await bucket.remove(files.map((f) => `${id}/${f.name}`));
    await a.admin.from("recipes").delete().eq("id", id);
  }
});

Deno.test("push-subscribe stores and removes the caller's subscription", async () => {
  const env = await localEnv();
  const m = await signIn(env, "member-int@test.local", "member");
  const endpoint = `https://push.test/${crypto.randomUUID()}`;
  try {
    const add = await call(env, "push-subscribe", m.token, { endpoint, keys: { p256dh: "p", auth: "a" } });
    assertEquals((await add.json()).ok, true);
    const { count } = await m.admin.from("push_subscriptions").select("*", { count: "exact", head: true }).eq("endpoint", endpoint);
    assertEquals(count, 1);
    const del = await call(env, "push-subscribe", m.token, { endpoint }, "DELETE");
    assertEquals((await del.json()).ok, true);
  } finally {
    await m.admin.from("push_subscriptions").delete().eq("endpoint", endpoint);
  }
});

Deno.test("push DELETE only removes the caller's own subscription", async () => {
  const env = await localEnv();
  const a = await signIn(env, "member-int@test.local", "member");
  const b = await signIn(env, "member-int-b@test.local", "member");
  const endpoint = `https://push.test/${crypto.randomUUID()}`;
  const count = async () =>
    (await a.admin.from("push_subscriptions").select("*", { count: "exact", head: true }).eq("endpoint", endpoint)).count;
  try {
    const add = await call(env, "push-subscribe", a.token, { endpoint, keys: { p256dh: "p", auth: "a" } });
    assertEquals((await add.json()).ok, true);
    const byB = await call(env, "push-subscribe", b.token, { endpoint }, "DELETE");
    assertEquals((await byB.json()).ok, true);
    assertEquals(await count(), 1);
    const byA = await call(env, "push-subscribe", a.token, { endpoint }, "DELETE");
    assertEquals((await byA.json()).ok, true);
    assertEquals(await count(), 0);
  } finally {
    await a.admin.from("push_subscriptions").delete().eq("endpoint", endpoint);
  }
});
