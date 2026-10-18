import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { AppFrame } from "./AppFrame";

test("frame is the scroll container and contains fixed children", () => {
  render(<AppFrame><div style={{ position: "fixed" }}>tab bar</div></AppFrame>);
  const scroller = document.getElementById("app-scroll")!;
  expect(scroller).toBeInTheDocument();
  expect(scroller).toContainElement(screen.getByText("tab bar"));
  expect(scroller.parentElement!.className).toMatch(/max-w-\[430px\]/);
  expect(scroller.className).toMatch(/overflow-y-auto/);
});

// Review fix: a transform on the scroller itself makes fixed children scroll away with the content.
test("the transformed frame does not scroll; an inner element does", () => {
  render(<AppFrame><div style={{ position: "fixed" }}>tab bar</div></AppFrame>);
  const scroller = document.getElementById("app-scroll")!;
  const frame = scroller.parentElement!;
  expect(frame.className).toMatch(/translateZ/);
  expect(frame.className).not.toMatch(/overflow-y-auto/);
  expect(scroller.className).not.toMatch(/translateZ/);
});

test("from the desktop breakpoint the frame is the full window, not a phone-width column", () => {
  render(<AppFrame><p>x</p></AppFrame>);
  const frame = document.getElementById("app-scroll")!.parentElement!;
  expect(frame.className).toMatch(/desk:max-w-none/);
  expect(frame.className).toMatch(/max-\[899px\]:rounded-3xl/); // the floating phone look is only for tablets
});
