import { HeartIcon } from "./ui/icons";

export function FavoriteButton({ active, onClick }: { active: boolean; onClick(): void }) {
  return (
    <button type="button" aria-pressed={active} aria-label={active ? "הסרה מהמועדפים" : "הוספה למועדפים"}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      className="pressable grid size-11 place-items-center">
      <span className={`frost grid size-8 place-items-center rounded-full ${active ? "text-accent" : "text-ink"}`}>
        <HeartIcon className="size-[18px]" filled={active} />
      </span>
    </button>
  );
}
