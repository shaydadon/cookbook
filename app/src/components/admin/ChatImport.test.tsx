import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { renderWithProviders, TEST_ADMIN } from "../../test/render";
import { ChatImport } from "./ChatImport";

const invoke = vi.fn();
vi.mock("../../lib/supabase", () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));

beforeEach(() => {
  invoke.mockReset();
});

test("after a failed import, choosing the same file again calls invoke again", async () => {
  invoke.mockResolvedValueOnce({ data: null, error: new Error("boom") });
  invoke.mockResolvedValueOnce({ data: { total: 0, next_offset: null, created: 0, duplicates: 0 }, error: null });
  renderWithProviders(<ChatImport />, { member: TEST_ADMIN });
  const input = screen.getByLabelText("קובץ ייצוא (.txt)") as HTMLInputElement;
  const file = new File(["hello"], "_chat.txt", { type: "text/plain" });

  fireEvent.change(input, { target: { files: [file] } });
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(invoke).toHaveBeenCalledTimes(1);
  expect(input.value).toBe("");

  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(invoke).toHaveBeenCalledTimes(2));
});
