import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { CategoryChips } from "../components/CategoryChips";
import { IosInstallHint } from "../components/IosInstallHint";
import { PushPrompt } from "../components/PushPrompt";
import { RecipeCard } from "../components/RecipeCard";
import { SearchBar } from "../components/SearchBar";
import { Sheet } from "../components/ui/Sheet";
import { SkeletonCard } from "../components/ui/Skeleton";
import { useDebounced } from "../hooks/useDebounced";
import { useFavorites } from "../hooks/useFavorites";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { adminAction, listRecipes, PAGE_SIZE } from "../lib/recipes";
import type { Recipe } from "../lib/types";

const GRID = "grid grid-cols-2 gap-2.5 desk:grid-cols-[repeat(auto-fill,minmax(210px,1fr))] desk:gap-4";

export default function FeedPage({ favoritesOnly = false }: { favoritesOnly?: boolean }) {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const category = params.get("cat");
  const debouncedQ = useDebounced(q, 300);
  const favorites = useFavorites();
  const isDesktop = useIsDesktop();
  const isAdmin = useAuth().member?.role === "admin";
  // Admin edit mode (long-press a card): cards jiggle with a delete ✕, like iPhone home-screen editing.
  const [editing, setEditing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Recipe | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    setParams(next, { replace: true });
  };

  const query = useInfiniteQuery({
    queryKey: ["recipes", debouncedQ, category, favoritesOnly],
    queryFn: ({ pageParam }) => listRecipes({ q: debouncedQ, category, favoritesOnly, page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length === PAGE_SIZE ? all.length : undefined),
    placeholderData: keepPreviousData,
  });
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  const recipes = query.data?.pages.flat() ?? [];

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sentinel.current || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
    }, { rootMargin: "400px" });
    io.observe(sentinel.current);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Edit mode gets its own history entry, so the phone Back gesture leaves edit mode instead of the page.
  const enterEdit = () => {
    setEditing(true);
    window.history.pushState({ ...(window.history.state ?? {}), editMode: true }, "");
  };
  const exitEdit = () => {
    setEditing(false);
    if ((window.history.state as { editMode?: boolean } | null)?.editMode) window.history.back();
  };
  useEffect(() => {
    if (!editing) return;
    const onPop = () => setEditing(false);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [editing]);

  useEffect(() => {
    if (!editing || pendingDelete) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") exitEdit(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [editing, pendingDelete]);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await adminAction({ action: "delete", recipe_id: pendingDelete.id });
      setPendingDelete(null);
      await query.refetch();
    } catch (e) {
      setDeleteError((e as Error).message || "המחיקה נכשלה. נסו שוב.");
    } finally {
      setDeleting(false);
    }
  }

  const empty = favoritesOnly ? "עוד לא סימנת מתכונים כמועדפים" : "עוד אין כאן מתכונים";

  return (
    <div className="flex flex-col gap-3 pt-2">
      {!favoritesOnly && <IosInstallHint />}
      {!favoritesOnly && <PushPrompt />}
      <div className="desk:max-w-md">
        <SearchBar value={q} onChange={(v) => update("q", v || null)} />
      </div>
      {/* on desktop the categories live in the sidebar (as ?cat= links) */}
      {!isDesktop && <CategoryChips value={category} onChange={(v) => update("cat", v)} />}
      {query.isPending && (
        <div role="status" aria-label="טוען" className={GRID}>
          {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}
        </div>
      )}
      {query.isError && (
        <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-muted">{navigator.onLine ? "לא הצלחנו לטעון מתכונים." : "אין חיבור לאינטרנט"}</p>
          <button type="button" onClick={() => query.refetch()} className="pressable min-h-11 rounded-xl bg-accent px-6 font-semibold text-on-accent">
            נסו שוב
          </button>
        </div>
      )}
      {query.isSuccess && !query.isPlaceholderData && recipes.length === 0 && (
        <p className="py-16 text-center text-muted">{empty}</p>
      )}
      {editing && (
        <div className="frost sticky top-[calc(2.75rem+env(safe-area-inset-top))] z-10 -mx-1 flex items-center justify-between rounded-xl px-3 py-2 desk:top-2">
          <p className="text-[13px] text-muted">מצב עריכה · הקישו ✕ כדי למחוק מתכון</p>
          <button type="button" onClick={exitEdit} className="pressable min-h-9 rounded-full bg-accent px-5 font-bold text-on-accent">סיום</button>
        </div>
      )}
      {/* tapping empty space between the cards also leaves edit mode */}
      <div className={GRID} onClick={editing ? (e) => { if (e.target === e.currentTarget) exitEdit(); } : undefined}>
        {recipes.map((r, i) => (
          <RecipeCard key={r.id} recipe={r} index={i} isFavorite={favorites.ids.has(r.id)} onToggleFavorite={() => favorites.toggle(r.id)}
            editing={editing}
            onLongPress={isAdmin ? enterEdit : undefined}
            onExitEdit={exitEdit}
            onDelete={isAdmin ? () => { setDeleteError(null); setPendingDelete(r); } : undefined} />
        ))}
      </div>
      <Sheet open={pendingDelete !== null} onClose={() => { if (!deleting) setPendingDelete(null); }} title="מחיקת מתכון">
        <p className="text-center text-[15px]">
          למחוק את <span className="font-semibold">״{pendingDelete?.title}״</span>? המתכון יימחק לכל חברי הקבוצה ואי אפשר לשחזר אותו.
        </p>
        {deleteError && <p role="alert" className="mt-3 text-center text-[13px] text-danger">{deleteError}</p>}
        <div className="mt-5 flex flex-col gap-2">
          <button type="button" disabled={deleting} onClick={confirmDelete}
            className="pressable min-h-12 rounded-[14px] bg-danger font-bold text-white disabled:opacity-60">מחיקה</button>
          <button type="button" disabled={deleting} onClick={() => setPendingDelete(null)}
            className="pressable min-h-12 rounded-[14px] bg-fill font-semibold">ביטול</button>
        </div>
      </Sheet>
      <div ref={sentinel} />
      {query.hasNextPage && (
        <button className="pressable mx-auto min-h-11 rounded-xl bg-fill px-5 font-medium" onClick={() => query.fetchNextPage()}>
          טען עוד
        </button>
      )}
    </div>
  );
}
