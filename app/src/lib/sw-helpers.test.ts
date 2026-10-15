import { expect, test } from "vitest";
import { isRecipesApiRequest, notificationTarget } from "./sw-helpers";

const api = "http://127.0.0.1:54321/rest/v1";
const u = (s: string) => new URL(api + s);

test("caches single-recipe reads, shares and the feed RPC (GET only)", () => {
  expect(isRecipesApiRequest(u("/recipes?select=*&id=eq.abc"), "GET")).toBe(true);
  expect(isRecipesApiRequest(u("/shares?select=id&recipe_id=eq.abc&order=shared_at"), "GET")).toBe(true);
  expect(isRecipesApiRequest(u("/rpc/search_recipes?favorites_only=false&page_size=24&page_offset=0"), "GET")).toBe(true);
});

test("admin list, other reads and writes bypass the SW", () => {
  expect(isRecipesApiRequest(u("/recipes?select=*&status=in.(needs_review,failed)&order=created_at.desc"), "GET")).toBe(false);
  expect(isRecipesApiRequest(u("/recipes?id=eq.abc"), "PATCH")).toBe(false);
  expect(isRecipesApiRequest(u("/rpc/search_recipes"), "POST")).toBe(false);
  expect(isRecipesApiRequest(u("/favorites?select=recipe_id"), "GET")).toBe(false);
  expect(isRecipesApiRequest(u("/members?select=id&id=eq.abc"), "GET")).toBe(false);
});

test("notificationTarget keeps same-origin paths and rejects other origins", () => {
  const o = "https://app.example";
  expect(notificationTarget("/recipe/r1", o)).toBe("https://app.example/recipe/r1");
  expect(notificationTarget(undefined, o)).toBe("https://app.example/");
  expect(notificationTarget("https://evil.example/x", o)).toBe("/");
  expect(notificationTarget("javascript:alert(1)", o)).toBe("/");
});
