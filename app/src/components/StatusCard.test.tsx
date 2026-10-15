import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, test, vi } from "vitest";
import { STATUS_LABEL } from "../lib/status";
import { StatusCard } from "./StatusCard";

type Handler = (payload: { new: { status: string; title: string | null } }) => void;
type SubCb = (status: string) => void;
const h = vi.hoisted(() => ({
  handler: null as Handler | null,
  subCb: null as SubCb | null,
  removeChannel: vi.fn(),
  getRecipe: vi.fn(),
}));

vi.mock("../lib/supabase", () => {
  const channel = {
    on: (_t: string, _f: unknown, fn: Handler) => { h.handler = fn; return channel; },
    subscribe: (cb?: SubCb) => { h.subCb = cb ?? null; return channel; },
  };
  return { supabase: { channel: () => channel, removeChannel: h.removeChannel } };
});
vi.mock("../lib/recipes", () => ({ getRecipe: (...a: unknown[]) => h.getRecipe(...a) }));

beforeEach(() => {
  h.handler = null;
  h.subCb = null;
  h.removeChannel.mockReset();
  h.getRecipe.mockReset();
});

const card = () => render(<MemoryRouter><StatusCard recipeId="r1" initialStatus="queued" duplicate={false} /></MemoryRouter>);

test("a late initial fetch does not overwrite a newer realtime status", async () => {
  let resolveFetch!: (r: { status: string; title: string | null }) => void;
  h.getRecipe.mockReturnValue(new Promise((res) => { resolveFetch = res; }));
  card();

  act(() => h.handler!({ new: { status: "published", title: "עוגה" } }));
  expect(screen.getByText(STATUS_LABEL.published)).toBeInTheDocument();

  await act(async () => { resolveFetch({ status: "processing", title: null }); });
  expect(screen.getByText(STATUS_LABEL.published)).toBeInTheDocument();
  expect(screen.getByText("עוגה")).toBeInTheDocument();
});

test("SUBSCRIBED triggers a refetch that is applied when no realtime payload arrived", async () => {
  h.getRecipe
    .mockResolvedValueOnce({ status: "queued", title: null })
    .mockResolvedValueOnce({ status: "published", title: "פשטידה" });
  card();
  await act(async () => {});
  expect(h.getRecipe).toHaveBeenCalledTimes(1);

  await act(async () => { h.subCb!("SUBSCRIBED"); });
  expect(h.getRecipe).toHaveBeenCalledTimes(2);
  expect(screen.getByText(STATUS_LABEL.published)).toBeInTheDocument();
  expect(screen.getByText("פשטידה")).toBeInTheDocument();
});

test("unmount removes the channel", () => {
  h.getRecipe.mockResolvedValue({ status: "queued", title: null });
  const { unmount } = card();
  unmount();
  expect(h.removeChannel).toHaveBeenCalledTimes(1);
});
