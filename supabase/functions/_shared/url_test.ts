import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { detectPlatform, extractUrls, normalizeUrl, RESOLVE_TIMEOUT_MS, resolveUrl } from "./url.ts";

Deno.test("resolveUrl passes a 5 s abort signal to fetch", async () => {
  let signal: unknown;
  const f = (async (_input: string | URL | Request, init?: RequestInit) => {
    signal = init?.signal;
    return new Response(null, { status: 200 });
  }) as typeof fetch;
  await resolveUrl("https://bit.ly/x", f);
  assertEquals(signal instanceof AbortSignal, true);
  assertEquals(RESOLVE_TIMEOUT_MS, 5000);
});

Deno.test("resolveUrl falls back to the input when the fetch is aborted (timeout)", async () => {
  // Simulate the timeout firing: reject the way fetch does when its signal aborts.
  const f = (() => Promise.reject(new DOMException("The signal has been aborted", "TimeoutError"))) as typeof fetch;
  assertEquals(await resolveUrl("https://bit.ly/slow", f), "https://bit.ly/slow");
});

Deno.test("extractUrls finds links in Hebrew text and strips trailing punctuation", () => {
  const text = "תראו את זה!! https://www.foodsdictionary.co.il/Recipes/1234. וגם (https://youtu.be/abc123?si=xyz) יאמי";
  assertEquals(extractUrls(text), [
    "https://www.foodsdictionary.co.il/Recipes/1234",
    "https://youtu.be/abc123?si=xyz",
  ]);
});

Deno.test("extractUrls dedupes and returns [] when none", () => {
  assertEquals(extractUrls("https://a.test/x https://a.test/x"), ["https://a.test/x"]);
  assertEquals(extractUrls("אין פה קישור"), []);
});

Deno.test("normalizeUrl collapses common variants of the same page", () => {
  const variants = [
    "https://www.example.co.il/recipe/shakshuka/",
    "http://example.co.il/recipe/shakshuka?utm_source=whatsapp&utm_medium=social",
    "https://m.example.co.il/recipe/shakshuka#comments",
    "https://EXAMPLE.co.il/recipe/shakshuka?fbclid=abc",
  ];
  for (const v of variants) assertEquals(normalizeUrl(v), "https://example.co.il/recipe/shakshuka");
});

Deno.test("normalizeUrl keeps meaningful query params, sorted", () => {
  assertEquals(normalizeUrl("https://site.test/r?id=5&a=1&utm_campaign=x"), "https://site.test/r?a=1&id=5");
});

Deno.test("normalizeUrl canonicalises YouTube forms", () => {
  const want = "https://youtube.com/watch?v=abc123";
  assertEquals(normalizeUrl("https://youtu.be/abc123?si=zzz"), want);
  assertEquals(normalizeUrl("https://www.youtube.com/watch?v=abc123&feature=share"), want);
  assertEquals(normalizeUrl("https://youtube.com/shorts/abc123?si=q"), want);
  assertEquals(normalizeUrl("https://m.youtube.com/watch?v=abc123"), want);
});

Deno.test("normalizeUrl strips Instagram share params", () => {
  assertEquals(normalizeUrl("https://www.instagram.com/reel/C0dE/?igsh=MWQ1ZGUxMzBkMA=="),
               "https://instagram.com/reel/C0dE");
});

Deno.test("normalizeUrl rejects garbage", () => {
  assertThrows(() => normalizeUrl("not a url"), TypeError);
});

Deno.test("detectPlatform", () => {
  assertEquals(detectPlatform("https://instagram.com/reel/x"), "instagram");
  assertEquals(detectPlatform("https://tiktok.com/@a/video/1"), "tiktok");
  assertEquals(detectPlatform("https://youtube.com/watch?v=1"), "youtube");
  assertEquals(detectPlatform("https://facebook.com/x"), "facebook");
  assertEquals(detectPlatform("https://fb.watch/x"), "facebook");
  assertEquals(detectPlatform("https://mako.co.il/food"), "web");
});

Deno.test("resolveUrl expands short links and leaves others alone", async () => {
  const calls: string[] = [];
  const fakeFetch = (async (input: string | URL | Request) => {
    calls.push(String(input));
    const res = new Response(null, { status: 200 });
    Object.defineProperty(res, "url", { value: "https://www.tiktok.com/@chef/video/42?_r=1" });
    return res;
  }) as typeof fetch;
  assertEquals(await resolveUrl("https://vm.tiktok.com/ZS123/", fakeFetch), "https://www.tiktok.com/@chef/video/42?_r=1");
  assertEquals(await resolveUrl("https://example.com/a", fakeFetch), "https://example.com/a");
  assertEquals(calls.length, 1);
});

Deno.test("resolveUrl returns the input when the network fails", async () => {
  const failing = (() => Promise.reject(new Error("offline"))) as typeof fetch;
  assertEquals(await resolveUrl("https://bit.ly/abc", failing), "https://bit.ly/abc");
});

// Links copied from Google results or out of the Facebook/Instagram apps are redirect wrappers around the
// real address; fetching the wrapper gets a redirect page, not the recipe.
Deno.test("resolveUrl unwraps Google, Facebook and Instagram redirect links without fetching them", async () => {
  let fetched = 0;
  const f = (async () => { fetched++; return new Response(null); }) as typeof fetch;
  const google = "https://www.google.com/url?sa=t&source=web&rct=j&opi=89978449&url=https://www.instagram.com/reel/DVT4F_wDcu4/%3Fhl%3Dhe&ved=2ahUKEw&usg=AOvVaw2c";
  assertEquals(await resolveUrl(google, f), "https://www.instagram.com/reel/DVT4F_wDcu4/?hl=he");
  assertEquals(await resolveUrl("https://www.google.co.il/url?q=https://a.test/r&sa=U", f), "https://a.test/r");
  assertEquals(await resolveUrl("https://l.facebook.com/l.php?u=https%3A%2F%2Fb.test%2Fx&h=AT0", f), "https://b.test/x");
  assertEquals(await resolveUrl("https://l.instagram.com/?u=https%3A%2F%2Fc.test%2Fy&e=AT1", f), "https://c.test/y");
  assertEquals(fetched, 0);
});

Deno.test("resolveUrl leaves a Google link alone when it carries no http(s) target", async () => {
  const f = (async () => new Response(null)) as typeof fetch;
  assertEquals(await resolveUrl("https://www.google.com/url?url=javascript:alert(1)", f), "https://www.google.com/url?url=javascript:alert(1)");
  assertEquals(await resolveUrl("https://www.google.com/search?q=pasta", f), "https://www.google.com/search?q=pasta");
});

Deno.test("a wrapped short link is unwrapped and then expanded", async () => {
  const f = (async () => ({ url: "https://www.tiktok.com/@chef/video/1", body: null }) as unknown as Response) as typeof fetch;
  assertEquals(await resolveUrl("https://www.google.com/url?q=https://vm.tiktok.com/ZS1/", f), "https://www.tiktok.com/@chef/video/1");
});
