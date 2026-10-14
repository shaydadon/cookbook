import { getMember } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/db.ts";
import { background, json, preflight, withErrors } from "../_shared/http.ts";
import { ingest } from "../_shared/ingest-core.ts";
import { extractUrls } from "../_shared/url.ts";
import { kickWorker } from "../_shared/worker.ts";

Deno.serve(withErrors(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const db = serviceClient();
  const fromMake = req.headers.get("x-ingest-secret") === Deno.env.get("INGEST_SECRET");
  const member = fromMake ? null : await getMember(req, db);
  if (!fromMake && !member) return json({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => null) as
    | { text?: unknown; url?: unknown; sender_name?: unknown; sent_at?: unknown }
    | null;
  const text = [body?.text, body?.url].filter((s): s is string => typeof s === "string").join("\n");
  if (extractUrls(text).length === 0) return json({ error: "no_url", message: "לא נמצא קישור בהודעה" }, 400);

  const sentAt = typeof body?.sent_at === "string" && !Number.isNaN(Date.parse(body.sent_at))
    ? new Date(body.sent_at).toISOString()
    : null;

  const results = await ingest(db, {
    text,
    senderName: member?.display_name ?? (typeof body?.sender_name === "string" ? body.sender_name : null),
    sentAt,
    via: fromMake ? "whatsapp" : "app",
    submittedBy: member?.id ?? null,
  });

  if (results.some((r) => !r.duplicate)) background(kickWorker());
  return json({ results });
}));
