import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import type { Recipe } from "../lib/types";
import { renderWithProviders, TEST_ADMIN, TEST_MEMBER } from "../test/render";
import FeedPage from "./FeedPage";

const listRecipes = vi.fn();
const adminAction = vi.fn();
vi.mock("../lib/recipes", async (orig) => ({
  ...(await orig<typeof import("../lib/recipes")>()),
  listRecipes: (...a: unknown[]) => listRecipes(...a),
  listFavoriteIds: async () => new Set(),
  setFavorite: async () => {},
  adminAction: (...a: unknown[]) => adminAction(...a),
}));

const recipe = (id: string, title: string): Recipe => ({
  id, title, status: "published", source_url: "https://a.test", source_platform: "web", description: null,
  ingredients: [], steps: [], prep_minutes: 10, cook_minutes: 20, servings: 4, category: "מרקים", tags: [],
  image_path: null, error: null, created_at: "", published_at: "",
});

beforeEach(() => {
  listRecipes.mockReset().mockResolvedValue([recipe("r1", "מרק עדשים"), recipe("r2", "עוגת שמרים")]);
  adminAction.mockReset().mockResolvedValue({ deleted: true });
});

/** Press and hold a card (real timers: the hook waits ~500 ms). */
async function longPress(title: string) {
  const card = (await screen.findByRole("link", { name: new RegExp(title) })).closest("[data-recipe-card]")!;
  fireEvent.pointerDown(card, { pointerId: 1, clientX: 10, clientY: 10 });
  await act(() => new Promise((r) => setTimeout(r, 650)));
  fireEvent.pointerUp(card, { pointerId: 1 });
  return card as HTMLElement;
}

test("admin: a long press enters edit mode — every card jiggles and shows a delete ✕, plus a Done button", async () => {
  renderWithProviders(<FeedPage />, { member: TEST_ADMIN });
  await longPress("מרק עדשים");
  expect(screen.getByRole("button", { name: "סיום" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "מחיקת מרק עדשים" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "מחיקת עוגת שמרים" })).toBeInTheDocument();
  for (const card of document.querySelectorAll("[data-recipe-card]")) expect(card.className).toMatch(/jiggle/);
  // in edit mode a card doesn't open the recipe
  expect(screen.getByRole("link", { name: /מרק עדשים/ })).toHaveAttribute("aria-disabled", "true");
});

test("admin: a short tap is not a long press", async () => {
  renderWithProviders(<FeedPage />, { member: TEST_ADMIN });
  const card = (await screen.findByRole("link", { name: /מרק עדשים/ })).closest("[data-recipe-card]")!;
  fireEvent.pointerDown(card, { pointerId: 1, clientX: 10, clientY: 10 });
  await act(() => new Promise((r) => setTimeout(r, 150)));
  fireEvent.pointerUp(card, { pointerId: 1 });
  await act(() => new Promise((r) => setTimeout(r, 500)));
  expect(screen.queryByRole("button", { name: "סיום" })).not.toBeInTheDocument();
});

test("admin: tapping ✕ asks to confirm; confirming deletes the recipe for everyone and removes the card", async () => {
  renderWithProviders(<FeedPage />, { member: TEST_ADMIN });
  await longPress("מרק עדשים");
  listRecipes.mockResolvedValue([recipe("r2", "עוגת שמרים")]); // what the server returns after the delete
  await userEvent.click(screen.getByRole("button", { name: "מחיקת מרק עדשים" }));
  const dialog = screen.getByRole("dialog", { name: "מחיקת מתכון" });
  expect(dialog).toHaveTextContent("מרק עדשים");
  expect(adminAction).not.toHaveBeenCalled();
  await userEvent.click(within(dialog).getByRole("button", { name: "מחיקה" }));
  expect(adminAction).toHaveBeenCalledWith({ action: "delete", recipe_id: "r1" });
  await waitFor(() => expect(screen.queryByRole("link", { name: /מרק עדשים/ })).not.toBeInTheDocument());
  // still in edit mode, to delete more
  expect(screen.getByRole("button", { name: "סיום" })).toBeInTheDocument();
});

test("admin: cancelling the confirmation keeps the recipe", async () => {
  renderWithProviders(<FeedPage />, { member: TEST_ADMIN });
  await longPress("מרק עדשים");
  await userEvent.click(screen.getByRole("button", { name: "מחיקת מרק עדשים" }));
  await userEvent.click(within(screen.getByRole("dialog", { name: "מחיקת מתכון" })).getByRole("button", { name: "ביטול" }));
  expect(adminAction).not.toHaveBeenCalled();
  expect(screen.getByRole("link", { name: /מרק עדשים/ })).toBeInTheDocument();
});

test("admin: a failed delete shows the error and keeps the card", async () => {
  adminAction.mockRejectedValue(new Error("המחיקה נכשלה"));
  renderWithProviders(<FeedPage />, { member: TEST_ADMIN });
  await longPress("מרק עדשים");
  await userEvent.click(screen.getByRole("button", { name: "מחיקת מרק עדשים" }));
  await userEvent.click(within(screen.getByRole("dialog", { name: "מחיקת מתכון" })).getByRole("button", { name: "מחיקה" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("המחיקה נכשלה");
  expect(screen.getByRole("link", { name: /מרק עדשים/ })).toBeInTheDocument();
});

test("admin: Done and Esc leave edit mode", async () => {
  renderWithProviders(<FeedPage />, { member: TEST_ADMIN });
  await longPress("מרק עדשים");
  await userEvent.click(screen.getByRole("button", { name: "סיום" }));
  expect(screen.queryByRole("button", { name: /^מחיקת / })).not.toBeInTheDocument();
  await longPress("עוגת שמרים");
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("button", { name: "סיום" })).not.toBeInTheDocument();
});

test("member: a long press does nothing — only admins can delete", async () => {
  renderWithProviders(<FeedPage />, { member: TEST_MEMBER });
  await longPress("מרק עדשים");
  expect(screen.queryByRole("button", { name: "סיום" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^מחיקת / })).not.toBeInTheDocument();
});

test("admin: tapping a card (not its ✕) leaves edit mode instead of opening the recipe", async () => {
  renderWithProviders(<FeedPage />, { member: TEST_ADMIN });
  await longPress("מרק עדשים");
  await userEvent.click(screen.getByRole("link", { name: /עוגת שמרים/ }));
  expect(screen.queryByRole("button", { name: "סיום" })).not.toBeInTheDocument();
  expect(adminAction).not.toHaveBeenCalled();
});

test("admin: the phone's Back gesture leaves edit mode instead of leaving the page", async () => {
  renderWithProviders(<FeedPage />, { member: TEST_ADMIN });
  await longPress("מרק עדשים");
  expect(screen.getByRole("button", { name: "סיום" })).toBeInTheDocument();
  await act(async () => { window.dispatchEvent(new PopStateEvent("popstate", { state: null })); });
  expect(screen.queryByRole("button", { name: "סיום" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /מרק עדשים/ })).toBeInTheDocument(); // still on the feed
});

test("admin: the Done button stands out as a filled button", async () => {
  renderWithProviders(<FeedPage />, { member: TEST_ADMIN });
  await longPress("מרק עדשים");
  expect(screen.getByRole("button", { name: "סיום" }).className).toMatch(/bg-accent/);
});
