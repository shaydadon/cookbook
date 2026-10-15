import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { Segmented } from "./Segmented";

test("renders radios, marks the selected one and reports changes", async () => {
  const onChange = vi.fn();
  render(<Segmented label="מראה" value="light" onChange={onChange}
    options={[{ value: "system", label: "מערכת" }, { value: "light", label: "בהיר" }, { value: "dark", label: "כהה" }]} />);
  expect(screen.getByRole("radiogroup", { name: "מראה" })).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "בהיר" })).toHaveAttribute("aria-checked", "true");
  expect(screen.getByRole("radio", { name: "כהה" })).toHaveAttribute("aria-checked", "false");
  await userEvent.click(screen.getByRole("radio", { name: "כהה" }));
  expect(onChange).toHaveBeenCalledWith("dark");
});
