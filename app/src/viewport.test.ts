import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

// viewport-fit=cover lets Android Chrome draw the app behind the system navigation bar; Chrome doesn't always
// report safe-area-inset-bottom (e.g. with 3-button navigation), so the bottom tab bar ended up hidden behind it.
test("the app is laid out above the system bars, not under them", () => {
  const html = readFileSync(resolve(__dirname, "../index.html"), "utf8");
  const viewport = html.match(/<meta name="viewport" content="([^"]*)"/)?.[1] ?? "";
  expect(viewport).toContain("width=device-width");
  expect(viewport).not.toContain("viewport-fit=cover");
});
