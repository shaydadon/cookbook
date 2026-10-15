import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { renderWithProviders } from "../test/render";
import LoginPage from "./LoginPage";

const signInWithOtp = vi.fn();
vi.mock("../lib/supabase", () => ({
  supabase: { auth: { signInWithOtp: (...a: unknown[]) => signInWithOtp(...a), signInWithOAuth: vi.fn() } },
}));

beforeEach(() => {
  signInWithOtp.mockReset();
  sessionStorage.clear();
});

test("a Google redirect rejected by the members hook shows the members-only alert once", async () => {
  sessionStorage.setItem("auth-error", "Error running hook URI: pg-functions://postgres/public/before_user_created (403)");
  const { unmount } = renderWithProviders(<LoginPage />, { member: null, signedIn: false });
  expect(await screen.findByRole("alert")).toHaveTextContent("הגישה מותרת לחברי הקבוצה בלבד");
  expect(sessionStorage.getItem("auth-error")).toBeNull();
  unmount();
  renderWithProviders(<LoginPage />, { member: null, signedIn: false });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("any other redirect error shows a generic sign-in failure", async () => {
  sessionStorage.setItem("auth-error", "Unable to exchange external code");
  renderWithProviders(<LoginPage />, { member: null, signedIn: false });
  expect(await screen.findByRole("alert")).toHaveTextContent("הכניסה נכשלה. נסו שוב.");
});

test("sends a magic link and confirms", async () => {
  signInWithOtp.mockResolvedValue({ error: null });
  renderWithProviders(<LoginPage />, { member: null, signedIn: false });
  await userEvent.type(screen.getByLabelText("אימייל"), "Rachel@Test.local");
  await userEvent.click(screen.getByRole("button", { name: "שלחו לי קישור כניסה" }));
  expect(signInWithOtp).toHaveBeenCalledWith(expect.objectContaining({ email: "rachel@test.local" }));
  expect(await screen.findByText(/שלחנו קישור/)).toBeInTheDocument();
});

test("shows the members-only message when the hook rejects", async () => {
  signInWithOtp.mockResolvedValue({ error: { status: 403, message: "הגישה מותרת לחברי הקבוצה בלבד" } });
  renderWithProviders(<LoginPage />, { member: null, signedIn: false });
  await userEvent.type(screen.getByLabelText("אימייל"), "stranger@x.com");
  await userEvent.click(screen.getByRole("button", { name: "שלחו לי קישור כניסה" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("הגישה מותרת לחברי הקבוצה בלבד");
});
