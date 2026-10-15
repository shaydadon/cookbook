import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { renderWithProviders, TEST_ADMIN } from "../../test/render";
import { AllowList } from "./AllowList";

const h = vi.hoisted(() => ({
  list: vi.fn(),
  insert: vi.fn(),
  del: vi.fn(),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({ order: () => h.list() }),
      insert: (row: unknown) => h.insert(row),
      delete: () => ({ eq: (_c: string, v: string) => h.del(v) }),
    }),
  },
}));

const ROWS = [{ email: "rachel@test.local", whatsapp_name: "רחל", role: "member" }];

beforeEach(() => {
  h.list.mockReset();
  h.list.mockResolvedValue({ data: ROWS, error: null });
  h.insert.mockReset();
  h.insert.mockResolvedValue({ error: null });
  h.del.mockReset();
  h.del.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("a list load error shows an alert with retry", async () => {
  h.list.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
  renderWithProviders(<AllowList />, { member: TEST_ADMIN });
  expect(await screen.findByRole("alert")).toHaveTextContent("לא הצלחנו לטעון את הרשימה");
  await userEvent.click(screen.getByRole("button", { name: "נסו שוב" }));
  expect(await screen.findByText("rachel@test.local")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("a failed add shows an alert", async () => {
  h.insert.mockResolvedValueOnce({ error: { message: "duplicate" } });
  renderWithProviders(<AllowList />, { member: TEST_ADMIN });
  await screen.findByText("rachel@test.local");
  await userEvent.type(screen.getByLabelText("אימייל חבר/ה"), "rachel@test.local");
  await userEvent.click(screen.getByRole("button", { name: "הוספה לרשימה" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("לא נוסף");
});

test("a failed remove shows an alert", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  h.del.mockResolvedValueOnce({ error: { message: "rls" } });
  renderWithProviders(<AllowList />, { member: TEST_ADMIN });
  await userEvent.click(await screen.findByRole("button", { name: "הסרה" }));
  expect(h.del).toHaveBeenCalledWith("rachel@test.local");
  expect(await screen.findByRole("alert")).toHaveTextContent("ההסרה נכשלה");
});
