import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router";
import { expect, test } from "vitest";
import { renderWithProviders } from "../test/render";
import { RequireMember } from "./RequireMember";

const guarded = (
  <Routes>
    <Route element={<RequireMember />}>
      <Route path="/" element={<div>FEED</div>} />
    </Route>
  </Routes>
);

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
