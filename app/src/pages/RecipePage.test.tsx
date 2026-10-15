import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { Recipe } from "../lib/types";
import { renderWithProviders } from "../test/render";
import RecipePage from "./RecipePage";

let current: Recipe;
vi.mock("../lib/recipes", async (orig) => ({
  ...(await orig<typeof import("../lib/recipes")>()),
  getRecipe: async () => current,
  getShares: async () => [{ id: "s1", recipe_id: "r1", shared_by_name: "רחל", shared_at: "2026-10-12T09:00:00Z", via: "whatsapp" }],
  listFavoriteIds: async () => new Set(),
  setFavorite: async () => {},
}));

const full: Recipe = {
  id: "r1", status: "published", source_url: "https://www.mako.co.il/x", source_platform: "web",
  title: "פשטידת תרד", description: "רכה ועשירה.", prep_minutes: 15, cook_minutes: 40, servings: 6,
  category: "מנות עיקריות", tags: ["חלבי"], image_path: "r1/a.webp", error: null, created_at: "", published_at: "",
  ingredients: [
    { group: "לבסיס", name: "תרד", amount: "500", unit: "גרם", note: null },
    { group: "לציפוי", name: "גבינה צהובה", amount: "1", unit: "כוס", note: "מגוררת" },
  ],
  steps: [{ text: "מחממים תנור ל-180 מעלות." }, { text: "מערבבים ואופים 40 דקות." }],
};

test("renders grouped ingredients, numbered steps, times and attribution", async () => {
  current = full;
  renderWithProviders(<RecipePage />, { route: "/recipe/r1", path: "/recipe/:id" });
  expect(await screen.findByRole("heading", { level: 1, name: "פשטידת תרד" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "לבסיס" })).toBeInTheDocument();
  expect(screen.getByLabelText("1 כוס גבינה צהובה (מגוררת)")).toBeInTheDocument();
  expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toContain("מחממים תנור ל-180 מעלות.");
  expect(screen.getByText("55 דק׳")).toBeInTheDocument();
  expect(screen.getByText("6 מנות")).toBeInTheDocument();
  expect(screen.getByText("מקור: mako.co.il · שותף ע״י רחל ב-12.10.2026")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "התחילו לבשל" })).toHaveAttribute("href", "/recipe/r1/cook");
});

test("ingredient checkbox ticks off", async () => {
  current = full;
  renderWithProviders(<RecipePage />, { route: "/recipe/r1", path: "/recipe/:id" });
  const box = await screen.findByLabelText("500 גרם תרד");
  await userEvent.click(box);
  expect(box).toBeChecked();
});

test("minimal recipe renders without empty sections or null text", async () => {
  current = {
    ...full, description: null, prep_minutes: null, cook_minutes: null, servings: null, image_path: null, tags: [],
    ingredients: [{ group: null, name: "מלח", amount: null, unit: null, note: null }], steps: [{ text: "מפזרים." }],
  };
  renderWithProviders(<RecipePage />, { route: "/recipe/r1", path: "/recipe/:id" });
  expect(await screen.findByLabelText("מלח")).toBeInTheDocument();
  expect(screen.queryByText(/null|NaN|undefined/)).not.toBeInTheDocument();
  expect(screen.queryByText(/\d+ מנות/)).not.toBeInTheDocument();
});
