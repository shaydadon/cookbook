import { expect, test } from "vitest";
import { extractFirstUrl, prefillFromShare } from "./share";

test("extractFirstUrl", () => {
  expect(extractFirstUrl("תראו https://www.instagram.com/reel/abc/?igsh=x יאמי")).toBe("https://www.instagram.com/reel/abc/?igsh=x");
  expect(extractFirstUrl("אין קישור")).toBeNull();
});

test("Android: link inside text with extra words", () => {
  const p = new URLSearchParams({ text: "Check out this recipe! https://vm.tiktok.com/ZS123/" });
  expect(prefillFromShare(p)).toEqual({ url: "https://vm.tiktok.com/ZS123/", note: "Check out this recipe!" });
});

test("iOS: url param, title becomes the note", () => {
  const p = new URLSearchParams({ url: "https://www.mako.co.il/food/1", title: "עוגת גבינה" });
  expect(prefillFromShare(p)).toEqual({ url: "https://www.mako.co.il/food/1", note: "עוגת גבינה" });
});

test("link only in title", () => {
  expect(prefillFromShare(new URLSearchParams({ title: "https://a.test/r" })).url).toBe("https://a.test/r");
});

test("trailing sentence punctuation is stripped from the link", () => {
  expect(extractFirstUrl("see https://a.test/r.")).toBe("https://a.test/r");
  expect(prefillFromShare(new URLSearchParams({ text: "see https://a.test/r." })).url).toBe("https://a.test/r");
});

test("link in both url and text is not duplicated; extra words stay in the note", () => {
  const p = new URLSearchParams({ url: "https://a.test/r", text: "yummy https://a.test/r" });
  expect(prefillFromShare(p)).toEqual({ url: "https://a.test/r", note: "yummy" });
});

test("nothing shared", () => {
  expect(prefillFromShare(new URLSearchParams())).toEqual({ url: "", note: "" });
});
