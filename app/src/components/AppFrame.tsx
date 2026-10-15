import type { ReactNode } from "react";

/**
 * The app's only scroll container. `transform` makes it the containing block for every
 * `position: fixed` descendant (tab bar, sheets, cooking mode), which keeps them inside the
 * phone-width column on desktop.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <div id="app-scroll"
      className="relative mx-auto h-dvh w-full max-w-[430px] overflow-y-auto overscroll-contain bg-bg text-ink [transform:translateZ(0)] min-[600px]:my-4 min-[600px]:h-[calc(100dvh-2rem)] min-[600px]:rounded-3xl min-[600px]:shadow-2xl">
      {children}
    </div>
  );
}
