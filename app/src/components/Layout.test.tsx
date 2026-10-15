import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router";
import { expect, test } from "vitest";
import { renderWithProviders, TEST_ADMIN, TEST_MEMBER } from "../test/render";
import { Layout } from "./Layout";

const shell = (
  <Routes>
    <Route element={<Layout />}>
      <Route path="/" element={<div>FEED</div>} />
    </Route>
  </Routes>
);

test("admin sees the admin tab", () => {
  renderWithProviders(shell, { member: TEST_ADMIN });
  expect(screen.getByRole("link", { name: "ניהול" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "בית" })).toBeInTheDocument();
});

test("regular member does not see the admin tab", () => {
  renderWithProviders(shell, { member: TEST_MEMBER });
  expect(screen.queryByRole("link", { name: "ניהול" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "מועדפים" })).toBeInTheDocument();
});
