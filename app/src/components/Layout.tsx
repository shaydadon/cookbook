import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { CATEGORIES } from "../lib/categories";
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
  const isDesktop = useIsDesktop();

  useEffect(() => {
    const el = document.getElementById("app-scroll");
    if (!el) return;
    const onScroll = () => setCollapsed(el.scrollTop > 40);
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [pathname]);

  // Each page starts at the top. /add is a sheet over the feed, so opening or closing it keeps the feed position.
  const prevPath = useRef(pathname);
  useEffect(() => {
    const from = prevPath.current;
    prevPath.current = pathname;
    if (from === pathname || from === "/add" || pathname === "/add") return;
    document.getElementById("app-scroll")?.scrollTo?.({ top: 0 });
  }, [pathname]);

  const initial = member?.display_name?.trim().charAt(0) || "?";
  const settings = <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />;

  if (isDesktop) {
    return (
      <div className="flex min-h-full">
        <Sidebar isAdmin={member?.role === "admin"} initial={initial} name={member?.display_name ?? ""}
          onOpenSettings={() => setSettingsOpen(true)} />
        <div className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1200px] px-8">
            {title && (
              <header className="pb-3 pt-8">
                <h1 className="text-[32px] font-extrabold leading-tight tracking-tight">{title}</h1>
              </header>
            )}
            <main key={pathname} className={`page-in pb-16 ${title ? "" : "pt-6"}`}>
              <Outlet />
            </main>
          </div>
        </div>
        {settings}
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      {title && (
        <>
          <div aria-hidden={!collapsed}
            className={`frost sticky top-0 z-20 flex h-[calc(2.75rem+env(safe-area-inset-top))] items-center justify-center border-b border-line pt-[env(safe-area-inset-top)] text-[17px] font-semibold transition-opacity ${collapsed ? "opacity-100" : "pointer-events-none opacity-0"}`}>
            {title}
          </div>
          <header className="-mt-[calc(2.75rem+env(safe-area-inset-top))] flex items-end justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top)+3rem)]">
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
      {settings}
    </div>
  );
}

const sideItem = (active: boolean) =>
  `pressable flex min-h-10 items-center gap-3 rounded-[10px] px-3 text-[15px] font-medium ${active ? "bg-accent-soft text-accent" : "text-ink hover:bg-fill"}`;

/** Desktop navigation: the phone tab bar's destinations, the feed categories (as `/?cat=` links) and settings. */
function Sidebar({ isAdmin, initial, name, onOpenSettings }: {
  isAdmin: boolean; initial: string; name: string; onOpenSettings(): void;
}) {
  const { pathname, search } = useLocation();
  const cat = pathname === "/" ? new URLSearchParams(search).get("cat") : null;
  const stars = pathname === "/" ? new URLSearchParams(search).get("stars") : null;
  const item = (to: string, label: string, icon: ReactNode, active: boolean) => (
    <Link to={to} aria-current={active ? "page" : undefined} className={sideItem(active)}>{icon}{label}</Link>
  );
  return (
    <nav aria-label="ניווט ראשי"
      className="frost sticky top-0 flex h-dvh w-60 shrink-0 flex-col gap-1 overflow-y-auto border-e border-line px-3 py-6">
      <p className="mb-4 flex items-center gap-2 px-3 text-[17px] font-extrabold">
        <img src="/pwa-64x64.png" alt="" className="size-7 rounded-lg" />המתכונים שלנו
      </p>
      {item("/", "בית", <HomeIcon className="size-5" />, pathname === "/" && !cat && !stars)}
      {item("/favorites", "מועדפים", <HeartIcon className="size-5" />, pathname === "/favorites")}
      {item("/add", "הוספה", <PlusCircleIcon className="size-5" />, pathname === "/add")}
      {isAdmin && item("/admin", "ניהול", <ShieldIcon className="size-5" />, pathname === "/admin")}
      <p className="mb-1 mt-6 px-3 text-[12px] font-semibold text-muted">קטגוריות</p>
      {CATEGORIES.map((c) => (
        <Link key={c} to={`/?cat=${encodeURIComponent(c)}`} aria-current={cat === c ? "page" : undefined}
          className={`${sideItem(cat === c)} min-h-9 text-[14px]`}>{c}</Link>
      ))}
      <p className="mb-1 mt-6 px-3 text-[12px] font-semibold text-muted">הדירוג שלי</p>
      {[5, 4, 3].map((n) => (
        <Link key={n} to={`/?stars=${n}`} aria-current={stars === String(n) ? "page" : undefined}
          className={`${sideItem(stars === String(n))} min-h-9 text-[14px]`}>{n === 5 ? "★5" : `★${n} ומעלה`}</Link>
      ))}
      <button type="button" aria-label="הגדרות" onClick={onOpenSettings}
        className="pressable mt-auto flex min-h-11 items-center gap-3 rounded-[10px] px-3 pt-2 text-start hover:bg-fill">
        <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-on-accent">{initial}</span>
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-semibold">{name}</span>
          <span className="block text-[12px] text-muted">הגדרות</span>
        </span>
      </button>
    </nav>
  );
}
