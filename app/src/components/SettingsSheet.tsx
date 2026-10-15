import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { getPushSubscription, pushSupported, subscribePush, unsubscribePush } from "../lib/push";
import { useTheme } from "../theme/ThemeProvider";
import type { ThemePref } from "../theme/theme";
import { GroupedList, ListRow } from "./ui/GroupedList";
import { Segmented } from "./ui/Segmented";
import { Sheet } from "./ui/Sheet";

const THEMES: { value: ThemePref; label: string }[] = [
  { value: "system", label: "מערכת" },
  { value: "light", label: "בהיר" },
  { value: "dark", label: "כהה" },
];

export function SettingsSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  const { member, session, signOut } = useAuth();
  const { pref, setPref } = useTheme();
  const supported = pushSupported() && !!import.meta.env.VITE_VAPID_PUBLIC_KEY;
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !supported) return;
    getPushSubscription().then((s) => setSubscribed(!!s && Notification.permission === "granted")).catch(() => {});
  }, [open, supported]);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      if (subscribed) {
        await unsubscribePush();
        setSubscribed(false);
      } else {
        const p = await Notification.requestPermission();
        if (p !== "granted") throw new Error("denied");
        await subscribePush(import.meta.env.VITE_VAPID_PUBLIC_KEY);
        setSubscribed(true);
      }
    } catch {
      setError("לא הצלחנו לעדכן את ההתראות");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="הגדרות"
      trailing={<button type="button" onClick={onClose} className="min-h-11 px-1 font-semibold text-accent">סיום</button>}>
      <GroupedList>
        <ListRow>
          <span className="font-medium">{member?.display_name}</span>
          <span dir="ltr" className="truncate text-[13px] text-muted">{session?.user.email}</span>
        </ListRow>
      </GroupedList>
      <GroupedList header="מראה">
        <div className="p-2"><Segmented label="מראה" options={THEMES} value={pref} onChange={setPref} /></div>
      </GroupedList>
      <GroupedList header="התראות">
        {supported ? (
          <ListRow>
            <span>התראה על מתכון חדש</span>
            <button type="button" role="switch" aria-checked={subscribed} aria-label="התראה על מתכון חדש"
              disabled={busy} onClick={toggle}
              className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition ${subscribed ? "bg-success" : "bg-fill"} disabled:opacity-60`}>
              <span className={`absolute top-0.5 size-[27px] rounded-full bg-surface shadow transition-all ${subscribed ? "start-0.5" : "start-[22px]"}`} />
            </button>
          </ListRow>
        ) : (
          <ListRow><span className="text-muted">התראות לא נתמכות בדפדפן הזה</span></ListRow>
        )}
      </GroupedList>
      {error && <p role="alert" className="-mt-3 mb-4 px-4 text-[13px] text-danger">{error}</p>}
      <GroupedList>
        <ListRow danger onClick={() => { void signOut(); }}>התנתקות</ListRow>
      </GroupedList>
    </Sheet>
  );
}
