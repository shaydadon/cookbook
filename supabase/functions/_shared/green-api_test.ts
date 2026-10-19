import { assertEquals } from "jsr:@std/assert@1";
import { type GreenDeps, handleGreenWebhook, messageText } from "./green-api.ts";
import type { IngestInput, IngestResult } from "./ingest-core.ts";

const GROUP = "120363037246545831@g.us";
const TOKEN = "test-token-123";

// Shapes follow Green API's webhook format (incomingMessageReceived / outgoingMessageReceived).
function webhook(messageData: Record<string, unknown>, over: Record<string, unknown> = {}) {
  return {
    typeWebhook: "incomingMessageReceived",
    instanceData: { idInstance: 7103499502, wid: "972526203423@c.us", typeInstance: "whatsapp" },
    timestamp: 1792320655,
    idMessage: "AC9CC1F7B6C34BDC76",
    senderData: { chatId: GROUP, chatName: "מתכונים", sender: "972508732340@c.us", senderName: "אביבה", senderContactName: "" },
    messageData,
    ...over,
  };
}
const text = (t: string) => ({ typeMessage: "textMessage", textMessageData: { textMessage: t } });

function setup(ingestImpl?: (i: IngestInput) => Promise<IngestResult[]>) {
  const calls: IngestInput[] = [];
  let kicks = 0;
  const deps: GreenDeps = {
    token: TOKEN,
    groupIds: [GROUP],
    ingest: (i) => {
      calls.push(i);
      return ingestImpl ? ingestImpl(i) : Promise.resolve([{ url: "u", recipe_id: "r1", status: "queued", duplicate: false }]);
    },
    kick: () => { kicks++; },
  };
  return { deps, calls, kicks: () => kicks };
}

const post = (body: unknown, auth: string | null = `Bearer ${TOKEN}`) =>
  new Request("https://x.test/whatsapp-webhook", {
    method: "POST",
    headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

Deno.test("a link in the recipes group is ingested as a WhatsApp share and the worker is kicked", async () => {
  const { deps, calls, kicks } = setup();
  const res = await handleGreenWebhook(post(webhook(text("נסו את זה https://a.test/r"))), deps);
  assertEquals(res.status, 200);
  assertEquals(calls, [{
    text: "נסו את זה https://a.test/r", senderName: "אביבה", sentAt: new Date(1792320655 * 1000).toISOString(),
    via: "whatsapp", submittedBy: null,
  }]);
  assertEquals(kicks(), 1);
});

Deno.test("wrong or missing token → 401 and nothing is ingested", async () => {
  const { deps, calls } = setup();
  assertEquals((await handleGreenWebhook(post(webhook(text("https://a.test/r")), "Bearer nope"), deps)).status, 401);
  assertEquals((await handleGreenWebhook(post(webhook(text("https://a.test/r")), null), deps)).status, 401);
  assertEquals(calls.length, 0);
});

Deno.test("the token is also accepted without the Bearer prefix", async () => {
  const { deps, calls } = setup();
  assertEquals((await handleGreenWebhook(post(webhook(text("https://a.test/r")), TOKEN), deps)).status, 200);
  assertEquals(calls.length, 1);
});

Deno.test("no configured token → every request is refused (fail closed)", async () => {
  const { deps, calls } = setup();
  const res = await handleGreenWebhook(post(webhook(text("https://a.test/r")), "Bearer "), { ...deps, token: "" });
  assertEquals(res.status, 401);
  assertEquals(calls.length, 0);
});

Deno.test("messages from other chats are acknowledged (200) but ignored", async () => {
  const { deps, calls } = setup();
  const other = webhook(text("https://a.test/r"), {
    senderData: { chatId: "120363023896386900@g.us", chatName: "כל הפאן", sender: "972500000000@c.us", senderName: "x" },
  });
  assertEquals((await handleGreenWebhook(post(other), deps)).status, 200);
  assertEquals(calls.length, 0);
});

Deno.test("a message without a link is acknowledged but not ingested", async () => {
  const { deps, calls } = setup();
  assertEquals((await handleGreenWebhook(post(webhook(text("בתאבון!"))), deps)).status, 200);
  assertEquals(calls.length, 0);
});

Deno.test("non-message notifications (status, state changes) are acknowledged and ignored", async () => {
  const { deps, calls } = setup();
  const res = await handleGreenWebhook(post({ typeWebhook: "stateInstanceChanged", stateInstance: "authorized" }), deps);
  assertEquals(res.status, 200);
  assertEquals(calls.length, 0);
});

Deno.test("own messages sent from the phone (outgoingMessageReceived) count too", async () => {
  const { deps, calls } = setup();
  const own = webhook(text("https://a.test/mine"), {
    typeWebhook: "outgoingMessageReceived",
    senderData: { chatId: GROUP, chatName: "מתכונים", sender: "972526203423@c.us", senderName: "shay", senderContactName: "" },
  });
  assertEquals((await handleGreenWebhook(post(own), deps)).status, 200);
  assertEquals(calls[0].senderName, "shay");
});

Deno.test("malformed JSON is acknowledged (so Green API's queue is not held up) and ignored", async () => {
  const { deps, calls } = setup();
  assertEquals((await handleGreenWebhook(post("{not json"), deps)).status, 200);
  assertEquals(calls.length, 0);
});

Deno.test("a failure while ingesting answers 500 so Green API retries the message", async () => {
  const { deps } = setup(() => Promise.reject(new Error("db down")));
  assertEquals((await handleGreenWebhook(post(webhook(text("https://a.test/r"))), deps)).status, 500);
});

Deno.test("messageText finds the link in every message shape that can carry one", () => {
  assertEquals(messageText(text("a https://t.test")), "a https://t.test");
  // link preview
  assertEquals(messageText({ typeMessage: "extendedTextMessage", extendedTextMessageData: { text: "https://fb.test/p/1", description: "d", title: "t" } }), "https://fb.test/p/1");
  // reply to another message
  assertEquals(messageText({ typeMessage: "quotedMessage", extendedTextMessageData: { text: "גם זה https://q.test" }, quotedMessage: { typeMessage: "textMessage", textMessage: "old" } }), "גם זה https://q.test");
  // forwarded post with a photo / video: the link is in the caption
  assertEquals(messageText({ typeMessage: "imageMessage", fileMessageData: { caption: "מתכון https://i.test", downloadUrl: "https://cdn.test/x.jpg" } }), "מתכון https://i.test");
  assertEquals(messageText({ typeMessage: "videoMessage", fileMessageData: { caption: "https://v.test" } }), "https://v.test");
  // nothing usable
  assertEquals(messageText({ typeMessage: "stickerMessage", fileMessageData: { downloadUrl: "https://cdn.test/s.webp" } }), "");
  assertEquals(messageText(undefined), "");
});

Deno.test("sender name falls back to the contact name, then the number", async () => {
  const { deps, calls } = setup();
  await handleGreenWebhook(post(webhook(text("https://a.test/r"), {
    senderData: { chatId: GROUP, sender: "972500000001@c.us", senderName: "", senderContactName: "אמא" },
  })), deps);
  await handleGreenWebhook(post(webhook(text("https://a.test/s"), {
    senderData: { chatId: GROUP, sender: "972500000002@c.us", senderName: "", senderContactName: "" },
  })), deps);
  assertEquals(calls.map((c) => c.senderName), ["אמא", "972500000002"]);
});
