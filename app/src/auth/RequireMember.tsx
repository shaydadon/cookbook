import { Navigate, Outlet } from "react-router";
import { useAuth } from "./AuthProvider";

export function RequireMember() {
  const { loading, session, member, error, retry, signOut } = useAuth();
  if (loading) return <div role="status" className="grid min-h-full place-items-center text-muted">טוען…</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (error) {
    return (
      <main className="flex min-h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-[22px] font-bold">{error}</h1>
        <div className="flex justify-center gap-3">
          <button className="pressable min-h-11 rounded-xl bg-accent px-5 font-semibold text-on-accent" onClick={() => retry()}>נסו שוב</button>
          <button className="pressable min-h-11 rounded-xl bg-fill px-5 font-medium" onClick={() => signOut()}>התנתקות</button>
        </div>
      </main>
    );
  }
  if (!member) {
    return (
      <main className="flex min-h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-[22px] font-bold">הגישה מותרת לחברי הקבוצה בלבד</h1>
        <p className="text-muted">
          נכנסת עם {session.user.email}. אם זו טעות, בקשו ממנהל הקבוצה להוסיף את הכתובת.
        </p>
        <button className="pressable min-h-11 rounded-xl bg-fill px-5 font-medium" onClick={() => signOut()}>התנתקות</button>
      </main>
    );
  }
  return <Outlet />;
}
