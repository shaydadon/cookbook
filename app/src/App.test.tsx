import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { APP_NAME } from "./lib/app";

test("renders the app name", () => {
  render(<h1>{APP_NAME}</h1>);
  expect(screen.getByRole("heading")).toHaveTextContent("המתכונים שלנו");
});
