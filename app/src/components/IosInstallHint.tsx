import { useState } from "react";
import { isStandalone, shouldShowIosInstallHint } from "../lib/push";
import { IconButton } from "./ui/IconButton";
import { CloseIcon } from "./ui/icons";

export function IosInstallHint() {
  const [show, setShow] = useState(() => {
    try { if (localStorage.getItem("ios-hint-dismissed") === "1") return false; } catch { /* ignore */ }
    return shouldShowIosInstallHint(navigator.userAgent, isStandalone(), navigator.maxTouchPoints);
  });
  if (!show) return null;
  return (
    <div className="card flex items-start gap-3 rounded-2xl p-4">
      <p className="flex-1 text-sm">
        באייפון: לחצו על כפתור השיתוף ⬆️ ואז "הוספה למסך הבית" — כך האפליקציה תיפתח במסך מלא ותוכל לשלוח התראות.
      </p>
      <IconButton label="סגירה" onClick={() => {
        try { localStorage.setItem("ios-hint-dismissed", "1"); } catch { /* ignore */ }
        setShow(false);
      }}><CloseIcon className="size-4" /></IconButton>
    </div>
  );
}
