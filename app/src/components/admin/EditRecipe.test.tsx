import { QueryClient } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { renderWithProviders, TEST_ADMIN } from "../../test/render";
import { EditRecipe } from "./EditRecipe";

const ID = "11111111-2222-3333-4444-555555555555";
const updateRecipe = vi.fn();
const adminAction = vi.fn();
let status = "published";
const FLOUR = { group: "לבצק", name: "קמח", amount: "2", unit: "כוסות", note: "מנופה" };
const SUGAR = { group: "לבצק", name: "סוכר", amount: "1", unit: "כוס", note: null };
const SALT = { group: null, name: "מלח", amount: "1", unit: "כפית", note: null };
vi.mock("../../lib/recipes", async (orig) => ({
  ...(await orig<typeof import("../../lib/recipes")>()),
  getRecipe: async () => ({
    id: ID, status, source_url: "https://x.y", source_platform: "web", title: "עוגה", description: null,
    ingredients: [FLOUR, SUGAR, SALT],
    steps: [{ text: "מערבבים" }], prep_minutes: null, cook_minutes: null, servings: null,
    category: null, tags: [], image_path: null, error: null, created_at: "2026-10-14T08:00:00Z", published_at: null,
  }),
  updateRecipe: (...a: unknown[]) => updateRecipe(...a),
  adminAction: (...a: unknown[]) => adminAction(...a),
}));

beforeEach(() => {
  updateRecipe.mockReset();
  updateRecipe.mockResolvedValue(undefined);
  adminAction.mockReset();
  adminAction.mockResolvedValue({ ok: true });
  status = "published";
});

afterEach(() => {
  vi.restoreAllMocks();
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

test("saving only a title change sends no ingredients or steps, and refreshes the feed", async () => {
  const invalidate = vi.spyOn(QueryClient.prototype, "invalidateQueries");
  await load();
  await userEvent.type(screen.getByLabelText("כותרת"), " שוקולד");
  await userEvent.click(screen.getByRole("button", { name: "שמירה" }));
  expect(await screen.findByRole("status")).toHaveTextContent("נשמר");
  expect(updateRecipe).toHaveBeenCalledTimes(1);
  const patch = updateRecipe.mock.calls[0][1] as Record<string, unknown>;
  expect(patch.title).toBe("עוגה שוקולד");
  expect(patch).not.toHaveProperty("ingredients");
  expect(patch).not.toHaveProperty("steps");
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["recipes"] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["recipe", ID] });
});

test("editing one ingredient line keeps the other ingredients' structure", async () => {
  await load();
  const box = screen.getByLabelText(/מרכיבים/) as HTMLTextAreaElement;
  expect(box.value).toBe("# לבצק\n2 כוסות קמח (מנופה)\n1 כוס סוכר\n#\n1 כפית מלח");
  await userEvent.clear(box);
  await userEvent.type(box, "# לבצק\n2 כוסות קמח (מנופה)\n1.5 כוס סוכר חום\n#\n1 כפית מלח");
  await userEvent.click(screen.getByRole("button", { name: "שמירה" }));
  expect(await screen.findByRole("status")).toHaveTextContent("נשמר");
  const patch = updateRecipe.mock.calls[0][1] as Record<string, unknown>;
  expect(patch.ingredients).toEqual([
    FLOUR,
    { group: "לבצק", name: "1.5 כוס סוכר חום", amount: null, unit: null, note: null },
    SALT,
  ]);
  expect(patch).not.toHaveProperty("steps");
});

test("delete asks for confirmation, calls admin-action, refreshes and clears the editor", async () => {
  const invalidate = vi.spyOn(QueryClient.prototype, "invalidateQueries");
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  await load();
  await userEvent.click(screen.getByRole("button", { name: "מחיקה" }));
  expect(confirm).toHaveBeenCalledWith("למחוק את המתכון לצמיתות?");
  expect(adminAction).toHaveBeenCalledWith({ action: "delete", recipe_id: ID });
  expect(await screen.findByRole("status")).toHaveTextContent("נמחק");
  expect(screen.queryByLabelText("כותרת")).not.toBeInTheDocument();
  expect(screen.getByLabelText(/מזהה מתכון/)).toHaveValue("");
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["recipes"] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["recipe", ID] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["review-queue"] });
});

test("delete is not sent when the confirmation is cancelled", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(false);
  await load();
  await userEvent.click(screen.getByRole("button", { name: "מחיקה" }));
  expect(adminAction).not.toHaveBeenCalled();
  expect(screen.getByLabelText("כותרת")).toBeInTheDocument();
});

test("a failed delete shows the server's Hebrew message", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  adminAction.mockRejectedValueOnce(new Error("המתכון בעיבוד כרגע, נסו שוב בעוד כמה דקות"));
  await load();
  await userEvent.click(screen.getByRole("button", { name: "מחיקה" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("המתכון בעיבוד כרגע, נסו שוב בעוד כמה דקות");
  expect(screen.getByLabelText("כותרת")).toBeInTheDocument();
});

test("regenerating the image also refreshes the feed", async () => {
  const invalidate = vi.spyOn(QueryClient.prototype, "invalidateQueries");
  await load();
  await userEvent.click(screen.getByRole("button", { name: "תמונה חדשה" }));
  expect(await screen.findByRole("status")).toHaveTextContent("נוצרה תמונה חדשה");
  expect(adminAction).toHaveBeenCalledWith({ action: "regenerate-image", recipe_id: ID });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["recipes"] });
});

test("needs_review shows how to publish", async () => {
  status = "needs_review";
  await load();
  expect(screen.getByText("לפרסום השתמשו ב'עיבוד מחדש' בלשונית לטיפול")).toBeInTheDocument();
});

test("published recipes do not show the publish hint", async () => {
  await load();
  expect(screen.queryByText("לפרסום השתמשו ב'עיבוד מחדש' בלשונית לטיפול")).not.toBeInTheDocument();
});
