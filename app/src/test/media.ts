import { vi } from "vitest";
import { DESKTOP_QUERY } from "../hooks/useIsDesktop";

/** A controllable matchMedia for the desktop query: `set(v)` flips it and notifies listeners. */
export function stubDesktop(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", (q: string) => ({
    media: q,
    get matches() { return q === DESKTOP_QUERY ? matches : false; },
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
  }));
  return { set(v: boolean) { matches = v; listeners.forEach((l) => l()); } };
}
