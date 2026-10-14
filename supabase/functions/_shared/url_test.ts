import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { detectPlatform, extractUrls, normalizeUrl, resolveUrl } from "./url.ts";

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
