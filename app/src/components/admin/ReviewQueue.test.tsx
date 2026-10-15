import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { renderWithProviders, TEST_ADMIN } from "../../test/render";
import { ReviewQueue } from "./ReviewQueue";

const adminAction = vi.fn();
vi.mock("../../lib/recipes", async (orig) => ({
  ...(await orig<typeof import("../../lib/recipes")>()),
  listReviewQueue: async () => [{
    id: "r1", status: "needs_review", source_url: "https://instagram.com/reel/x", source_platform: "instagram",
    title: null, description: null, ingredients: [], steps: [], prep_minutes: null, cook_minutes: null, servings: null,
    category: null, tags: [], image_path: null, error: "לא נמצא תוכן מתכון בקישור", created_at: "2026-10-14T08:00:00Z", published_at: null,
  }],
  adminAction: (...a: unknown[]) => adminAction(...a),
}));

beforeEach(() => {
  adminAction.mockReset();
  adminAction.mockResolvedValue({ status: "rewriting" });
});

test("shows the error and retries with pasted content", async () => {
  renderWithProviders(<ReviewQueue />, { member: TEST_ADMIN });
  expect(await screen.findByText("לא נמצא תוכן מתכון בקישור")).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText("הדבקת טקסט המתכון"), "2 ביצים, מלח. מטגנים.");
  await userEvent.click(screen.getByRole("button", { name: "עיבוד מחדש" }));
  expect(adminAction).toHaveBeenCalledWith({ action: "retry", recipe_id: "r1", raw_content: "2 ביצים, מלח. מטגנים." });
});

test("delete asks for confirmation", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  renderWithProviders(<ReviewQueue />, { member: TEST_ADMIN });
  await userEvent.click(await screen.findByRole("button", { name: "מחיקה" }));
  expect(adminAction).toHaveBeenCalledWith({ action: "delete", recipe_id: "r1" });
});

test("shows the server's Hebrew message when an action fails", async () => {
  adminAction.mockRejectedValueOnce(new Error("המתכון בעיבוד כרגע, נסו שוב בעוד כמה דקות"));
  renderWithProviders(<ReviewQueue />, { member: TEST_ADMIN });
  await userEvent.click(await screen.findByRole("button", { name: "עיבוד מחדש" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("המתכון בעיבוד כרגע, נסו שוב בעוד כמה דקות");
});
