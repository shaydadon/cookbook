import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { CATEGORIES } from "./categories";

test("categories match the backend schema exactly", () => {
  const backend = readFileSync(resolve(__dirname, "../../../supabase/functions/_shared/recipe-schema.ts"), "utf8");
  const block = backend.slice(backend.indexOf("export const CATEGORIES"), backend.indexOf("] as const"));
  const backendList = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  expect([...CATEGORIES]).toEqual(backendList);
});
