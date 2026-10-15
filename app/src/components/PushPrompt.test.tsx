import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { renderWithProviders } from "../test/render";
import { PushPrompt } from "./PushPrompt";

const subscribePush = vi.fn().mockResolvedValue(undefined);
vi.mock("../lib/push", async (orig) => ({
  ...(await orig<typeof import("../lib/push")>()),
  pushSupported: () => true,
  subscribePush: (...a: unknown[]) => subscribePush(...a),
}));

const originalNotification = globalThis.Notification;

beforeEach(() => {
  localStorage.clear();
  subscribePush.mockReset();
  subscribePush.mockResolvedValue(undefined);
  // @ts-expect-error jsdom has no Notification
  globalThis.Notification = { permission: "default", requestPermission: vi.fn().mockResolvedValue("granted") };
  vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "BKey");
});

afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.Notification = originalNotification;
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

test("when subscribing fails the alert shows and the prompt stays", async () => {
  subscribePush.mockRejectedValue(new Error("boom"));
  renderWithProviders(<PushPrompt />);
  await userEvent.click(screen.getByRole("button", { name: "כן, תודיעו לי" }));
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "כן, תודיעו לי" })).toBeEnabled();
});

test("hidden when no VAPID key is configured", () => {
  vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "");
  renderWithProviders(<PushPrompt />);
  expect(screen.queryByRole("button", { name: "כן, תודיעו לי" })).not.toBeInTheDocument();
});

test("already granted: subscribes silently on mount without asking", async () => {
  // @ts-expect-error test stub
  globalThis.Notification.permission = "granted";
  renderWithProviders(<PushPrompt />);
  await waitFor(() => expect(subscribePush).toHaveBeenCalledWith("BKey"));
  expect(Notification.requestPermission).not.toHaveBeenCalled();
});
