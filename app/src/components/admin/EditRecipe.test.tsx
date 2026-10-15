import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { renderWithProviders, TEST_ADMIN } from "../../test/render";
import { EditRecipe } from "./EditRecipe";

const ID = "11111111-2222-3333-4444-555555555555";
const updateRecipe = vi.fn();
let status = "published";
vi.mock("../../lib/recipes", async (orig) => ({
  ...(await orig<typeof import("../../lib/recipes")>()),
  getRecipe: async () => ({
    id: ID, status, source_url: "https://x.y", source_platform: "web", title: "עוגה", description: null,
    ingredients: [{ group: null, name: "קמח", amount: null, unit: null, note: null }],
    steps: [{ text: "מערבבים" }], prep_minutes: null, cook_minutes: null, servings: null,
    category: null, tags: [], image_path: null, error: null, created_at: "2026-10-14T08:00:00Z", published_at: null,
  }),
  updateRecipe: (...a: unknown[]) => updateRecipe(...a),
  adminAction: vi.fn(),
}));

beforeEach(() => {
  updateRecipe.mockReset();
  updateRecipe.mockResolvedValue(undefined);
  status = "published";
});

async function load() {
  renderWithProviders(<EditRecipe />, { member: TEST_ADMIN });
  await userEvent.type(screen.getByLabelText(/מזהה מתכון/), `https://app.example/recipe/${ID}`);
  await screen.findByLabelText("כותרת");
}

test("blank title blocks save", async () => {
  await load();
  await userEvent.clear(screen.getByLabelText("כותרת"));
  await userEvent.click(screen.getByRole("button", { name: "שמירה" }));
  expect(updateRecipe).not.toHaveBeenCalled();
});

test("blank title with required bypassed still shows an alert and does not save", async () => {
  await load();
  await userEvent.clear(screen.getByLabelText("כותרת"));
  await userEvent.clear(screen.getByLabelText(/מרכיבים/));
  await userEvent.click(screen.getByRole("button", { name: "שמירה" }));
  expect(updateRecipe).not.toHaveBeenCalled();
});

test("recipe being processed cannot be saved", async () => {
  status = "rewriting";
  await load();
  expect(screen.getByRole("button", { name: "שמירה" })).toBeDisabled();
  expect(screen.getByText("המתכון בעיבוד — אפשר לערוך אחרי שיסתיים")).toBeInTheDocument();
});
