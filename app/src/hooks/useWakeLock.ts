import { useEffect } from "react";

// Local minimal typing so this hook does not depend on the DOM lib version.
type Sentinel = { release(): Promise<void> };
type WakeLockApi = { request(type: "screen"): Promise<Sentinel> };

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    const wakeLock = (navigator as Navigator & { wakeLock: WakeLockApi }).wakeLock;
    let sentinel: Sentinel | null = null;
    let disposed = false;

    const acquire = async () => {
      try {
        const s = await wakeLock.request("screen");
        if (disposed) await s.release();
        else sentinel = s;
      } catch {
        // unsupported, battery saver or page not visible: cooking mode still works
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") acquire();
    };

    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisible);
      sentinel?.release().catch(() => {});
    };
  }, [active]);
}
