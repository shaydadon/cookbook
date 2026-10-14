import { assert, assertEquals, assertRejects, assertStringIncludes } from "jsr:@std/assert@1";
import { fetchSource, MAX_HTML_BYTES, MAX_RAW_CONTENT, readCapped } from "./fetch-source.ts";

function htmlResponse(html: string, status = 200) {
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}

Deno.test("web page with JSON-LD → serialised recipe + message text", async () => {
  const f = (async () => htmlResponse(
    `<script type="application/ld+json">{"@type":"Recipe","name":"Soup","recipeIngredient":["water"]}</script>`,
  )) as typeof fetch;
  const out = await fetchSource({ url: "https://a.test/r", platform: "web", messageText: "מומלץ!" }, f);
  assert(out);
  assertStringIncludes(out, '"name":"Soup"');
  assertStringIncludes(out, "מומלץ!");
});

Deno.test("instagram: uses og:description caption, not body junk", async () => {
  const f = (async () => htmlResponse(
    `<meta property="og:description" content="מתכון: 2 כוסות קמח, 1 ביצה. מערבבים ואופים 20 דקות"><body>Log in to Instagram</body>`,
  )) as typeof fetch;
  const out = await fetchSource({ url: "https://instagram.com/reel/x", platform: "instagram", messageText: null }, f);
  assert(out);
  assertStringIncludes(out, "2 כוסות קמח");
  assert(!out.includes("Log in"));
});

Deno.test("tiktok: oEmbed title is included", async () => {
  const f = (async (input: string | URL | Request) => {
    const u = String(input);
    if (u.startsWith("https://www.tiktok.com/oembed")) {
      return Response.json({ title: "פסטה ב-10 דקות: פסטה, שום, שמן זית, צ'ילי", author_name: "chef" });
    }
    return htmlResponse("<body></body>");
  }) as typeof fetch;
  const out = await fetchSource({ url: "https://tiktok.com/@chef/video/1", platform: "tiktok", messageText: null }, f);
  assert(out);
  assertStringIncludes(out, "פסטה ב-10 דקות");
});

Deno.test("nothing usable (login wall, no message) → null", async () => {
  const f = (async () => htmlResponse("<html><body></body></html>")) as typeof fetch;
  assertEquals(await fetchSource({ url: "https://instagram.com/p/x", platform: "instagram", messageText: null }, f), null);
});

Deno.test("network failure with no fallback text → throws (retryable)", async () => {
  const f = (() => Promise.reject(new Error("ECONNRESET"))) as typeof fetch;
  await assertRejects(() => fetchSource({ url: "https://a.test", platform: "web", messageText: null }, f), Error, "ECONNRESET");
});

Deno.test("network failure but WhatsApp message has the recipe → message text", async () => {
  const f = (() => Promise.reject(new Error("timeout"))) as typeof fetch;
  const msg = "עוגיות: 200 גרם חמאה, כוס סוכר, 2 כוסות קמח. מערבבים, יוצרים כדורים ואופים 12 דקות ב-180 מעלות";
  const out = await fetchSource({ url: "https://a.test", platform: "web", messageText: msg }, f);
  assertStringIncludes(out!, "200 גרם חמאה");
});

Deno.test("huge page is capped", async () => {
  const big = `<article>${"מלח ".repeat(2_000_000)}</article>`;
  const f = (async () => htmlResponse(big)) as typeof fetch;
  const out = await fetchSource({ url: "https://a.test", platform: "web", messageText: null }, f);
  assert(out && out.length <= MAX_RAW_CONTENT);
});

Deno.test("both fetches receive an AbortSignal", async () => {
  const signals: boolean[] = [];
  const f = (async (input: string | URL | Request, init?: RequestInit) => {
    signals.push(init?.signal instanceof AbortSignal);
    if (String(input).startsWith("https://www.tiktok.com/oembed")) return Response.json({ title: "x" });
    return htmlResponse("<body></body>");
  }) as typeof fetch;
  await fetchSource({ url: "https://tiktok.com/@c/video/1", platform: "tiktok", messageText: null }, f);
  assertEquals(signals, [true, true]);
});

Deno.test("503 page with no message → throws mentioning 503", async () => {
  const f = (async () => htmlResponse("down", 503)) as typeof fetch;
  await assertRejects(() => fetchSource({ url: "https://a.test", platform: "web", messageText: null }, f), Error, "503");
});

Deno.test("long JSON-LD does not truncate the WhatsApp message", async () => {
  const ld = JSON.stringify({ "@type": "Recipe", name: "Big", recipeInstructions: "מלח ".repeat(5000) });
  const f = (async () => htmlResponse(`<script type="application/ld+json">${ld}</script>`)) as typeof fetch;
  const msg = "ש".repeat(100);
  const out = await fetchSource({ url: "https://a.test", platform: "web", messageText: msg }, f);
  assert(out);
  assert(out.length <= MAX_RAW_CONTENT);
  assertStringIncludes(out, msg);
});

Deno.test("readCapped stops reading a huge streamed body", async () => {
  const chunk = new Uint8Array(64 * 1024).fill(97);
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(c) {
      if (sent >= 3 * 1024 * 1024) return c.close();
      sent += chunk.length;
      c.enqueue(chunk);
    },
  });
  const text = await readCapped(new Response(body), MAX_HTML_BYTES);
  assert(new TextEncoder().encode(text).length <= MAX_HTML_BYTES);
  assert(text.length > 0);
  assert(sent < 3 * 1024 * 1024);
});
