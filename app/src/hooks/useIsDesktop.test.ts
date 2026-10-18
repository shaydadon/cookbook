import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { stubDesktop } from "../test/media";
import { useIsDesktop } from "./useIsDesktop";

afterEach(() => vi.unstubAllGlobals());

test("is false where matchMedia is unavailable (phones are the default)", () => {
  vi.stubGlobal("matchMedia", undefined);
  expect(renderHook(() => useIsDesktop()).result.current).toBe(false);
});

test("follows the desktop media query as the window is resized", () => {
  const mq = stubDesktop(true);
  const { result } = renderHook(() => useIsDesktop());
  expect(result.current).toBe(true);
  act(() => mq.set(false));
  expect(result.current).toBe(false);
});
