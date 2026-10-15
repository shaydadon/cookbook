import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { SettingsSheet } from "./SettingsSheet";
import { HeartIcon, HomeIcon, PlusCircleIcon, ShieldIcon } from "./ui/icons";

export function titleFor(pathname: string): string | null {
  if (pathname === "/" || pathname === "/add") return "המתכונים";
  if (pathname === "/favorites") return "מועדפים";
  if (pathname === "/admin") return "ניהול";
  return null;
}

const tab = ({ isActive }: { isActive: boolean }) =>
  `pressable flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${isActive ? "text-accent" : "text-muted"}`;

export function Layout() {
  const { member } = useAuth();
  const { pathname } = useLocation();
  const title = titleFor(pathname);
  const [collapsed, setCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const el = document.getElementById("app-scroll");
    if (!el) return;
    const onScroll = () => setCollapsed(el.scrollTop > 40);
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [pathname]);

  const initial = member?.display_name?.trim().charAt(0) || "?";

  return (
    <div className="flex min-h-full flex-col">
      {title && (
        <>
          <div aria-hidden={!collapsed}
            className={`frost sticky top-0 z-20 flex h-11 items-center justify-center border-b border-line pt-[env(safe-area-inset-top)] text-[17px] font-semibold transition-opacity ${collapsed ? "opacity-100" : "pointer-events-none opacity-0"}`}>
            {title}
          </div>
          <header className="-mt-11 flex items-end justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top)+3rem)]">
            <h1 className="text-[30px] font-extrabold leading-tight tracking-tight">{title}</h1>
            <button type="button" aria-label="הגדרות" onClick={() => setSettingsOpen(true)}
              className="pressable grid size-9 place-items-center rounded-full bg-accent text-sm font-bold text-on-accent">
              {initial}
            </button>
          </header>
        </>
      )}
      <main key={pathname} className={`page-in flex-1 pb-28 ${title ? "px-4" : ""}`}>
        <Outlet />
      </main>
      <nav aria-label="ניווט ראשי"
        className="frost fixed inset-x-0 bottom-0 z-30 flex border-t border-line pb-[env(safe-area-inset-bottom)]">
        <NavLink to="/" end className={tab}><HomeIcon />בית</NavLink>
        <NavLink to="/favorites" className={tab}><HeartIcon />מועדפים</NavLink>
        <NavLink to="/add" className={tab}><PlusCircleIcon />הוספה</NavLink>
        {member?.role === "admin" && <NavLink to="/admin" className={tab}><ShieldIcon />ניהול</NavLink>}
      </nav>
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
