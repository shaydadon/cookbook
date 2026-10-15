export function Segmented<T extends string>({ label, options, value, onChange }: {
  label: string; options: { value: T; label: string }[]; value: T; onChange(v: T): void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-[10px] bg-fill p-0.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className={`min-h-9 flex-1 rounded-lg text-[13px] font-semibold transition ${on ? "bg-surface text-ink shadow-sm" : "text-ink/80"}`}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
