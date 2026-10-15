export function SearchBar({ value, onChange }: { value: string; onChange(v: string): void }) {
  return (
    <input
      type="search"
      inputMode="search"
      placeholder="חיפוש מתכון או מרכיב…"
      aria-label="חיפוש"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-12 w-full rounded-full border border-line bg-white px-5"
    />
  );
}
