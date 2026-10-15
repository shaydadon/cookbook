import { CATEGORIES } from "../lib/categories";

export function CategoryChips({ value, onChange }: { value: string | null; onChange(v: string | null): void }) {
  const chip = (active: boolean) =>
    `min-h-10 shrink-0 rounded-full border px-4 text-sm ${active ? "border-accent bg-accent text-white" : "border-line bg-white"}`;
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
