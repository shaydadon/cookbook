import { SearchIcon } from "./ui/icons";

export function SearchBar({ value, onChange }: { value: string; onChange(v: string): void }) {
  return (
    <label className="flex h-10 items-center gap-2 rounded-[10px] bg-fill px-3 text-muted">
      <SearchIcon className="size-[18px] shrink-0" />
      <input type="search" inputMode="search" placeholder="חיפוש מתכון או מרכיב…" aria-label="חיפוש"
        value={value} onChange={(e) => onChange(e.target.value)}
        className="h-full w-full bg-transparent text-ink outline-none placeholder:text-muted" />
    </label>
  );
}
