import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function Boom(): never {
  throw new Error("boom");
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("a throwing child renders the Hebrew fallback with a reload button", async () => {
  const reload = vi.fn();
  vi.stubGlobal("location", { ...window.location, reload });
  render(<ErrorBoundary><Boom /></ErrorBoundary>);
  expect(screen.getByRole("alert")).toHaveTextContent("משהו השתבש");
  await userEvent.click(screen.getByRole("button", { name: "רענון" }));
  expect(reload).toHaveBeenCalled();
});

test("renders children when nothing throws", () => {
  render(<ErrorBoundary><p>תקין</p></ErrorBoundary>);
  expect(screen.getByText("תקין")).toBeInTheDocument();
});
