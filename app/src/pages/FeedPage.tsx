import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { CategoryChips } from "../components/CategoryChips";
import { IosInstallHint } from "../components/IosInstallHint";
import { PushPrompt } from "../components/PushPrompt";
import { RecipeCard } from "../components/RecipeCard";
import { SearchBar } from "../components/SearchBar";
import { useDebounced } from "../hooks/useDebounced";
import { useFavorites } from "../hooks/useFavorites";
import { listRecipes, PAGE_SIZE } from "../lib/recipes";

export default function FeedPage({ favoritesOnly = false }: { favoritesOnly?: boolean }) {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const category = params.get("cat");
  const debouncedQ = useDebounced(q, 300);
  const favorites = useFavorites();

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

  const empty = favoritesOnly ? "עוד לא סימנת מתכונים כמועדפים" : "עוד אין כאן מתכונים";

  return (
    <div className="flex flex-col gap-3 pt-2">
      <h1 className="sr-only">{favoritesOnly ? "המועדפים שלי" : "המתכונים"}</h1>
      {!favoritesOnly && <IosInstallHint />}
      {!favoritesOnly && <PushPrompt />}
      <SearchBar value={q} onChange={(v) => update("q", v || null)} />
      <CategoryChips value={category} onChange={(v) => update("cat", v)} />
      {query.isPending && <p role="status" className="py-8 text-center text-muted">טוען…</p>}
      {query.isError && (
        <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center text-red-700">
          <p>{navigator.onLine ? "לא הצלחנו לטעון מתכונים." : "אין חיבור לאינטרנט"}</p>
          <button type="button" onClick={() => query.refetch()} className="min-h-11 rounded-full bg-accent px-6 font-medium text-white">
            נסו שוב
          </button>
        </div>
      )}
      {query.isSuccess && !query.isPlaceholderData && recipes.length === 0 && <p className="py-12 text-center text-muted">{empty}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {recipes.map((r) => (
          <RecipeCard key={r.id} recipe={r} isFavorite={favorites.ids.has(r.id)} onToggleFavorite={() => favorites.toggle(r.id)} />
        ))}
      </div>
      <div ref={sentinel} />
      {query.hasNextPage && (
        <button className="mx-auto min-h-11 rounded-full border border-line px-5" onClick={() => query.fetchNextPage()}>
          טען עוד
        </button>
      )}
    </div>
  );
}
