import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { Route, Routes } from "react-router";
import { Layout } from "../components/Layout";
import { RecipeCard } from "../components/RecipeCard";
import type { Recipe } from "../lib/types";
import { stubDesktop } from "../test/media";
import { renderWithProviders, TEST_MEMBER } from "../test/render";
import FeedPage from "./FeedPage";
import RecipePage from "./RecipePage";

const listRecipes = vi.fn();
const setRating = vi.fn();
let myRatings = new Map<string, number>();
vi.mock("../lib/recipes", async (orig) => ({
  ...(await orig<typeof import("../lib/recipes")>()),
  listRecipes: (...a: unknown[]) => listRecipes(...a),
  getRecipe: async () => recipe("r1", "מרק עדשים"),
  getShares: async () => [],
  listFavoriteIds: async () => new Set(),
  setFavorite: async () => {},
  listMyRatings: async () => myRatings,
  setRating: (...a: unknown[]) => setRating(...a),
}));

function recipe(id: string, title: string): Recipe {
  return {
    id, title, status: "published", source_url: "https://a.test", source_platform: "web", description: null,
    ingredients: [], steps: [{ text: "מבשלים." }], prep_minutes: 10, cook_minutes: 20, servings: 4, category: "מרקים",
    tags: [], image_path: null, error: null, created_at: "", published_at: "",
  };
}

beforeEach(() => {
  myRatings = new Map();
  listRecipes.mockReset().mockResolvedValue([]);
  // like the real server: a saved rating is returned by the next listMyRatings
  setRating.mockReset().mockImplementation(async (_m: string, recipeId: string, stars: number | null) => {
    myRatings = new Map(myRatings);
    stars === null ? myRatings.delete(recipeId) : myRatings.set(recipeId, stars);
  });
});

test("recipe page: tapping a star rates the recipe for me; tapping it again clears my rating", async () => {
  renderWithProviders(<RecipePage />, { route: "/recipe/r1", path: "/recipe/:id" });
  const group = await screen.findByRole("group", { name: "הדירוג שלך" });
  await userEvent.click(within(group).getByRole("button", { name: "4 כוכבים" }));
  expect(setRating).toHaveBeenCalledWith(TEST_MEMBER.id, "r1", 4);
  // optimistic update lands a tick after the tap
  await waitFor(() => expect(within(group).getByRole("button", { name: "4 כוכבים" })).toHaveAttribute("aria-pressed", "true"));
  await userEvent.click(within(group).getByRole("button", { name: "4 כוכבים" }));
  expect(setRating).toHaveBeenLastCalledWith(TEST_MEMBER.id, "r1", null);
});

test("recipe page shows my existing rating", async () => {
  myRatings = new Map([["r1", 3]]);
  renderWithProviders(<RecipePage />, { route: "/recipe/r1", path: "/recipe/:id" });
  const group = await screen.findByRole("group", { name: "הדירוג שלך" });
  await waitFor(() => expect(within(group).getByRole("button", { name: "3 כוכבים" })).toHaveAttribute("aria-pressed", "true"));
});

test("card shows my rating when I rated the recipe", () => {
  renderWithProviders(<RecipeCard recipe={recipe("r1", "מרק")} isFavorite={false} onToggleFavorite={() => {}} myRating={4} />);
  expect(screen.getByLabelText("הדירוג שלך: 4 כוכבים")).toBeInTheDocument();
});

test("feed: the star filter asks for my recipes rated at least that many stars", async () => {
  renderWithProviders(<FeedPage />);
  await userEvent.click(await screen.findByRole("button", { name: "★4 ומעלה" }));
  await waitFor(() => expect(listRecipes).toHaveBeenLastCalledWith(expect.objectContaining({ minRating: 4 })));
  expect(screen.getByRole("button", { name: "★4 ומעלה" })).toHaveAttribute("aria-pressed", "true");
  await userEvent.click(screen.getByRole("button", { name: "כל הדירוגים" }));
  await waitFor(() => expect(listRecipes).toHaveBeenLastCalledWith(expect.objectContaining({ minRating: null })));
});

test("desktop sidebar has my-rating filters", () => {
  stubDesktop(true);
  try {
    renderWithProviders(
      <Routes><Route element={<Layout />}><Route path="/" element={<div>FEED</div>} /></Route></Routes>,
      { member: TEST_MEMBER },
    );
    const nav = screen.getByRole("navigation", { name: "ניווט ראשי" });
    expect(within(nav).getByRole("link", { name: "★5" })).toHaveAttribute("href", "/?stars=5");
  } finally {
    vi.unstubAllGlobals();
  }
});
