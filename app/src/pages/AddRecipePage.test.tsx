import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { beforeEach, expect, test, vi } from "vitest";
import { renderWithProviders } from "../test/render";
import AddRecipePage from "./AddRecipePage";

const ingestLink = vi.fn();
vi.mock("../lib/recipes", async (orig) => ({
  ...(await orig<typeof import("../lib/recipes")>()),
  ingestLink: (...a: unknown[]) => ingestLink(...a),
}));
vi.mock("../components/StatusCard", () => ({
  StatusCard: ({ recipeId, duplicate }: { recipeId: string; duplicate: boolean }) =>
    <div>STATUS {recipeId} {duplicate ? "dup" : "new"}</div>,
}));

// Block body on purpose: mockReset() returns the mock, and vitest would run a returned function as teardown.
beforeEach(() => { ingestLink.mockReset(); });

test("pre-fills from a share and submits link + note", async () => {
  ingestLink.mockResolvedValue([{ url: "https://vm.tiktok.com/ZS1/", recipe_id: "r9", status: "queued", duplicate: false }]);
  renderWithProviders(<AddRecipePage />, { route: "/add?text=" + encodeURIComponent("מדהים https://vm.tiktok.com/ZS1/") });
  expect(screen.getByLabelText("קישור למתכון")).toHaveValue("https://vm.tiktok.com/ZS1/");
  expect(screen.getByLabelText("הערה (לא חובה)")).toHaveValue("מדהים");
  await userEvent.click(screen.getByRole("button", { name: "הוספה" }));
  expect(ingestLink).toHaveBeenCalledWith("מדהים\nhttps://vm.tiktok.com/ZS1/");
  expect(await screen.findByText("STATUS r9 new")).toBeInTheDocument();
});

test("submitting the same link twice renders one status card", async () => {
  ingestLink.mockResolvedValue([
    { url: "https://a.test/r", recipe_id: "r5", status: "queued", duplicate: false },
    { url: "https://a.test/r", recipe_id: "r5", status: "queued", duplicate: false },
  ]);
  renderWithProviders(<AddRecipePage />, { route: "/add?url=https%3A%2F%2Fa.test%2Fr" });
  await userEvent.click(screen.getByRole("button", { name: "הוספה" }));
  expect(await screen.findAllByText("STATUS r5 new")).toHaveLength(1);
  await userEvent.type(screen.getByLabelText("קישור למתכון"), "https://a.test/r");
  await userEvent.click(screen.getByRole("button", { name: "הוספה" }));
  expect(await screen.findAllByText(/STATUS r5/)).toHaveLength(1);
  expect(ingestLink).toHaveBeenCalledTimes(2);
});

test("rejects input without a link", async () => {
  renderWithProviders(<AddRecipePage />, { route: "/add" });
  await userEvent.type(screen.getByLabelText("קישור למתכון"), "סתם טקסט");
  await userEvent.click(screen.getByRole("button", { name: "הוספה" }));
  expect(screen.getByRole("alert")).toHaveTextContent("לא נמצא קישור");
  expect(ingestLink).not.toHaveBeenCalled();
});

test("shows an error when the server fails", async () => {
  ingestLink.mockRejectedValue(new Error("500"));
  renderWithProviders(<AddRecipePage />, { route: "/add?url=https%3A%2F%2Fa.test%2Fr" });
  await userEvent.click(screen.getByRole("button", { name: "הוספה" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("משהו השתבש");
});

test("offline on submit says there is no connection and keeps the link", async () => {
  const spy = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  try {
    renderWithProviders(<AddRecipePage />, { route: "/add?url=https%3A%2F%2Fa.test%2Fr" });
    await userEvent.click(screen.getByRole("button", { name: "הוספה" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("אין חיבור לאינטרנט");
    expect(screen.getByLabelText("קישור למתכון")).toHaveValue("https://a.test/r");
  } finally {
    spy.mockRestore();
  }
});

// The sheet title is the heading (an h2 in the dialog); Layout owns the page h1.
test("renders as a dialog titled מתכון חדש with no h1 of its own", () => {
  renderWithProviders(<AddRecipePage />, { route: "/add" });
  expect(screen.getByRole("dialog", { name: "מתכון חדש" })).toBeInTheDocument();
  expect(screen.getByLabelText("קישור למתכון")).toBeInTheDocument();
  expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
});

test("opened directly (share target), ביטול closes to the feed", async () => {
  renderWithProviders(
    <Routes>
      <Route path="/add" element={<AddRecipePage />} />
      <Route path="/" element={<p>FEED</p>} />
    </Routes>,
    { route: "/add?text=https%3A%2F%2Fa.test%2Fr" },
  );
  await userEvent.click(screen.getByRole("button", { name: "ביטול" }));
  expect(await screen.findByText("FEED")).toBeInTheDocument();
});
