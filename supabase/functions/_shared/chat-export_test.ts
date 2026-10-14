import { assertEquals } from "jsr:@std/assert@1";
import { jerusalemToIso, parseChatExport } from "./chat-export.ts";

Deno.test("Android Hebrew export (dd.mm.yyyy) with multi-line message and system line", () => {
  const txt = [
    "14.10.2026, 21:30 - ההודעות והשיחות מוצפנות מקצה לקצה. אף אחד מחוץ לצ'אט הזה לא יכול לקרוא אותן.",
    "14.10.2026, 21:31 - רחל כהן: תראו איזה מתכון",
    "https://www.example.co.il/r/1",
    "שווה!",
    "14.10.2026, 21:35 - ‏דני‏: <המדיה הושמטה>",
  ].join("\n");
  const msgs = parseChatExport(txt);
  assertEquals(msgs.length, 2);
  assertEquals(msgs[0].sender, "רחל כהן");
  assertEquals(msgs[0].text, "תראו איזה מתכון\nhttps://www.example.co.il/r/1\nשווה!");
  assertEquals(msgs[0].sentAt, "2026-10-14T18:31:00.000Z"); // IDT = UTC+3 in October before DST ends
  assertEquals(msgs[1].sender, "דני");
});

Deno.test("iOS export with brackets, seconds and bidi marks", () => {
  const txt = "‎[03/01/2026, 08:05:09] Mom: https://youtu.be/abc\r\n[03/01/2026, 08:06:00] ‎You: 👍";
  const msgs = parseChatExport(txt);
  assertEquals(msgs.map((m) => m.sender), ["Mom", "You"]);
  assertEquals(msgs[0].text, "https://youtu.be/abc");
  assertEquals(msgs[0].sentAt, "2026-01-03T06:05:09.000Z"); // IST = UTC+2 in winter
});

Deno.test("US format with 2-digit year and AM/PM", () => {
  const msgs = parseChatExport("10/14/26, 9:30 PM - Dana: https://a.test/x");
  assertEquals(msgs[0].sentAt, "2026-10-14T18:30:00.000Z");
});

Deno.test("12 AM is midnight", () => {
  assertEquals(parseChatExport("10/14/26, 12:15 AM - Dana: hi")[0].sentAt, "2026-10-13T21:15:00.000Z");
});

Deno.test("jerusalemToIso handles DST boundaries", () => {
  assertEquals(jerusalemToIso(2026, 7, 1, 12, 0, 0), "2026-07-01T09:00:00.000Z");
  assertEquals(jerusalemToIso(2026, 12, 1, 12, 0, 0), "2026-12-01T10:00:00.000Z");
});

Deno.test("empty / garbage input → []", () => {
  assertEquals(parseChatExport(""), []);
  assertEquals(parseChatExport("just some text\nwithout dates"), []);
});
