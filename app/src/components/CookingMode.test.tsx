import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { CookingMode, relevantIngredients } from "./CookingMode";

const steps = [{ text: "קוצצים את הבצל." }, { text: "מטגנים את הבצל עם השום." }, { text: "מגישים." }];
const ingredients = [
  { group: null, name: "בצל", amount: "1", unit: null, note: null },
  { group: null, name: "שום", amount: "2", unit: "שיני", note: null },
];

afterEach(() => {
  // @ts-expect-error test cleanup
  delete navigator.wakeLock;
});

test("relevantIngredients matches names inside the step (with Hebrew prefixes)", () => {
  expect(relevantIngredients(steps[1], ingredients).map((i) => i.name)).toEqual(["בצל", "שום"]);
  expect(relevantIngredients(steps[2], ingredients)).toEqual([]);
});

test("steps forward and back with buttons, keys and swipes", async () => {
  render(<CookingMode title="ממרח" steps={steps} ingredients={ingredients} onExit={() => {}} />);
  expect(screen.getByText("שלב 1 מתוך 3")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "הבא" }));
  expect(screen.getByText("מטגנים את הבצל עם השום.")).toBeInTheDocument();
  expect(screen.getByText("2 שיני שום")).toBeInTheDocument();
  fireEvent.keyDown(window, { key: "ArrowRight" });
  expect(screen.getByText("שלב 1 מתוך 3")).toBeInTheDocument();
  const area = screen.getByTestId("swipe-area");
  fireEvent.touchStart(area, { touches: [{ clientX: 100, clientY: 0 }] });
  fireEvent.touchEnd(area, { changedTouches: [{ clientX: 220, clientY: 0 }] });
  expect(screen.getByText("שלב 2 מתוך 3")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "הקודם" })).toBeEnabled();
});

test("last step offers finishing", async () => {
  const onExit = vi.fn();
  render(<CookingMode title="ממרח" steps={[{ text: "מגישים." }]} ingredients={[]} onExit={onExit} />);
  await userEvent.click(screen.getByRole("button", { name: "סיימתי" }));
  expect(onExit).toHaveBeenCalled();
});

test("requests a screen wake lock and releases it on unmount", async () => {
  const release = vi.fn().mockResolvedValue(undefined);
  const request = vi.fn().mockResolvedValue({ release, addEventListener: () => {} });
  Object.defineProperty(navigator, "wakeLock", { value: { request }, configurable: true });
  const { unmount } = render(<CookingMode title="x" steps={steps} ingredients={[]} onExit={() => {}} />);
  await waitFor(() => expect(request).toHaveBeenCalledWith("screen"));
  unmount();
  await waitFor(() => expect(release).toHaveBeenCalled());
});

test("works when wake lock is unsupported or rejected", async () => {
  Object.defineProperty(navigator, "wakeLock", { value: { request: vi.fn().mockRejectedValue(new Error("NotAllowed")) }, configurable: true });
  render(<CookingMode title="x" steps={steps} ingredients={[]} onExit={() => {}} />);
  await userEvent.click(screen.getByRole("button", { name: "הבא" }));
  expect(screen.getByText("שלב 2 מתוך 3")).toBeInTheDocument();
});
