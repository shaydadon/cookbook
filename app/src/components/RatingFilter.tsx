const OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "כל הדירוגים" },
  { value: 3, label: "★3 ומעלה" },
  { value: 4, label: "★4 ומעלה" },
  { value: 5, label: "★5" },
];

/** Filter the feed by my own star ratings (phones; the desktop sidebar has the same links). */
export function RatingFilter({ value, onChange }: { value: number | null; onChange(v: number | null): void }) {
  const chip = (active: boolean) =>
    `pressable min-h-9 shrink-0 rounded-full px-3.5 text-[12.5px] font-medium ${active ? "bg-accent text-on-accent" : "bg-fill"}`;
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      {OPTIONS.map((o) => (
        <button key={o.label} type="button" aria-pressed={value === o.value} className={chip(value === o.value)}
          onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}
