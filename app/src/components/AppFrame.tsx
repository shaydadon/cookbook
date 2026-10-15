import type { ReactNode } from "react";

/**
 * Phone-width app frame. The outer element carries the `transform`, which makes it the containing
 * block for every `position: fixed` descendant (tab bar, sheets, cooking mode) so they stay inside
 * the column on desktop. It must not scroll itself, or fixed children would scroll with the content;
 * the inner `#app-scroll` is the app's only scroll container.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto h-dvh w-full max-w-[430px] overflow-hidden bg-bg text-ink [transform:translateZ(0)] min-[600px]:my-4 min-[600px]:h-[calc(100dvh-2rem)] min-[600px]:rounded-3xl min-[600px]:shadow-2xl">
      <div id="app-scroll" className="h-full overflow-y-auto overscroll-contain">
        {children}
      </div>
    </div>
  );
}
