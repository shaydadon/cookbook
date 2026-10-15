import { Link } from "react-router";
import { formatMinutes, imageUrl, totalMinutes } from "../lib/recipes";
import type { Recipe } from "../lib/types";
import { FavoriteButton } from "./FavoriteButton";

export function RecipeCard({ recipe, isFavorite, onToggleFavorite }: {
  recipe: Recipe; isFavorite: boolean; onToggleFavorite(): void;
}) {
  const img = imageUrl(recipe.image_path);
  const total = totalMinutes(recipe);
  const caption = [recipe.category, total ? formatMinutes(total) : null].filter(Boolean).join(" · ");
  return (
    // The favourite button is a sibling of the link (no interactive element nested inside <a>).
    <div className="card pressable relative overflow-hidden rounded-2xl">
      <Link to={`/recipe/${recipe.id}`} className="block">
        <div className="aspect-square bg-accent-soft">
          {img
            ? <img src={img} alt="" crossOrigin="anonymous" loading="lazy" className="size-full object-cover" />
            : <div data-testid="card-placeholder" className="grid size-full place-items-center text-5xl" aria-hidden>🍽️</div>}
        </div>
        <div className="px-2.5 pb-2.5 pt-2">
          <h2 className="line-clamp-2 text-[13px] font-semibold leading-snug">{recipe.title}</h2>
          {caption && <p className="mt-0.5 text-[11.5px] text-muted">{caption}</p>}
        </div>
      </Link>
      <div className="absolute end-2 top-2">
        <FavoriteButton active={isFavorite} onClick={onToggleFavorite} />
      </div>
    </div>
  );
}
