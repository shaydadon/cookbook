import { useState } from "react";
import { pushSupported, subscribePush } from "../lib/push";

const KEY = "push-prompt-dismissed";

function readDismissed(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

export function PushPrompt() {
  const [hidden, setHidden] = useState(
    () => readDismissed() || !pushSupported() || Notification.permission !== "default" || !import.meta.env.VITE_VAPID_PUBLIC_KEY,
  );
  const [error, setError] = useState(false);
  if (hidden) return null;

  const dismiss = () => {
    try { localStorage.setItem(KEY, "1"); } catch { /* private mode */ }
    setHidden(true);
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-accent-soft p-4">
      <p className="font-medium">לקבל התראה כשמתכון חדש מגיע?</p>
      <div className="flex gap-2">
        <button className="min-h-11 flex-1 rounded-full bg-accent text-white" onClick={async () => {
          const permission = await Notification.requestPermission();
          if (permission === "granted") {
            try { await subscribePush(import.meta.env.VITE_VAPID_PUBLIC_KEY); } catch { return setError(true); }
          }
          dismiss();
        }}>כן, תודיעו לי</button>
        <button className="min-h-11 rounded-full border border-line bg-white px-4" onClick={dismiss}>לא עכשיו</button>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">ההרשמה להתראות נכשלה.</p>}
    </div>
  );
}
