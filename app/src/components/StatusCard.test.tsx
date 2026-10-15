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
    on: (t: string, _f: unknown, fn: Handler) => { if (t === "postgres_changes") h.handler = fn; return channel; },
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

test("the view-recipe link is a 44px tap target", async () => {
  h.getRecipe.mockResolvedValue({ status: "published", title: "עוגה" });
  card();
  const link = await screen.findByRole("link", { name: "לצפייה במתכון" });
  expect(link).toHaveAttribute("href", "/recipe/r1");
  expect(link).toHaveClass("inline-flex", "min-h-11", "items-center");
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

test("polling catches a status change when the channel never delivers payloads", async () => {
  vi.useFakeTimers();
  try {
    h.getRecipe
      .mockResolvedValueOnce({ status: "queued", title: null })
      .mockResolvedValueOnce({ status: "queued", title: null })
      .mockResolvedValue({ status: "published", title: "לזניה" });
    card();
    await act(async () => { h.subCb!("SUBSCRIBED"); });
    expect(screen.queryByText(STATUS_LABEL.published)).not.toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(screen.getByText(STATUS_LABEL.published)).toBeInTheDocument();
    expect(screen.getByText("לזניה")).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

test("a stale fetch resolving after a newer fetch does not overwrite it", async () => {
  let resolveFirst!: (r: { status: string; title: string | null }) => void;
  h.getRecipe
    .mockReturnValueOnce(new Promise((res) => { resolveFirst = res; }))
    .mockResolvedValueOnce({ status: "published", title: "חדש" });
  card();
  await act(async () => { h.subCb!("SUBSCRIBED"); });
  expect(screen.getByText("חדש")).toBeInTheDocument();

  await act(async () => { resolveFirst({ status: "queued", title: "ישן" }); });
  expect(screen.getByText("חדש")).toBeInTheDocument();
  expect(screen.getByText(STATUS_LABEL.published)).toBeInTheDocument();
});

test("polling stops after a terminal status", async () => {
  vi.useFakeTimers();
  try {
    h.getRecipe.mockResolvedValue({ status: "published", title: "פיצה" });
    card();
    await act(async () => {});
    expect(screen.getByText(STATUS_LABEL.published)).toBeInTheDocument();
    const calls = h.getRecipe.mock.calls.length;

    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(h.getRecipe).toHaveBeenCalledTimes(calls);
  } finally {
    vi.useRealTimers();
  }
});

test("unmount removes the channel", () => {
  h.getRecipe.mockResolvedValue({ status: "queued", title: null });
  const { unmount } = card();
  unmount();
  expect(h.removeChannel).toHaveBeenCalledTimes(1);
});
