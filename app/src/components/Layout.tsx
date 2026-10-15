import { NavLink, Outlet } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { APP_NAME } from "../lib/app";

const tab = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-14 flex-1 flex-col items-center justify-center text-sm ${isActive ? "text-accent font-medium" : "text-muted"}`;

export function Layout() {
  const { member } = useAuth();
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col">
      <header className="sticky top-0 z-10 bg-paper/95 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <h1 className="text-xl font-bold">{APP_NAME}</h1>
      </header>
      <main className="flex-1 px-4 pb-24">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
        <NavLink to="/" end className={tab}>בית</NavLink>
        <NavLink to="/favorites" className={tab}>מועדפים</NavLink>
        <NavLink to="/add" className={tab}>הוספה</NavLink>
        {member?.role === "admin" && <NavLink to="/admin" className={tab}>ניהול</NavLink>}
      </nav>
    </div>
  );
}
