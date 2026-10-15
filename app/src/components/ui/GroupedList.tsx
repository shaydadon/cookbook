import type { ReactNode } from "react";

export function GroupedList({ header, children }: { header?: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      {header && <h3 className="mb-1.5 px-4 text-[13px] text-muted">{header}</h3>}
      <div className="card divide-y divide-line overflow-hidden rounded-xl">{children}</div>
    </section>
  );
}

export function ListRow({ children, onClick, danger = false }: { children: ReactNode; onClick?(): void; danger?: boolean }) {
  const cls = `flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2.5 text-start text-[15px] ${danger ? "justify-center text-danger" : ""}`;
  return onClick
    ? <button type="button" onClick={onClick} className={`pressable ${cls}`}>{children}</button>
    : <div className={cls}>{children}</div>;
}
