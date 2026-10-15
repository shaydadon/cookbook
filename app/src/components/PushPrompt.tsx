import { useEffect, useState } from "react";
import { pushSupported, subscribePush } from "../lib/push";

const KEY = "push-prompt-dismissed";
export const RESUBSCRIBED_KEY = "push-resubscribed";

function readDismissed(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

/** True the first time per browser session; storage failures count as "already done" (never loop). */
function firstResubscribeThisSession(): boolean {
  try {
    if (sessionStorage.getItem(RESUBSCRIBED_KEY) === "1") return false;
    sessionStorage.setItem(RESUBSCRIBED_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

export function PushPrompt() {
  const [hidden, setHidden] = useState(
    () => readDismissed() || !pushSupported() || Notification.permission !== "default" || !import.meta.env.VITE_VAPID_PUBLIC_KEY,
  );
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  // Permission already granted (e.g. earlier session): refresh the subscription silently, at most once per
  // session (the feed remounts often). Never prompts.
  useEffect(() => {
    const key = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (pushSupported() && Notification.permission === "granted" && key && firstResubscribeThisSession()) {
      subscribePush(key).catch(() => { /* ignore */ });
    }
  }, []);

  if (hidden) return null;

  const dismiss = () => {
    try { localStorage.setItem(KEY, "1"); } catch { /* private mode */ }
    setHidden(true);
  };

  const accept = async () => {
    setBusy(true);
    setError(false);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") await subscribePush(import.meta.env.VITE_VAPID_PUBLIC_KEY);
    } catch {
      setError(true);
      setBusy(false);
      return;
    }
    setBusy(false);
    dismiss();
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-accent-soft p-4">
      <p className="font-medium">לקבל התראה כשמתכון חדש מגיע?</p>
      <div className="flex gap-2">
        <button disabled={busy} className="min-h-11 flex-1 rounded-full bg-accent text-on-accent disabled:opacity-60" onClick={accept}>כן, תודיעו לי</button>
        <button className="min-h-11 rounded-full border border-line bg-surface px-4" onClick={dismiss}>לא עכשיו</button>
      </div>
      {error && <p role="alert" className="text-sm text-danger">ההרשמה להתראות נכשלה.</p>}
    </div>
  );
}
