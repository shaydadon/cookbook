import { type ReactNode, useEffect, useId, useRef } from "react";

export function Sheet({ open, onClose, title, children, leading, trailing }: {
  open: boolean; onClose(): void; title: string; children: ReactNode; leading?: ReactNode; trailing?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>("input, textarea, select, button, [href]");
    (first ?? panel.current)?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <div data-testid="sheet-backdrop" className="sheet-backdrop absolute inset-0 bg-black/35" onClick={() => closeRef.current()} />
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className="sheet-panel relative max-h-[92%] overflow-y-auto rounded-t-2xl bg-bg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 text-ink outline-none">
        <div className="mx-auto mb-3 h-[5px] w-9 rounded-full bg-muted/40" aria-hidden="true" />
        <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center">
          <div className="justify-self-start">{leading}</div>
          <h2 id={titleId} className="text-[17px] font-semibold">{title}</h2>
          <div className="justify-self-end">{trailing}</div>
        </div>
        {children}
      </div>
    </div>
  );
}
