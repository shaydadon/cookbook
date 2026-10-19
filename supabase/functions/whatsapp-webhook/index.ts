import { serviceClient } from "../_shared/db.ts";
import { handleGreenWebhook } from "../_shared/green-api.ts";
import { background, json, withErrors } from "../_shared/http.ts";
import { ingest } from "../_shared/ingest-core.ts";
import { kickWorker } from "../_shared/worker.ts";

// Green API posts every notification here (instance setting webhookUrl), with the shared secret
// (webhookUrlToken) as "Authorization: Bearer <token>". Configure with function secrets:
//   GREEN_API_WEBHOOK_TOKEN  – the same value as the instance's webhook authorization header
//   WHATSAPP_GROUP_IDS       – comma-separated chat ids whose links become recipes (…@g.us)
Deno.serve(withErrors((req) => {
  if (req.method !== "POST") return Promise.resolve(json({ error: "method_not_allowed" }, 405));
  const db = serviceClient();
  return handleGreenWebhook(req, {
    token: Deno.env.get("GREEN_API_WEBHOOK_TOKEN") ?? "",
    groupIds: (Deno.env.get("WHATSAPP_GROUP_IDS") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    ingest: (input) => ingest(db, input),
    kick: () => background(kickWorker()),
  });
}));
