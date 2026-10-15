import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import type { Recipe } from "../lib/types";
import { renderWithProviders } from "../test/render";
import FeedPage from "./FeedPage";

const listRecipes = vi.fn();
const setFavorite = vi.fn();
vi.mock("../lib/recipes", async (orig) => ({
  ...(await orig<typeof import("../lib/recipes")>()),
  listRecipes: (...a: unknown[]) => listRecipes(...a),
  listFavoriteIds: async () => new Set(["r2"]),
  setFavorite: (...a: unknown[]) => setFavorite(...a),
}));

const recipe = (id: string, title: string, over: Partial<Recipe> = {}): Recipe => ({
  id, title, status: "published", source_url: "https://a.test", source_platform: "web", description: null,
  ingredients: [], steps: [], prep_minutes: 10, cook_minutes: 20, servings: 4, category: "מרקים", tags: [],
  image_path: null, error: null, created_at: "", published_at: "", ...over,
});

beforeEach(() => {
  listRecipes.mockReset();
  setFavorite.mockReset().mockResolvedValue(undefined);
});

test("shows recipe cards with total time; no image renders a placeholder", async () => {
  listRecipes.mockResolvedValue([recipe("r1", "מרק עדשים"), recipe("r2", "עוגת שמרים", { prep_minutes: null, cook_minutes: null })]);
  renderWithProviders(<FeedPage />);
  expect(await screen.findByRole("link", { name: /מרק עדשים/ })).toHaveAttribute("href", "/recipe/r1");
  expect(screen.getByText("30 דק׳")).toBeInTheDocument();
  expect(screen.queryByText(/NaN|null/)).not.toBeInTheDocument();
});

test("category chip filters and search is passed through", async () => {
  listRecipes.mockResolvedValue([]);
  renderWithProviders(<FeedPage />);
  await userEvent.click(await screen.findByRole("button", { name: "מרקים" }));
  await waitFor(() => expect(listRecipes).toHaveBeenLastCalledWith(expect.objectContaining({ category: "מרקים", page: 0 })));
  await userEvent.type(screen.getByRole("searchbox"), "עדשים");
  await waitFor(() => expect(listRecipes).toHaveBeenLastCalledWith(expect.objectContaining({ q: "עדשים" })), { timeout: 2000 });
});

test("empty state", async () => {
  listRecipes.mockResolvedValue([]);
  renderWithProviders(<FeedPage />);
  expect(await screen.findByText("עוד אין כאן מתכונים")).toBeInTheDocument();
});

test("favourite toggle calls setFavorite with the member id", async () => {
  listRecipes.mockResolvedValue([recipe("r1", "מרק עדשים")]);
  renderWithProviders(<FeedPage />);
  await userEvent.click(await screen.findByRole("button", { name: "הוספה למועדפים" }));
  expect(setFavorite).toHaveBeenCalledWith("m1", "r1", true);
});

test("search passes the exact typed string through after the debounce", async () => {
  listRecipes.mockResolvedValue([]);
  renderWithProviders(<FeedPage />);
  await userEvent.type(await screen.findByRole("searchbox"), '50% "חלבי"_');
  await waitFor(() => expect(listRecipes).toHaveBeenLastCalledWith(expect.objectContaining({ q: '50% "חלבי"_' })), { timeout: 2000 });
});

test("un-favouriting on the favourites page calls setFavorite(false) and refetches", async () => {
  listRecipes.mockResolvedValue([recipe("r2", "עוגת שמרים")]);
  renderWithProviders(<FeedPage favoritesOnly />);
  const btn = await screen.findByRole("button", { name: "הסרה מהמועדפים" });
  const callsBefore = listRecipes.mock.calls.length;
  await userEvent.click(btn);
  expect(setFavorite).toHaveBeenCalledWith("m1", "r2", false);
  await waitFor(() => expect(listRecipes.mock.calls.length).toBeGreaterThan(callsBefore));
});

test("favourites page asks for favourites only", async () => {
  listRecipes.mockResolvedValue([]);
  renderWithProviders(<FeedPage favoritesOnly />);
  await waitFor(() => expect(listRecipes).toHaveBeenCalledWith(expect.objectContaining({ favoritesOnly: true })));
  expect(await screen.findByText("עוד לא סימנת מתכונים כמועדפים")).toBeInTheDocument();
});
