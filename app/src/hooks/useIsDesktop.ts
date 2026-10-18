import { useSyncExternalStore } from "react";

/** Laptop/desktop layout from 900px (the `desk:` Tailwind breakpoint); phones and small tablets keep the app layout. */
export const DESKTOP_QUERY = "(min-width: 900px)";

const media = () => (typeof matchMedia === "function" ? matchMedia(DESKTOP_QUERY) : null);

function subscribe(onChange: () => void) {
  const mq = media();
  mq?.addEventListener("change", onChange);
  return () => mq?.removeEventListener("change", onChange);
}

export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, () => media()?.matches ?? false, () => false);
}
