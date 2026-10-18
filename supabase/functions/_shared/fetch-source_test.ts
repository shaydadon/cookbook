import { assert, assertEquals, assertRejects, assertStringIncludes } from "jsr:@std/assert@1";
import { fetchSource, MAX_HTML_BYTES, MAX_RAW_CONTENT, readCapped } from "./fetch-source.ts";

const redirect = (to: string, status = 302) => new Response(null, { status, headers: { location: to } });
const RECIPE_HTML = `<script type="application/ld+json">{"@type":"Recipe","name":"Soup","recipeIngredient":["water"]}</script>`;

Deno.test("redirect to a private address is blocked: no fetch of it, null (not retryable)", async () => {
  const calls: string[] = [];
  const redirects: (string | undefined)[] = [];
  const f = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push(String(input));
    redirects.push(init?.redirect);
    return redirect("http://169.254.169.254/latest/meta-data");
  }) as typeof fetch;
  const out = await fetchSource({ url: "https://evil.test/r", platform: "web", messageText: null }, f);
  assertEquals(out, null);
  assertEquals(calls, ["https://evil.test/r"]);
  assertEquals(redirects, ["manual"]);
});

Deno.test("blocked redirect still uses the WhatsApp message text", async () => {
  const f = (async () => redirect("http://localhost:54321/rest/v1/")) as typeof fetch;
  const msg = "עוגיות: 200 גרם חמאה, כוס סוכר, 2 כוסות קמח. מערבבים, יוצרים כדורים ואופים 12 דקות";
  const out = await fetchSource({ url: "https://evil.test/r", platform: "web", messageText: msg }, f);
  assertStringIncludes(out!, "200 גרם חמאה");
});

Deno.test("a private source URL is never fetched", async () => {
  let calls = 0;
  const f = (async () => {
    calls++;
    return htmlResponse(RECIPE_HTML);
  }) as typeof fetch;
  assertEquals(await fetchSource({ url: "http://10.0.0.5/r", platform: "web", messageText: null }, f), null);
  assertEquals(calls, 0);
});

Deno.test("public relative redirects are followed manually", async () => {
  const calls: string[] = [];
  const f = (async (input: string | URL | Request) => {
    const u = String(input);
    calls.push(u);
    if (u === "https://a.test/old") return redirect("/new", 301);
    return htmlResponse(RECIPE_HTML);
  }) as typeof fetch;
  const out = await fetchSource({ url: "https://a.test/old", platform: "web", messageText: null }, f);
  assertStringIncludes(out!, '"name":"Soup"');
  assertEquals(calls, ["https://a.test/old", "https://a.test/new"]);
});

Deno.test("more than 5 redirects → nothing usable", async () => {
  let n = 0;
  const f = (async () => redirect(`https://a.test/hop${++n}`)) as typeof fetch;
  assertEquals(await fetchSource({ url: "https://a.test/start", platform: "web", messageText: null }, f), null);
  assertEquals(n, 6); // the start request + 5 followed redirects
});

Deno.test("allowLocal permits the local fixture host (local E2E only)", async () => {
  const f = (async () => htmlResponse(RECIPE_HTML)) as typeof fetch;
  const input = { url: "http://host.docker.internal:5199/r", platform: "web" as const, messageText: null };
  assertEquals(await fetchSource(input, f), null);
  assertStringIncludes((await fetchSource(input, f, { allowLocal: true }))!, '"name":"Soup"');
});

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

Deno.test("web page: JSON-LD article body is used instead of unrelated <article> junk", async () => {
  const ld = { "@type": "NewsArticle", articleBody: "מצרכים: 200 גרם פרגיות, 1/2 כוס קשיו. אופן ההכנה: מטגנים ומגישים עם אורז." };
  const f = (async () => htmlResponse(
    `<script type="application/ld+json">${JSON.stringify(ld)}</script><article>פרסומת: אסם-שדרות</article>`,
  )) as typeof fetch;
  const out = await fetchSource({ url: "https://www.israelhayom.co.il/food/recipes/article/1", platform: "web", messageText: null }, f);
  assertStringIncludes(out!, "200 גרם פרגיות");
  assert(!out!.includes("אסם-שדרות"));
});

Deno.test("facebook: asks as a crawler and uses the full post text, not the truncated preview", async () => {
  const uas: string[] = [];
  const full = "עוגיות שיבולת שועל\nמצרכים: כוס שיבולת שועל, 2 ביצים, חצי כוס סוכר\nאופן הכנה: מערבבים ואופים 12 דקות ב-180 מעלות";
  const f = (async (_input: string | URL | Request, init?: RequestInit) => {
    uas.push(new Headers(init?.headers).get("user-agent") ?? "");
    return htmlResponse(
      `<meta property="og:description" content="עוגיות שיבולת שועל מצרכים: כוס שיבולת שועל..." /><script>{"text":${JSON.stringify(full)}}</script>`,
    );
  }) as typeof fetch;
  const out = await fetchSource({ url: "https://www.facebook.com/share/v/x/", platform: "facebook", messageText: null }, f);
  assertStringIncludes(out!, "אופן הכנה: מערבבים ואופים 12 דקות");
  assert(/bot|crawler|externalhit/i.test(uas[0]), `crawler user agent expected, got ${uas[0]}`);
});

Deno.test("a WhatsApp message that is only the link does not count as recipe content", async () => {
  const f = (async () => htmlResponse("Access Denied", 403)) as typeof fetch;
  const url = "https://www.israelhayom.co.il/food/recipes/article/21615142?shem=dsdf%2Csharefoc";
  assertEquals(await fetchSource({ url, platform: "web", messageText: url }, f), null);
});
