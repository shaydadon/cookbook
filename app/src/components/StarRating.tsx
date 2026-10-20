/** My personal 1-5 rating. Tapping the current star again clears it. */
export function StarRating({ value, onChange }: { value: number | null; onChange(stars: number | null): void }) {
  return (
    <div role="group" aria-label="הדירוג שלך" className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value !== null && n <= value;
        return (
          <button key={n} type="button" aria-label={`${n} כוכבים`} aria-pressed={value === n}
            onClick={() => onChange(value === n ? null : n)}
            className={`pressable grid size-10 place-items-center text-[26px] leading-none ${filled ? "text-accent" : "text-muted/50"}`}>
            {filled ? "★" : "☆"}
          </button>
        );
      })}
      <span className="ms-1 text-[12.5px] text-muted">{value ? "הדירוג שלך" : "דרגו את המתכון"}</span>
    </div>
  );
}
