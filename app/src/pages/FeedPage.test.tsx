import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import type { Recipe } from "../lib/types";
import { renderWithProviders } from "../test/render";
import FeedPage from "./FeedPage";
import { stubDesktop } from "../test/media";

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
  expect(screen.getByText("מרקים · 30 דק׳")).toBeInTheDocument(); // caption = category · total time
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
  await waitFor(() => expect(setFavorite).toHaveBeenCalledWith("m1", "r1", true));
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
  await waitFor(() => expect(setFavorite).toHaveBeenCalledWith("m1", "r2", false));
  await waitFor(() => expect(listRecipes.mock.calls.length).toBeGreaterThan(callsBefore));
});

test("empty state is hidden while a new search is pending after an empty result", async () => {
  listRecipes.mockResolvedValueOnce([]);
  renderWithProviders(<FeedPage />);
  expect(await screen.findByText("עוד אין כאן מתכונים")).toBeInTheDocument();
  let resolve!: (v: Recipe[]) => void;
  listRecipes.mockReturnValue(new Promise<Recipe[]>((r) => { resolve = r; }));
  await userEvent.type(screen.getByRole("searchbox"), "מרק");
  await waitFor(() => expect(listRecipes).toHaveBeenLastCalledWith(expect.objectContaining({ q: "מרק" })), { timeout: 2000 });
  expect(screen.queryByText("עוד אין כאן מתכונים")).not.toBeInTheDocument();
  resolve([]);
  expect(await screen.findByText("עוד אין כאן מתכונים")).toBeInTheDocument();
});

test("favourites page asks for favourites only", async () => {
  listRecipes.mockResolvedValue([]);
  renderWithProviders(<FeedPage favoritesOnly />);
  await waitFor(() => expect(listRecipes).toHaveBeenCalledWith(expect.objectContaining({ favoritesOnly: true })));
  expect(await screen.findByText("עוד לא סימנת מתכונים כמועדפים")).toBeInTheDocument();
});

// The page h1 is rendered by Layout's large-title header (see Layout.test.tsx); the feed must not add another.
test("feed renders no h1 of its own", async () => {
  listRecipes.mockResolvedValue([]);
  renderWithProviders(<FeedPage />);
  expect(await screen.findByText("עוד אין כאן מתכונים")).toBeInTheDocument();
  expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
});

test("load error shows a retry button that refetches", async () => {
  listRecipes.mockRejectedValueOnce(new Error("500"));
  renderWithProviders(<FeedPage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("לא הצלחנו לטעון מתכונים.");
  listRecipes.mockResolvedValue([recipe("r1", "מרק עדשים")]);
  await userEvent.click(screen.getByRole("button", { name: "נסו שוב" }));
  expect(await screen.findByRole("link", { name: /מרק עדשים/ })).toBeInTheDocument();
});

test("load error while offline says there is no connection", async () => {
  const spy = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  try {
    listRecipes.mockRejectedValue(new TypeError("Failed to fetch"));
    renderWithProviders(<FeedPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("אין חיבור לאינטרנט");
  } finally {
    spy.mockRestore();
  }
});

test("on desktop the category chips give way to the sidebar's category list", async () => {
  stubDesktop(true);
  try {
    listRecipes.mockResolvedValue([]);
    renderWithProviders(<FeedPage />);
    expect(await screen.findByText("עוד אין כאן מתכונים")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "מרקים" })).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  } finally {
    vi.unstubAllGlobals();
  }
});
