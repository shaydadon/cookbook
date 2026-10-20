import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { FavoriteButton } from "../components/FavoriteButton";
import { StarRating } from "../components/StarRating";
import { IconButton } from "../components/ui/IconButton";
import { CheckIcon, ChevronBackIcon, ClockIcon, UsersIcon } from "../components/ui/icons";
import { useFavorites } from "../hooks/useFavorites";
import { useRatings } from "../hooks/useRatings";
import {
  formatAttribution, formatIngredient, formatMinutes, getRecipe, getShares, groupIngredients, imageUrl, totalMinutes,
} from "../lib/recipes";

export default function RecipePage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const recipe = useQuery({ queryKey: ["recipe", id], queryFn: () => getRecipe(id) });
  const shares = useQuery({ queryKey: ["shares", id], queryFn: () => getShares(id) });
  const favorites = useFavorites();
  const ratings = useRatings();
  const [checked, setChecked] = useState<Set<number>>(new Set());

  if (recipe.isPending) return <div role="status" aria-label="טוען" className="h-[40vh] animate-pulse bg-fill" />;
  if (recipe.isError) {
    if ((recipe.error as { code?: string } | null)?.code === "PGRST116") {
      return <p role="alert" className="px-4 py-16 text-center text-muted">המתכון לא נמצא.</p>;
    }
    return (
      <div role="alert" className="flex flex-col items-center gap-3 px-4 py-16 text-center">
        <p className="text-muted">לא הצלחנו לטעון את המתכון</p>
        <button type="button" onClick={() => recipe.refetch()} className="pressable min-h-11 rounded-xl bg-accent px-6 font-semibold text-on-accent">
          נסו שוב
        </button>
      </div>
    );
  }

  const back = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1); else navigate("/", { replace: true });
  };

  const r = recipe.data;
  const img = imageUrl(r.image_path);
  const total = totalMinutes(r);
  let offset = 0;
  const groups = groupIngredients(r.ingredients).map((g) => {
    const start = offset;
    offset += g.items.length;
    return { ...g, start };
  });
  const stats = [
    total ? { icon: <ClockIcon className="size-4" />, value: formatMinutes(total), label: "זמן" } : null,
    r.servings ? { icon: <UsersIcon className="size-4" />, value: String(r.servings), label: "מנות" } : null,
    r.category ? { icon: null, value: r.category, label: "קטגוריה" } : null,
  ].filter(Boolean) as { icon: ReactNode; value: string; label: string }[];

  // Phones: photo, then a content sheet. Desktop: two columns — photo above the ingredients, and the
  // title/details above the method — via grid areas (the sheet wrapper becomes display: contents).
  return (
    <article className="desk:grid desk:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] desk:grid-rows-[auto_auto_1fr] desk:gap-x-10 desk:pb-24 desk:[grid-template-areas:'hero_head'_'hero_steps'_'ingr_steps']">
      <div className="relative h-[40vh] min-h-56 bg-accent-soft desk:h-[380px] desk:overflow-hidden desk:rounded-2xl desk:[grid-area:hero]">
        {img
          ? <img src={img} alt="" crossOrigin="anonymous" className="size-full object-cover" />
          : <div data-testid="hero-placeholder" className="grid size-full place-items-center text-7xl" aria-hidden>🍽️</div>}
        <div className="absolute inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] flex items-start justify-between">
          <IconButton label="חזרה" onClick={back}><ChevronBackIcon className="size-5" /></IconButton>
          <FavoriteButton active={favorites.ids.has(r.id)} onClick={() => favorites.toggle(r.id)} />
        </div>
      </div>

      <div className="relative -mt-6 rounded-t-3xl bg-surface px-4 pb-32 pt-5 desk:contents">
        <div className="desk:[grid-area:head]">
        <h1 className="text-[22px] desk:text-[32px] font-extrabold leading-tight tracking-tight">{r.title}</h1>
        <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="mt-1 block text-[12.5px] text-muted underline-offset-2 hover:underline">
          {formatAttribution(r, shares.data?.[0] ?? null)}
        </a>
        <div className="mt-2 -ms-2">
          <StarRating value={ratings.get(r.id)} onChange={(stars) => ratings.rate(r.id, stars)} />
        </div>
        {r.description && <p className="mt-3 text-[15px] leading-relaxed text-muted">{r.description}</p>}

        {stats.length > 0 && (
          <div className="mt-4 flex gap-2">
            {stats.map((s) => (
              <div key={s.label} className="flex-1 rounded-xl bg-fill px-2 py-2 text-center">
                <div className="flex items-center justify-center gap-1 text-[14px] font-bold">{s.icon}{s.value}</div>
                <div className="text-[10.5px] text-muted">{s.label}</div>
              </div>
            ))}
          </div>
        )}
        {r.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {r.tags.map((t) => <span key={t} className="rounded-full bg-accent-soft px-2.5 py-1 text-[12px] text-accent">{t}</span>)}
          </div>
        )}
        </div>

        <section className="mt-6 desk:[grid-area:ingr]">
          <h2 className="mb-1 text-[17px] font-bold">מרכיבים</h2>
          {groups.map((g, gi) => (
            <div key={gi} className="mb-2">
              {g.group && <h3 className="mt-2 text-[13px] font-semibold text-muted">{g.group}</h3>}
              <ul>
                {g.items.map((ing, k) => {
                  const i = g.start + k;
                  const text = formatIngredient(ing);
                  const on = checked.has(i);
                  return (
                    <li key={i} className="border-b border-line last:border-0">
                      <label className="flex min-h-11 items-center gap-3">
                        <span className="relative grid size-[22px] shrink-0 place-items-center">
                          <input type="checkbox" aria-label={text} checked={on}
                            className="peer size-[22px] appearance-none rounded-full border-2 border-line checked:border-accent checked:bg-accent"
                            onChange={() => setChecked((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })} />
                          <CheckIcon className="pointer-events-none absolute size-3.5 text-on-accent opacity-0 peer-checked:opacity-100" />
                        </span>
                        <span className={`text-[15px] ${on ? "text-muted line-through" : ""}`}>{text}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>

        <section className="mt-5 desk:mt-6 desk:[grid-area:steps]">
          <h2 className="mb-2 text-[17px] font-bold">אופן ההכנה</h2>
          <ol className="flex flex-col gap-3">
            {r.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-relaxed">
                <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[12px] font-bold text-accent">{i + 1}</span>
                <span>{s.text}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <Link to={`/recipe/${r.id}/cook`}
        className="pressable fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] z-20 grid h-[50px] place-items-center rounded-[14px] desk:inset-x-auto desk:bottom-8 desk:left-8 desk:px-10 bg-accent text-[16px] font-bold text-on-accent shadow-[0_8px_20px_rgba(255,149,0,0.35)]">
        התחילו לבשל
      </Link>
    </article>
  );
}
