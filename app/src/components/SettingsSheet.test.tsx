import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { renderWithProviders, TEST_MEMBER } from "../test/render";
import { SettingsSheet } from "./SettingsSheet";

vi.mock("../lib/push", async (orig) => ({
  ...(await orig<typeof import("../lib/push")>()),
  pushSupported: () => false,
}));

beforeEach(() => {
  localStorage.clear();
  document.documentElement.dataset.theme = "light";
});

test("shows the account and switches + persists the theme", async () => {
  renderWithProviders(<SettingsSheet open onClose={() => {}} />);
  expect(screen.getByRole("dialog", { name: "הגדרות" })).toBeInTheDocument();
  expect(screen.getByText(TEST_MEMBER.display_name)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("radio", { name: "כהה" }));
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.getItem("theme-pref")).toBe("dark");
});

test("notifications row explains when push is unsupported", () => {
  renderWithProviders(<SettingsSheet open onClose={() => {}} />);
  expect(screen.getByText("התראות לא נתמכות בדפדפן הזה")).toBeInTheDocument();
});

test("sign-out row calls signOut", async () => {
  const signOut = vi.fn().mockResolvedValue(undefined);
  renderWithProviders(<SettingsSheet open onClose={() => {}} />, { signOut });
  await userEvent.click(screen.getByRole("button", { name: "התנתקות" }));
  expect(signOut).toHaveBeenCalled();
});
