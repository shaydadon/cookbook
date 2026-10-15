import { expect, test, vi } from "vitest";
import { runImport } from "./import";

test("loops through pages until next_offset is null and sums counts", async () => {
  const invoke = vi.fn()
    .mockResolvedValueOnce({ total: 250, next_offset: 100, created: 90, duplicates: 10 })
    .mockResolvedValueOnce({ total: 250, next_offset: 200, created: 95, duplicates: 5 })
    .mockResolvedValueOnce({ total: 250, next_offset: null, created: 50, duplicates: 0 });
  const progress = vi.fn();
  const result = await runImport("TXT", invoke, progress);
  expect(invoke.mock.calls.map((c) => c[0].offset)).toEqual([0, 100, 200]);
  expect(result).toEqual({ total: 250, created: 235, duplicates: 15 });
  expect(progress).toHaveBeenLastCalledWith({ done: 250, total: 250, created: 235, duplicates: 15 });
});

test("empty export finishes in one call", async () => {
  const invoke = vi.fn().mockResolvedValue({ total: 0, next_offset: null, created: 0, duplicates: 0 });
  expect(await runImport("", invoke, () => {})).toEqual({ total: 0, created: 0, duplicates: 0 });
});
