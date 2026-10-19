import { fireEvent, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { formatMinutes } from "../lib/recipes";
import type { Recipe } from "../lib/types";
import { renderWithProviders } from "../test/render";
import { RecipeCard } from "./RecipeCard";

const base = {
  id: "r1", status: "published", source_url: "https://a.test", source_platform: "web", title: "פנקייק דק (קרפ) קל",
  description: null, ingredients: [], steps: [], prep_minutes: 10, cook_minutes: 20, servings: 4,
  category: "ארוחת בוקר", tags: [], image_path: null, error: null, created_at: "", published_at: "",
} as unknown as Recipe;

test("caption shows category · time", () => {
  renderWithProviders(<RecipeCard recipe={base} isFavorite={false} onToggleFavorite={() => {}} />);
  expect(screen.getByText(`ארוחת בוקר · ${formatMinutes(30)}`)).toBeInTheDocument();
});

test("no image → placeholder panel; long title is clamped; no time → category only", () => {
  const long = "מתכון עם כותרת ארוכה מאוד מאוד מאוד שחייבת להיחתך אחרי שתי שורות כדי לא לשבור את הכרטיס";
  renderWithProviders(<RecipeCard recipe={{ ...base, title: long, prep_minutes: null, cook_minutes: null }}
    isFavorite onToggleFavorite={() => {}} />);
  expect(screen.getByTestId("card-placeholder")).toBeInTheDocument();
  expect(screen.getByText(long).className).toMatch(/line-clamp-2/);
  expect(screen.getByText("ארוחת בוקר")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "הסרה מהמועדפים" })).toBeInTheDocument();
});

// Android/iOS open a link-and-image menu on long-press; it must never cover an admin's card, edit mode included.
test("admin cards suppress the browser's long-press menu, in and out of edit mode", () => {
  const { unmount } = renderWithProviders(
    <RecipeCard recipe={base} isFavorite={false} onToggleFavorite={() => {}} onLongPress={() => {}} onDelete={() => {}} />);
  expect(fireEvent.contextMenu(screen.getByRole("link"))).toBe(false); // false = default prevented
  unmount();
  renderWithProviders(
    <RecipeCard recipe={base} isFavorite={false} onToggleFavorite={() => {}} onLongPress={() => {}} onDelete={() => {}} editing />);
  expect(fireEvent.contextMenu(screen.getByRole("link"))).toBe(false);
});

test("members keep the browser's normal long-press menu", () => {
  renderWithProviders(<RecipeCard recipe={base} isFavorite={false} onToggleFavorite={() => {}} />);
  expect(fireEvent.contextMenu(screen.getByRole("link"))).toBe(true);
});
