import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { applyTheme, getThemePref, resolveTheme, setThemePref, THEME_COLORS, THEME_KEY } from "./theme";

describe("theme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.head.querySelector('meta[name="theme-color"]')?.remove();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("pref defaults to system and round-trips", () => {
    expect(getThemePref()).toBe("system");
    setThemePref("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
    expect(getThemePref()).toBe("dark");
    setThemePref("system");
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
  });

  test("unknown stored value reads as system", () => {
    localStorage.setItem(THEME_KEY, "purple");
    expect(getThemePref()).toBe("system");
  });

  test("storage failure falls back to system and never throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(getThemePref()).toBe("system");
    expect(() => setThemePref("dark")).not.toThrow();
  });

  test("resolveTheme", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  test("applyTheme sets data-theme, color-scheme and theme-color meta", () => {
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(document.head.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe(THEME_COLORS.dark);
    applyTheme("light");
    expect(document.head.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe(THEME_COLORS.light);
  });
});
