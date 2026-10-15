import { CATEGORIES } from "../lib/categories";

export function CategoryChips({ value, onChange }: { value: string | null; onChange(v: string | null): void }) {
  const chip = (active: boolean) =>
    `pressable min-h-11 shrink-0 rounded-full px-4 text-[13px] font-medium ${active ? "bg-accent text-on-accent" : "card"}`;
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      <button type="button" className={chip(value === null)} aria-pressed={value === null} onClick={() => onChange(null)}>הכל</button>
      {CATEGORIES.map((c) => (
        <button key={c} type="button" className={chip(value === c)} aria-pressed={value === c}
          onClick={() => onChange(value === c ? null : c)}>{c}</button>
      ))}
    </div>
  );
}
