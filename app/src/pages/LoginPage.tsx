import { type FormEvent, useState } from "react";
import { Navigate } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { APP_NAME } from "../lib/app";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const { session, member } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      ? "הגישה מותרת לחברי הקבוצה בלבד"
      : "לא הצלחנו לשלוח קישור. נסו שוב בעוד רגע.");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-center text-3xl font-bold">{APP_NAME}</h1>
      {sent
        ? <p className="rounded-2xl bg-accent-soft p-4 text-center">שלחנו קישור כניסה ל-{email}. פתחו אותו מהטלפון הזה.</p>
        : (
          <form onSubmit={sendLink} className="flex flex-col gap-3">
            <label htmlFor="email" className="font-medium">אימייל</label>
            <input id="email" type="email" required autoComplete="email" dir="ltr" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-12 rounded-xl border border-line bg-white px-4" />
            <button disabled={busy} className="min-h-12 rounded-full bg-accent font-medium text-white disabled:opacity-60">
              שלחו לי קישור כניסה
            </button>
          </form>
        )}
      {error && <p role="alert" className="text-center text-red-700">{error}</p>}
      <div className="flex items-center gap-3 text-muted"><hr className="flex-1 border-line" />או<hr className="flex-1 border-line" /></div>
      <button
        className="min-h-12 rounded-full border border-line bg-white font-medium"
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
