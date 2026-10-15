import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { AppFrame } from "./AppFrame";

test("frame is the scroll container and contains fixed children", () => {
  render(<AppFrame><div style={{ position: "fixed" }}>tab bar</div></AppFrame>);
  const frame = document.getElementById("app-scroll")!;
  expect(frame).toBeInTheDocument();
  expect(frame).toContainElement(screen.getByText("tab bar"));
  expect(frame.className).toMatch(/max-w-\[430px\]/);
  expect(frame.className).toMatch(/overflow-y-auto/);
});
