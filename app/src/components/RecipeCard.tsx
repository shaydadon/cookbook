import { Link } from "react-router";
import { useLongPress } from "../hooks/useLongPress";
import { formatMinutes, imageUrl, totalMinutes } from "../lib/recipes";
import type { Recipe } from "../lib/types";
import { FavoriteButton } from "./FavoriteButton";
import { CloseIcon } from "./ui/icons";

/**
 * Feed card. Admins can long-press to enter edit mode (`onLongPress`); in edit mode (`editing`) the card
 * jiggles like an iPhone icon, shows a delete ✕ (`onDelete`) and no longer opens the recipe.
 */
export function RecipeCard({ recipe, isFavorite, onToggleFavorite, editing = false, onLongPress, onDelete, index = 0 }: {
  recipe: Recipe; isFavorite: boolean; onToggleFavorite(): void;
  editing?: boolean; onLongPress?: () => void; onDelete?: () => void; index?: number;
}) {
  const img = imageUrl(recipe.image_path);
  const total = totalMinutes(recipe);
  const caption = [recipe.category, total ? formatMinutes(total) : null].filter(Boolean).join(" · ");
  const press = useLongPress(onLongPress && !editing ? onLongPress : null);
  return (
    // The favourite and delete buttons are siblings of the link (no interactive element nested inside <a>).
    <div data-recipe-card {...press}
      // Admin cards: holding a finger on the link/image must not open the browser's link menu (Android,
      // iOS), whether or not edit mode is already on.
      onContextMenu={onLongPress ? (e) => e.preventDefault() : undefined}
      // stagger the jiggle so the cards don't move in lockstep
      style={editing ? { animationDelay: `${-(index % 4) * 70}ms` } : undefined}
      className={`card pressable relative select-none rounded-2xl [-webkit-touch-callout:none] ${editing ? "jiggle" : ""}`}>
      <Link to={`/recipe/${recipe.id}`} className="block overflow-hidden rounded-2xl" draggable={false}
        aria-disabled={editing || undefined} tabIndex={editing ? -1 : undefined}
        onClick={editing ? (e) => e.preventDefault() : undefined}>
        <div className="aspect-square bg-accent-soft">
          {img
            ? <img src={img} alt="" crossOrigin="anonymous" loading="lazy" draggable={false} className="size-full object-cover" />
            : <div data-testid="card-placeholder" className="grid size-full place-items-center text-5xl" aria-hidden>🍽️</div>}
        </div>
        <div className="px-2.5 pb-2.5 pt-2">
          <h2 className="line-clamp-2 text-[13px] font-semibold leading-snug">{recipe.title}</h2>
          {caption && <p className="mt-0.5 text-[11.5px] text-muted">{caption}</p>}
        </div>
      </Link>
      {editing && onDelete
        ? (
          <button type="button" aria-label={`מחיקת ${recipe.title}`} onClick={onDelete}
            className="pressable absolute -start-2 -top-2 z-10 grid size-7 place-items-center rounded-full bg-ink/80 text-bg shadow-md">
            <CloseIcon className="size-3.5" />
          </button>
        )
        : (
          <div className="absolute end-2 top-2">
            <FavoriteButton active={isFavorite} onClick={onToggleFavorite} />
          </div>
        )}
    </div>
  );
}
