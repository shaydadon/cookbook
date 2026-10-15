import { act, renderHook } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { useDebounced } from "./useDebounced";

test("only emits the last value after the pause", () => {
  vi.useFakeTimers();
  const { result, rerender } = renderHook(({ v }) => useDebounced(v, 300), { initialProps: { v: "" } });
  rerender({ v: "ש" });
  rerender({ v: "שק" });
  rerender({ v: "שקשוקה 50%" });
  expect(result.current).toBe("");
  act(() => vi.advanceTimersByTime(300));
  expect(result.current).toBe("שקשוקה 50%");
  vi.useRealTimers();
});
