import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { FavoriteButton } from "../components/FavoriteButton";
import { useFavorites } from "../hooks/useFavorites";
import {
  formatAttribution, formatIngredient, formatMinutes, getRecipe, getShares, groupIngredients, imageUrl, totalMinutes,
} from "../lib/recipes";

export default function RecipePage() {
  const { id = "" } = useParams();
  const recipe = useQuery({ queryKey: ["recipe", id], queryFn: () => getRecipe(id) });
  const shares = useQuery({ queryKey: ["shares", id], queryFn: () => getShares(id) });
  const favorites = useFavorites();
  const [checked, setChecked] = useState<Set<number>>(new Set());

  if (recipe.isPending) return <p role="status" className="py-8 text-center text-muted">טוען…</p>;
  if (recipe.isError) {
    if ((recipe.error as { code?: string } | null)?.code === "PGRST116") {
      return <p role="alert" className="py-8 text-center text-red-700">המתכון לא נמצא.</p>;
    }
    return (
      <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center text-red-700">
        <p>לא הצלחנו לטעון את המתכון</p>
        <button type="button" onClick={() => recipe.refetch()} className="min-h-11 rounded-full bg-accent px-6 font-medium text-white">
          נסו שוב
        </button>
      </div>
    );
  }

  const r = recipe.data;
  const img = imageUrl(r.image_path);
  const total = totalMinutes(r);
  let offset = 0;
  const groups = groupIngredients(r.ingredients).map((g) => {
    const start = offset;
    offset += g.items.length;
    return { ...g, start };
  });

  return (
    <article className="flex flex-col gap-5 pt-2">
      <div className="relative -mx-4 aspect-[4/3] bg-accent-soft sm:mx-0 sm:rounded-2xl sm:overflow-hidden">
        {img ? <img src={img} alt="" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-7xl" aria-hidden>🍽️</div>}
        <div className="absolute end-3 top-3">
          <FavoriteButton active={favorites.ids.has(r.id)} onClick={() => favorites.toggle(r.id)} />
        </div>
      </div>

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold leading-tight">{r.title}</h1>
        {r.description && <p className="text-muted">{r.description}</p>}
        <div className="flex flex-wrap gap-2 text-sm">
          {total ? <span className="rounded-full bg-white px-3 py-1">{formatMinutes(total)}</span> : null}
          {r.servings ? <span className="rounded-full bg-white px-3 py-1">{r.servings} מנות</span> : null}
          {r.category && <span className="rounded-full bg-white px-3 py-1">{r.category}</span>}
          {r.tags.map((t) => <span key={t} className="rounded-full bg-accent-soft px-3 py-1">{t}</span>)}
        </div>
      </header>

      <Link to={`/recipe/${r.id}/cook`} className="grid min-h-12 place-items-center rounded-full bg-accent font-medium text-white">
        התחילו לבשל
      </Link>

      <section>
        <h2 className="mb-2 text-lg font-bold">מרכיבים</h2>
        {groups.map((g, gi) => (
          <div key={gi} className="mb-3">
            {g.group && <h3 className="mb-1 font-medium">{g.group}</h3>}
            <ul className="flex flex-col">
              {g.items.map((ing, k) => {
                const i = g.start + k;
                const text = formatIngredient(ing);
                return (
                  <li key={i} className="border-b border-line last:border-0">
                    <label className="flex min-h-11 items-center gap-3">
                      <input type="checkbox" aria-label={text} checked={checked.has(i)} className="size-5 accent-accent"
                        onChange={() => setChecked((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })} />
                      <span className={checked.has(i) ? "text-muted line-through" : ""}>{text}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">אופן ההכנה</h2>
        <ol className="flex list-decimal flex-col gap-3 ps-5">
          {r.steps.map((s, i) => <li key={i}>{s.text}</li>)}
        </ol>
      </section>

      <footer className="border-t border-line pt-3 text-sm text-muted">
        <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="underline">
          {formatAttribution(r, shares.data?.[0] ?? null)}
        </a>
      </footer>
    </article>
  );
}
