import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, test, vi } from "vitest";
import { Sheet } from "./Sheet";

test("closed sheet renders nothing", () => {
  render(<Sheet open={false} onClose={() => {}} title="מתכון חדש"><p>body</p></Sheet>);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("open sheet is a labelled modal dialog; Esc and backdrop close it", async () => {
  const onClose = vi.fn();
  render(<Sheet open onClose={onClose} title="מתכון חדש"><p>body</p></Sheet>);
  const dialog = screen.getByRole("dialog", { name: "מתכון חדש" });
  expect(dialog).toHaveAttribute("aria-modal", "true");
  await userEvent.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByTestId("sheet-backdrop"));
  expect(onClose).toHaveBeenCalledTimes(2);
});

test("focus moves into the sheet and returns to the opener on close", async () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>open</button>
        <Sheet open={open} onClose={() => setOpen(false)} title="הגדרות"><button>inside</button></Sheet>
      </>
    );
  }
  render(<Harness />);
  const opener = screen.getByRole("button", { name: "open" });
  await userEvent.click(opener);
  expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
  await userEvent.keyboard("{Escape}");
  expect(opener).toHaveFocus();
});

test("Tab and Shift+Tab stay inside the open sheet", async () => {
  render(
    <>
      <button>behind</button>
      <Sheet open onClose={() => {}} title="t"><input aria-label="first" /><button>last</button></Sheet>
    </>,
  );
  screen.getByRole("button", { name: "last" }).focus();
  await userEvent.tab();
  expect(screen.getByLabelText("first")).toHaveFocus();
  await userEvent.tab({ shift: true });
  expect(screen.getByRole("button", { name: "last" })).toHaveFocus();
});
