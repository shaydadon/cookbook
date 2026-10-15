import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ThemeProvider, useTheme } from "./ThemeProvider";

let listeners: Array<() => void> = [];
let dark = false;

beforeEach(() => {
  localStorage.clear();
  listeners = [];
  dark = false;
  vi.stubGlobal("matchMedia", (q: string) => ({
    get matches() { return q.includes("dark") ? dark : false; },
    media: q,
    addEventListener: (_: string, cb: () => void) => { listeners.push(cb); },
    removeEventListener: (_: string, cb: () => void) => { listeners = listeners.filter((l) => l !== cb); },
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function Probe() {
  const { pref, resolved, setPref } = useTheme();
  return (
    <div>
      <span>{pref}/{resolved}</span>
      <button onClick={() => setPref("dark")}>dark</button>
      <button onClick={() => setPref("system")}>system</button>
    </div>
  );
}

test("follows the system while pref is system", () => {
  render(<ThemeProvider><Probe /></ThemeProvider>);
  expect(screen.getByText("system/light")).toBeInTheDocument();
  expect(document.documentElement.dataset.theme).toBe("light");
  act(() => { dark = true; listeners.forEach((l) => l()); });
  expect(screen.getByText("system/dark")).toBeInTheDocument();
  expect(document.documentElement.dataset.theme).toBe("dark");
});

test("explicit pref wins, persists, and stops listening", async () => {
  render(<ThemeProvider><Probe /></ThemeProvider>);
  await userEvent.click(screen.getByRole("button", { name: "dark" }));
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.getItem("theme-pref")).toBe("dark");
  expect(listeners).toHaveLength(0);
});
