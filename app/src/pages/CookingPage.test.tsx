import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { Recipe } from "../lib/types";
import { renderWithProviders } from "../test/render";
import CookingPage from "./CookingPage";

let current: Recipe;
let failWith: unknown = null;
let getRecipeCalls = 0;
vi.mock("../lib/recipes", async (orig) => ({
  ...(await orig<typeof import("../lib/recipes")>()),
  getRecipe: async () => {
    getRecipeCalls++;
    if (failWith) throw failWith;
    return current;
  },
}));

const base: Recipe = {
  id: "r1", status: "published", source_url: "https://www.mako.co.il/x", source_platform: "web",
  title: "פשטידת תרד", description: null, prep_minutes: null, cook_minutes: null, servings: null,
  category: null, tags: [], image_path: null, error: null, created_at: "", published_at: "",
  ingredients: [], steps: [{ text: "מחממים תנור." }],
};

const render = () => renderWithProviders(<CookingPage />, { route: "/recipe/r1/cook", path: "/recipe/:id/cook" });

test("not-found error shows the not-found message", async () => {
  failWith = { code: "PGRST116" };
  render();
  expect(await screen.findByText("המתכון לא נמצא.")).toBeInTheDocument();
});

test("other errors show a retry alert that refetches", async () => {
  failWith = new Error("network");
  getRecipeCalls = 0;
  render();
  expect(await screen.findByText("לא הצלחנו לטעון את המתכון")).toBeInTheDocument();
  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(screen.queryByText("המתכון לא נמצא.")).not.toBeInTheDocument();
  const before = getRecipeCalls;
  await userEvent.click(screen.getByRole("button", { name: "נסו שוב" }));
  await vi.waitFor(() => expect(getRecipeCalls).toBeGreaterThan(before));
});

test("a recipe with no steps says so", async () => {
  failWith = null;
  current = { ...base, steps: [] };
  render();
  expect(await screen.findByText("אין שלבים למתכון הזה.")).toBeInTheDocument();
});

test("a recipe with steps opens cooking mode", async () => {
  failWith = null;
  current = base;
  render();
  expect(await screen.findByText("שלב 1 מתוך 1")).toBeInTheDocument();
});
