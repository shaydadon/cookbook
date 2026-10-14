import { assertEquals } from "jsr:@std/assert@1";
import { ANTHROPIC_CLIENT_OPTIONS, isLocal } from "./deps.ts";

Deno.test("Anthropic client has a 120 s timeout and a single retry", () => {
  assertEquals(ANTHROPIC_CLIENT_OPTIONS.timeout, 120_000);
  assertEquals(ANTHROPIC_CLIENT_OPTIONS.maxRetries, 1);
});

Deno.test("isLocal accepts local hosts only", () => {
  for (const u of ["http://127.0.0.1:54321", "http://localhost:54321", "http://kong:8000", "http://host.docker.internal:54321"]) {
    assertEquals(isLocal(u), true, u);
  }
  for (const u of ["https://abc.supabase.co", "https://localhost.evil.com", "not a url", "", undefined]) {
    assertEquals(isLocal(u), false, String(u));
  }
});
