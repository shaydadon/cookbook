import { getMember } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/db.ts";
import { json, preflight, withErrors } from "../_shared/http.ts";

Deno.serve(withErrors(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST" && req.method !== "DELETE") return json({ error: "method_not_allowed" }, 405);
  const db = serviceClient();
  const member = await getMember(req, db);
  if (!member) return json({ error: "unauthorized" }, 401);
  const body = await req.json().catch(() => null) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | null;
  if (!body?.endpoint) return json({ error: "endpoint_required" }, 400);

  if (req.method === "DELETE") {
    await db.from("push_subscriptions").delete().eq("endpoint", body.endpoint).eq("member_id", member.id);
    return json({ ok: true });
  }
  if (!body.keys?.p256dh || !body.keys?.auth) return json({ error: "keys_required" }, 400);
  // Upsert on endpoint: ownership moves to whoever posts the endpoint together with its keys,
  // because the browser (the current device user) is the holder of those keys.
  const { error } = await db.from("push_subscriptions").upsert(
    { member_id: member.id, endpoint: body.endpoint, p256dh: body.keys.p256dh, auth: body.keys.auth },
    { onConflict: "endpoint" },
  );
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}));
