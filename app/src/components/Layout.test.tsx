import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { renderWithProviders, TEST_ADMIN, TEST_MEMBER } from "../test/render";
import { Layout, titleFor } from "./Layout";

const shell = (
  <Routes>
    <Route element={<Layout />}>
      <Route path="/" element={<div>FEED</div>} />
      <Route path="/recipe/:id" element={<div>RECIPE</div>} />
      <Route path="/favorites" element={<div>FAVS</div>} />
    </Route>
  </Routes>
);

test("titleFor maps routes to large titles", () => {
  expect(titleFor("/")).toBe("המתכונים");
  expect(titleFor("/favorites")).toBe("מועדפים");
  expect(titleFor("/admin")).toBe("ניהול");
  expect(titleFor("/recipe/abc")).toBeNull();
});

test("admin sees the admin tab, one large-title h1 and the settings avatar", () => {
  renderWithProviders(shell, { member: TEST_ADMIN });
  expect(screen.getByRole("link", { name: "ניהול" })).toBeInTheDocument();
  for (const name of ["בית", "מועדפים", "הוספה"]) expect(screen.getByRole("link", { name })).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("המתכונים");
  expect(screen.getByRole("button", { name: "הגדרות" })).toBeInTheDocument();
});

test("regular member does not see the admin tab", () => {
  renderWithProviders(shell, { member: TEST_MEMBER });
  expect(screen.queryByRole("link", { name: "ניהול" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "מועדפים" })).toBeInTheDocument();
});

test("recipe route has no large-title header", () => {
  renderWithProviders(shell, { route: "/recipe/r1" });
  expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  expect(screen.getByText("RECIPE")).toBeInTheDocument();
});

test("navigating to another page scrolls the app back to the top", async () => {
  const scroller = document.createElement("div");
  scroller.id = "app-scroll";
  const scrollTo = vi.fn();
  scroller.scrollTo = scrollTo as unknown as typeof scroller.scrollTo;
  document.body.appendChild(scroller);
  try {
    renderWithProviders(shell, { member: TEST_MEMBER, route: "/" });
    scrollTo.mockClear();
    await userEvent.click(screen.getByRole("link", { name: "מועדפים" }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
  } finally {
    scroller.remove();
  }
});

test("the collapsed bar grows by the safe-area inset so it fits under a notch", () => {
  renderWithProviders(shell, { member: TEST_MEMBER });
  const bar = screen.getAllByText("המתכונים").find((el) => el.tagName === "DIV")!;
  expect(bar.className).toContain("h-[calc(2.75rem+env(safe-area-inset-top))]");
});
