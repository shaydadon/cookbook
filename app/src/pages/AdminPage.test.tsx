import { screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { renderWithProviders, TEST_ADMIN } from "../test/render";
import AdminPage from "./AdminPage";

vi.mock("../components/admin/ReviewQueue", () => ({ ReviewQueue: () => <div>REVIEW</div> }));
vi.mock("../components/admin/EditRecipe", () => ({ EditRecipe: () => <div>EDIT</div> }));
vi.mock("../components/admin/ChatImport", () => ({ ChatImport: () => <div>IMPORT</div> }));
vi.mock("../components/admin/AllowList", () => ({ AllowList: () => <div>MEMBERS</div> }));

test("admin page has a single h1", () => {
  renderWithProviders(<AdminPage />, { member: TEST_ADMIN });
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("ניהול");
});
