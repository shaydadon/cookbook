import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { renderWithProviders } from "../test/render";
import { PushPrompt } from "./PushPrompt";

const subscribePush = vi.fn().mockResolvedValue(undefined);
vi.mock("../lib/push", async (orig) => ({
  ...(await orig<typeof import("../lib/push")>()),
  pushSupported: () => true,
  subscribePush: (...a: unknown[]) => subscribePush(...a),
}));

beforeEach(() => {
  localStorage.clear();
  subscribePush.mockClear();
  // @ts-expect-error jsdom has no Notification
  globalThis.Notification = { permission: "default", requestPermission: vi.fn().mockResolvedValue("granted") };
  vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "BKey");
});

test("never asks on load; asks only after tapping yes", async () => {
  renderWithProviders(<PushPrompt />);
  expect(Notification.requestPermission).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "כן, תודיעו לי" }));
  expect(Notification.requestPermission).toHaveBeenCalled();
  expect(subscribePush).toHaveBeenCalledWith("BKey");
});

test("dismissal is remembered", async () => {
  const { unmount } = renderWithProviders(<PushPrompt />);
  await userEvent.click(screen.getByRole("button", { name: "לא עכשיו" }));
  unmount();
  renderWithProviders(<PushPrompt />);
  expect(screen.queryByRole("button", { name: "כן, תודיעו לי" })).not.toBeInTheDocument();
});

test("hidden when permission was already decided", () => {
  // @ts-expect-error test stub
  globalThis.Notification.permission = "denied";
  renderWithProviders(<PushPrompt />);
  expect(screen.queryByRole("button", { name: "כן, תודיעו לי" })).not.toBeInTheDocument();
});
