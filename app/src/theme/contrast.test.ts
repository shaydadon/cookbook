import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

// Review fix: text tokens must meet WCAG AA (4.5:1) against the backgrounds they sit on.
const css = readFileSync(resolve(__dirname, "../index.css"), "utf8");
const block = (sel: string) => css.slice(css.indexOf(`${sel} {`), css.indexOf("}", css.indexOf(`${sel} {`)));
const token = (b: string, name: string) => b.match(new RegExp(`--${name}:[ \\t]*(#[0-9A-Fa-f]{6})`))![1];
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test("light theme: muted text and text on the accent pass AA", () => {
  const light = block(":root");
  expect(ratio(token(light, "text-2"), token(light, "bg"))).toBeGreaterThanOrEqual(4.5);
  expect(ratio(token(light, "text-2"), token(light, "surface"))).toBeGreaterThanOrEqual(4.5);
  expect(ratio(token(light, "on-accent"), token(light, "accent"))).toBeGreaterThanOrEqual(4.5);
});

test("dark theme: muted text and text on the accent pass AA", () => {
  const dark = block('[data-theme="dark"]');
  expect(ratio(token(dark, "text-2"), token(dark, "bg"))).toBeGreaterThanOrEqual(4.5);
  expect(ratio(token(dark, "on-accent"), token(dark, "accent"))).toBeGreaterThanOrEqual(4.5);
});
