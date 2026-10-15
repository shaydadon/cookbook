export function FavoriteButton({ active, onClick }: { active: boolean; onClick(): void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? "הסרה מהמועדפים" : "הוספה למועדפים"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className="grid size-11 place-items-center rounded-full bg-white/90 text-xl shadow-sm"
    >
      {active ? "❤️" : "🤍"}
    </button>
  );
}
