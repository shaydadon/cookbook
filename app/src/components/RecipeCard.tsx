import { Link } from "react-router";
import { formatMinutes, imageUrl, totalMinutes } from "../lib/recipes";
import type { Recipe } from "../lib/types";
import { FavoriteButton } from "./FavoriteButton";

export function RecipeCard({ recipe, isFavorite, onToggleFavorite }: {
  recipe: Recipe; isFavorite: boolean; onToggleFavorite(): void;
}) {
  const img = imageUrl(recipe.image_path);
  const total = totalMinutes(recipe);
  return (
    // The favourite button is a sibling of the link (no interactive element nested inside <a>).
    <div className="relative overflow-hidden rounded-2xl bg-white shadow-sm">
      <Link to={`/recipe/${recipe.id}`} className="block">
        <div className="aspect-square bg-accent-soft">
          {img
            ? <img src={img} alt="" crossOrigin="anonymous" loading="lazy" className="size-full object-cover" />
            : <div className="grid size-full place-items-center text-5xl" aria-hidden>🍽️</div>}
        </div>
        <div className="p-3">
          <h2 className="line-clamp-2 font-medium leading-snug">{recipe.title}</h2>
          {total && <p className="mt-1 text-sm text-muted">{formatMinutes(total)}</p>}
        </div>
      </Link>
      <div className="absolute end-2 top-2">
        <FavoriteButton active={isFavorite} onClick={onToggleFavorite} />
      </div>
    </div>
  );
}
