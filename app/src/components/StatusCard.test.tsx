import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { expect, test, vi } from "vitest";
import { STATUS_LABEL } from "../lib/status";
import { StatusCard } from "./StatusCard";

type Handler = (payload: { new: { status: string; title: string | null } }) => void;
const captured: { handler: Handler | null } = { handler: null };
const getRecipe = vi.fn();

vi.mock("../lib/supabase", () => {
  const channel = {
    on: (_t: string, _f: unknown, h: Handler) => { captured.handler = h; return channel; },
    subscribe: () => channel,
  };
  return { supabase: { channel: () => channel, removeChannel: vi.fn() } };
});
vi.mock("../lib/recipes", () => ({ getRecipe: (...a: unknown[]) => getRecipe(...a) }));

test("a late initial fetch does not overwrite a newer realtime status", async () => {
  let resolveFetch!: (r: { status: string; title: string | null }) => void;
  getRecipe.mockReturnValue(new Promise((res) => { resolveFetch = res; }));
  render(<MemoryRouter><StatusCard recipeId="r1" initialStatus="queued" duplicate={false} /></MemoryRouter>);

  act(() => captured.handler!({ new: { status: "published", title: "עוגה" } }));
  expect(screen.getByText(STATUS_LABEL.published)).toBeInTheDocument();

  await act(async () => { resolveFetch({ status: "processing", title: null }); });
  expect(screen.getByText(STATUS_LABEL.published)).toBeInTheDocument();
  expect(screen.getByText("עוגה")).toBeInTheDocument();
});
