import type { IngestInput, IngestResult } from "./ingest-core.ts";
import { json } from "./http.ts";
import { extractUrls } from "./url.ts";

/**
 * Direct Green API webhook receiver: Green API → this function → ingest, with no Make in between.
 *
 * Green API resends the *same* notification every 60 s until it gets a 200, holding up the queue behind it.
 * So everything we deliberately ignore (other chats, no link, other notification types, malformed bodies)
 * is acknowledged with 200; only a temporary failure while ingesting answers 500, to get the retry we want.
 */
export interface GreenDeps {
  /** Shared secret set as the instance's "webhook authorization header" (webhookUrlToken). Empty = refuse all. */
  token: string;
  /** WhatsApp chat ids whose links become recipes (the recipes group). */
  groupIds: string[];
  ingest(input: IngestInput): Promise<IngestResult[]>;
  /** Start the worker after a new recipe was queued (runs after the response). */
  kick(): void;
}

// Messages written by others, and by the linked phone itself (the group owner shares links too).
const MESSAGE_TYPES = new Set(["incomingMessageReceived", "outgoingMessageReceived"]);

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? v as Obj : {});
const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** The text that can carry a link, for every Green API message shape: plain, link preview, reply, media caption. */
export function messageText(messageData: unknown): string {
  const m = obj(messageData);
  return str(obj(m.textMessageData).textMessage) ||
    str(obj(m.extendedTextMessageData).text) ||
    str(obj(m.fileMessageData).caption);
}

/** Constant-time comparison, so the token can't be guessed byte by byte from response timing. */
function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

function authorized(req: Request, token: string): boolean {
  if (!token) return false; // fail closed when the secret isn't configured
  const header = req.headers.get("authorization") ?? "";
  const given = header.replace(/^Bearer\s+/i, "").trim();
  return sameSecret(given, token);
}

export async function handleGreenWebhook(req: Request, deps: GreenDeps): Promise<Response> {
  if (!authorized(req, deps.token)) return json({ error: "unauthorized" }, 401);

  let body: Obj;
  try {
    body = obj(JSON.parse(await req.text()));
  } catch {
    console.log("whatsapp-webhook: ignored malformed body");
    return json({ ok: true, ignored: "malformed" });
  }

  const type = str(body.typeWebhook);
  if (!MESSAGE_TYPES.has(type)) return json({ ok: true, ignored: "type" });

  const sender = obj(body.senderData);
  const chatId = str(sender.chatId);
  // Other chats are dropped without logging their content (this may be a personal number).
  if (!deps.groupIds.includes(chatId)) return json({ ok: true, ignored: "chat" });

  const text = messageText(body.messageData);
  const messageType = str(obj(body.messageData).typeMessage);
  if (extractUrls(text).length === 0) {
    console.log(`whatsapp-webhook: group message without a link (${messageType})`);
    return json({ ok: true, ignored: "no_link" });
  }

  const ts = typeof body.timestamp === "number" ? body.timestamp : NaN;
  const senderName = str(sender.senderName) || str(sender.senderContactName) || str(sender.sender).replace(/@.*$/, "") || null;
  let results: IngestResult[];
  try {
    results = await deps.ingest({
      text,
      senderName,
      sentAt: Number.isFinite(ts) ? new Date(ts * 1000).toISOString() : null,
      via: "whatsapp",
      submittedBy: null,
    });
  } catch (e) {
    console.error("whatsapp-webhook: ingest failed, Green API will retry", e);
    return json({ error: "ingest_failed" }, 500);
  }

  console.log(`whatsapp-webhook: ${type} ${messageType} → ${results.length} link(s), new: ${results.filter((r) => !r.duplicate).length}`);
  if (results.some((r) => !r.duplicate)) deps.kick();
  return json({ ok: true, results });
}
