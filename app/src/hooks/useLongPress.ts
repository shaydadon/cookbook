import { type PointerEvent, useEffect, useRef } from "react";

const MOVE_TOLERANCE_PX = 10; // a finger drifting more than this is scrolling, not holding

/**
 * Press-and-hold detection for touch, pen and mouse. Fires `onLongPress` after `ms` of holding still;
 * releasing early, moving (scrolling) or leaving cancels it. Pass `null` to disable.
 */
export function useLongPress(onLongPress: (() => void) | null, ms = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };
  useEffect(() => cancel, []);

  if (!onLongPress) return {};
  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.button > 0) return; // primary button / touch only
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        cancel();
        navigator.vibrate?.(15);
        onLongPress();
      }, ms);
    },
    onPointerMove: (e: PointerEvent) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > MOVE_TOLERANCE_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    // Long-pressing a link on a phone would open the browser's link menu instead.
    onContextMenu: (e: PointerEvent | React.MouseEvent) => e.preventDefault(),
  };
}
