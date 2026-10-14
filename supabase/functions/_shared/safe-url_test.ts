import { assertEquals } from "jsr:@std/assert@1";
import { isPublicHttpUrl } from "./safe-url.ts";

Deno.test("isPublicHttpUrl accepts ordinary public http(s) URLs", () => {
  for (const u of [
    "https://www.mako.co.il/food/recipe",
    "http://example.com/a",
    "https://example.com:443/a",
    "http://example.com:80/a",
    "https://a.test/r",
    "https://8.8.8.8/x",
    "https://172.32.0.1/",
    "https://100.128.0.1/",
    "https://[2001:db8::1]/",
  ]) assertEquals(isPublicHttpUrl(u), true, u);
});

Deno.test("isPublicHttpUrl rejects schemes, ports and internal names", () => {
  for (const u of [
    "ftp://example.com/x",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "https://example.com:8443/x",
    "http://example.com:5432/",
    "http://localhost/x",
    "http://LOCALHOST./x",
    "http://kong/rest/v1",
    "http://db/",
    "http://host.docker.internal/",
    "http://metadata.google.internal/",
    "http://printer.local/",
    "not a url",
  ]) assertEquals(isPublicHttpUrl(u), false, u);
});

Deno.test("isPublicHttpUrl rejects private and reserved IPv4 literals, in any notation", () => {
  for (const u of [
    "http://127.0.0.1/", "http://127.255.1.1/", "http://10.1.2.3/", "http://172.16.0.1/", "http://172.31.255.255/",
    "http://192.168.1.1/", "http://169.254.169.254/latest/meta-data", "http://0.0.0.0/", "http://100.64.0.1/",
    "http://100.127.255.255/", "http://2130706433/", "http://0x7f.0.0.1/", "http://127.1/",
  ]) assertEquals(isPublicHttpUrl(u), false, u);
});

Deno.test("isPublicHttpUrl rejects loopback, unique-local, link-local and mapped IPv6", () => {
  for (const u of [
    "http://[::1]/", "http://[::]/", "http://[fc00::1]/", "http://[fd12:3456::1]/", "http://[fe80::1]/",
    "http://[febf::1]/", "http://[::ffff:127.0.0.1]/", "http://[::ffff:10.0.0.1]/",
  ]) assertEquals(isPublicHttpUrl(u), false, u);
});

Deno.test("allowLocal lets the local fixture hosts through on any port, nothing else", () => {
  assertEquals(isPublicHttpUrl("http://host.docker.internal:5199/r", { allowLocal: true }), true);
  assertEquals(isPublicHttpUrl("http://127.0.0.1:5199/r", { allowLocal: true }), true);
  assertEquals(isPublicHttpUrl("http://host.docker.internal:5199/r"), false);
  assertEquals(isPublicHttpUrl("http://10.0.0.5/", { allowLocal: true }), false);
});
