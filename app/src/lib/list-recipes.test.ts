import { beforeEach, expect, test, vi } from "vitest";
import { listRecipes } from "./recipes";

const rpc = vi.fn();
vi.mock("./supabase", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: [], error: null });
});

test("listRecipes calls search_recipes as a GET and omits empty args", async () => {
  await listRecipes({ q: "  ", category: null, favoritesOnly: false, page: 1 });
  expect(rpc).toHaveBeenCalledWith(
    "search_recipes",
    { favorites_only: false, page_size: 24, page_offset: 24 },
    { get: true },
  );
});

test("listRecipes passes trimmed q and category when set", async () => {
  await listRecipes({ q: " מרק ", category: "מרקים", favoritesOnly: true, page: 0 });
  expect(rpc).toHaveBeenCalledWith(
    "search_recipes",
    { q: "מרק", cat: "מרקים", favorites_only: true, page_size: 24, page_offset: 0 },
    { get: true },
  );
});
