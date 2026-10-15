import type { ReactNode } from "react";

export function IconButton({ label, onClick, children, className = "" }: {
  label: string; onClick(): void; children: ReactNode; className?: string;
}) {
  return (
    <button type="button" aria-label={label} onClick={onClick}
      className={`pressable frost grid size-11 place-items-center rounded-full text-ink ${className}`}>
      {children}
    </button>
  );
}
