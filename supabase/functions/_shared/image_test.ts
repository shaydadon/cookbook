import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { generateImage, IMAGE_STYLE, IMAGE_TIMEOUT_MS } from "./image.ts";

Deno.test("image request carries a 90 s abort signal", async () => {
  let signal: unknown;
  const f = (async (_url: string | URL | Request, init?: RequestInit) => {
    signal = init?.signal;
    return Response.json({ data: [{ b64_json: btoa("W") }] });
  }) as typeof fetch;
  await generateImage("x", { apiKey: "k", model: "m", fetchFn: f });
  assertEquals(signal instanceof AbortSignal, true);
  assertEquals(IMAGE_TIMEOUT_MS, 90_000);
});

Deno.test("posts prompt + house style, decodes b64 WebP", async () => {
  let body: Record<string, unknown> = {};
  let auth = "";
  const f = (async (_url: string | URL | Request, init?: RequestInit) => {
    body = JSON.parse(String(init?.body));
    auth = new Headers(init?.headers).get("Authorization") ?? "";
    return Response.json({ data: [{ b64_json: btoa("WEBPDATA") }] });
  }) as typeof fetch;
  const bytes = await generateImage("Lemon cake slice", { apiKey: "k", model: "gpt-image-1", fetchFn: f });
  assertEquals(new TextDecoder().decode(bytes), "WEBPDATA");
  assertEquals(body.prompt, `Lemon cake slice. ${IMAGE_STYLE}`);
  assertEquals(body.output_format, "webp");
  assertEquals(body.size, "1024x1024");
  assertEquals(auth, "Bearer k");
});

Deno.test("non-2xx throws with status", async () => {
  const f = (async () => new Response("rate limited", { status: 429 })) as typeof fetch;
  await assertRejects(() => generateImage("x", { apiKey: "k", model: "m", fetchFn: f }), Error, "429");
});
