import { useState } from "react";
import { isStandalone, shouldShowIosInstallHint } from "../lib/push";

export function IosInstallHint() {
  const [show, setShow] = useState(() => {
    try { if (localStorage.getItem("ios-hint-dismissed") === "1") return false; } catch { /* ignore */ }
    return shouldShowIosInstallHint(navigator.userAgent, isStandalone());
  });
  if (!show) return null;
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm">
      <p className="flex-1 text-sm">
        באייפון: לחצו על כפתור השיתוף ⬆️ ואז "הוספה למסך הבית" — כך האפליקציה תיפתח במסך מלא ותוכל לשלוח התראות.
      </p>
      <button aria-label="סגירה" className="size-11" onClick={() => {
        try { localStorage.setItem("ios-hint-dismissed", "1"); } catch { /* ignore */ }
        setShow(false);
      }}>✕</button>
    </div>
  );
}
