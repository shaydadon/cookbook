import { assert, assertEquals, assertRejects, assertStringIncludes } from "jsr:@std/assert@1";
import { fetchSource, MAX_RAW_CONTENT } from "./fetch-source.ts";

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
