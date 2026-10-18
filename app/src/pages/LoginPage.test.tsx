import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { renderWithProviders } from "../test/render";
import LoginPage from "./LoginPage";

const signInWithOtp = vi.fn();
const verifyOtp = vi.fn();
vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithOtp: (...a: unknown[]) => signInWithOtp(...a),
      verifyOtp: (...a: unknown[]) => verifyOtp(...a),
      signInWithOAuth: vi.fn(),
    },
  },
}));

beforeEach(() => {
  signInWithOtp.mockReset();
  verifyOtp.mockReset();
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
  expect(await screen.findByText(/שלחנו קישור וקוד/)).toBeInTheDocument();
});

test("shows the members-only message when the hook rejects", async () => {
  signInWithOtp.mockResolvedValue({ error: { status: 403, message: "הגישה מותרת לחברי הקבוצה בלבד" } });
  renderWithProviders(<LoginPage />, { member: null, signedIn: false });
  await userEvent.type(screen.getByLabelText("אימייל"), "stranger@x.com");
  await userEvent.click(screen.getByRole("button", { name: "שלחו לי קישור כניסה" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("הגישה מותרת לחברי הקבוצה בלבד");
});

// The installed phone app keeps its own storage: a link opened from the email signs in the browser, not the
// app. Typing the emailed code into the app signs the app itself in, and it stays signed in until logout.
async function sendTo(email: string) {
  signInWithOtp.mockResolvedValue({ error: null });
  renderWithProviders(<LoginPage />, { member: null, signedIn: false });
  await userEvent.type(screen.getByLabelText("אימייל"), email);
  await userEvent.click(screen.getByRole("button", { name: "שלחו לי קישור כניסה" }));
}

test("after sending, the emailed code signs in inside the app", async () => {
  verifyOtp.mockResolvedValue({ data: { session: {} }, error: null });
  await sendTo("Rachel@Test.local");
  const code = await screen.findByLabelText("קוד מהמייל");
  expect(code).toHaveAttribute("autocomplete", "one-time-code");
  expect(code).toHaveAttribute("inputmode", "numeric");
  await userEvent.type(code, "123 456");
  expect(code).toHaveValue("123456");
  await userEvent.click(screen.getByRole("button", { name: "כניסה" }));
  expect(verifyOtp).toHaveBeenCalledWith({ email: "rachel@test.local", token: "123456", type: "email" });
});

test("a wrong or expired code says so and keeps the code screen", async () => {
  verifyOtp.mockResolvedValue({ data: {}, error: { status: 403, message: "Token has expired or is invalid" } });
  await sendTo("rachel@test.local");
  await userEvent.type(await screen.findByLabelText("קוד מהמייל"), "111111");
  await userEvent.click(screen.getByRole("button", { name: "כניסה" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("הקוד שגוי או שפג תוקפו");
  expect(screen.getByLabelText("קוד מהמייל")).toBeInTheDocument();
});

test("a short code is not sent", async () => {
  await sendTo("rachel@test.local");
  await userEvent.type(await screen.findByLabelText("קוד מהמייל"), "123");
  expect(screen.getByRole("button", { name: "כניסה" })).toBeDisabled();
});

test("a new code can be requested, and the email changed", async () => {
  await sendTo("rachel@test.local");
  await userEvent.click(await screen.findByRole("button", { name: "שליחת קוד חדש" }));
  expect(signInWithOtp).toHaveBeenCalledTimes(2);
  expect(await screen.findByText("שלחנו קוד חדש")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "החלפת אימייל" }));
  expect(screen.getByLabelText("אימייל")).toHaveValue("rachel@test.local");
});

test("signing in with the code asks the browser to keep the app storage", async () => {
  const persist = vi.fn().mockResolvedValue(true);
  Object.defineProperty(navigator, "storage", { value: { persist }, configurable: true });
  verifyOtp.mockResolvedValue({ data: { session: {} }, error: null });
  await sendTo("rachel@test.local");
  await userEvent.type(await screen.findByLabelText("קוד מהמייל"), "123456");
  await userEvent.click(screen.getByRole("button", { name: "כניסה" }));
  await vi.waitFor(() => expect(persist).toHaveBeenCalled());
});
