import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { expect, test, vi } from "vitest";
import { renderWithProviders } from "../test/render";
import { RequireMember } from "./RequireMember";

const guarded = (
  <Routes>
    <Route element={<RequireMember />}>
      <Route path="/" element={<div>FEED</div>} />
    </Route>
  </Routes>
);

test("loading shows a status and neither the page nor a redirect", () => {
  renderWithProviders(guarded, { loading: true, member: null, signedIn: false });
  expect(screen.getByRole("status")).toBeInTheDocument();
  expect(screen.queryByText("LOGIN PAGE")).not.toBeInTheDocument();
  expect(screen.queryByText("FEED")).not.toBeInTheDocument();
});

test("a failed account lookup shows an error screen with retry, not the members-only screen", async () => {
  const retry = vi.fn();
  renderWithProviders(guarded, { member: null, signedIn: true, error: "לא הצלחנו לטעון את החשבון", retry });
  expect(screen.getByText("לא הצלחנו לטעון את החשבון")).toBeInTheDocument();
  expect(screen.queryByText("הגישה מותרת לחברי הקבוצה בלבד")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "התנתקות" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "נסו שוב" }));
  expect(retry).toHaveBeenCalledTimes(1);
});

test("member sees the page", () => {
  renderWithProviders(guarded);
  expect(screen.getByText("FEED")).toBeInTheDocument();
});

test("signed-out user is sent to login", () => {
  renderWithProviders(guarded, { member: null, signedIn: false });
  expect(screen.getByText("LOGIN PAGE")).toBeInTheDocument();
});

test("signed-in non-member sees the members-only screen with sign out", () => {
  renderWithProviders(guarded, { member: null, signedIn: true });
  expect(screen.getByText("הגישה מותרת לחברי הקבוצה בלבד")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "התנתקות" })).toBeInTheDocument();
  expect(screen.queryByText("FEED")).not.toBeInTheDocument();
});
