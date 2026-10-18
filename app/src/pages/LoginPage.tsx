import { type FormEvent, useEffect, useState } from "react";
import { Navigate } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { APP_NAME } from "../lib/app";
import { MEMBERS_ONLY, takeAuthError } from "../lib/auth-error";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const { session, member } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // An OAuth redirect error captured at startup (see capture-auth-error.ts): show it once.
  useEffect(() => {
    const m = takeAuthError();
    if (m) setError(m);
  }, []);

  if (session && member) return <Navigate to="/" replace />;

  async function sendLink(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (!error) return setSent(true);
    setError(error.status === 403 || error.status === 422
      ? MEMBERS_ONLY
      : "לא הצלחנו לשלוח קישור. נסו שוב בעוד רגע.");
  }

  return (
    <main className="flex min-h-full flex-col justify-center gap-6 px-6 py-10">
      <div className="flex flex-col items-center gap-3">
        <img src="/pwa-192x192.png" alt="" className="size-20 rounded-[22px] shadow-lg" />
        <h1 className="text-[28px] font-extrabold tracking-tight">{APP_NAME}</h1>
      </div>
      {sent
        ? <p className="card rounded-2xl p-4 text-center">שלחנו קישור כניסה ל-{email}. פתחו אותו מהטלפון הזה.</p>
        : (
          <form onSubmit={sendLink} className="flex flex-col gap-2">
            <label htmlFor="email" className="px-1 text-[13px] text-muted">אימייל</label>
            <input id="email" type="email" required autoComplete="email" dir="ltr" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="card min-h-12 rounded-xl px-4 outline-none" />
            <button disabled={busy} className="pressable mt-2 min-h-12 rounded-[14px] bg-accent font-bold text-on-accent disabled:opacity-60">
              שלחו לי קישור כניסה
            </button>
          </form>
        )}
      {error && <p role="alert" className="text-center text-[14px] text-danger">{error}</p>}
      <div className="flex items-center gap-3 text-[13px] text-muted"><hr className="flex-1 border-line" />או<hr className="flex-1 border-line" /></div>
      <button
        className="pressable card min-h-12 rounded-[14px] font-semibold"
        onClick={async () => {
          setError(null);
          const { error: oErr } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: window.location.origin },
          });
          if (oErr) setError("הכניסה עם Google נכשלה");
        }}
      >
        כניסה עם Google
      </button>
    </main>
  );
}
