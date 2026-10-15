import { screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { renderWithProviders, TEST_ADMIN } from "../test/render";
import AdminPage from "./AdminPage";

vi.mock("../components/admin/ReviewQueue", () => ({ ReviewQueue: () => <div>REVIEW</div> }));
vi.mock("../components/admin/EditRecipe", () => ({ EditRecipe: () => <div>EDIT</div> }));
vi.mock("../components/admin/ChatImport", () => ({ ChatImport: () => <div>IMPORT</div> }));
vi.mock("../components/admin/AllowList", () => ({ AllowList: () => <div>MEMBERS</div> }));

// The page h1 ("ניהול") is rendered by Layout's large-title header; the page itself must not add another.
test("admin page renders no h1 of its own", () => {
  renderWithProviders(<AdminPage />, { member: TEST_ADMIN });
  expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "לטיפול" })).toBeInTheDocument();
});

test("tabs render as a segmented control with the review tab selected", () => {
  renderWithProviders(<AdminPage />, { member: TEST_ADMIN });
  const list = screen.getByRole("tablist");
  expect(list.className).toMatch(/bg-fill/);
  expect(screen.getByRole("tab", { name: "לטיפול" })).toHaveAttribute("aria-selected", "true");
});
