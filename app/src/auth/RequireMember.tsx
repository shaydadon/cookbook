import { Navigate, Outlet } from "react-router";
import { useAuth } from "./AuthProvider";

export function RequireMember() {
  const { loading, session, member, error, retry, signOut } = useAuth();
  if (loading) return <div className="p-8 text-center text-muted" role="status">טוען…</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (error) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <h1 className="mb-3 text-xl font-bold">{error}</h1>
        <div className="flex justify-center gap-3">
          <button className="min-h-11 rounded-full bg-accent px-5 text-white" onClick={() => retry()}>נסו שוב</button>
          <button className="min-h-11 rounded-full border border-line px-5" onClick={() => signOut()}>התנתקות</button>
        </div>
      </main>
    );
  }
  if (!member) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <h1 className="mb-3 text-xl font-bold">הגישה מותרת לחברי הקבוצה בלבד</h1>
        <p className="mb-6 text-muted">
          נכנסת עם {session.user.email}. אם זו טעות, בקשו ממנהל הקבוצה להוסיף את הכתובת.
        </p>
        <button className="min-h-11 rounded-full border border-line px-5" onClick={() => signOut()}>התנתקות</button>
      </main>
    );
  }
  return <Outlet />;
}
