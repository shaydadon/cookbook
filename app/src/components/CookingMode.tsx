import { useEffect, useRef, useState } from "react";
import { useWakeLock } from "../hooks/useWakeLock";
import { formatIngredient } from "../lib/recipes";
import type { Ingredient, Step } from "../lib/types";

export function relevantIngredients(step: Step, ingredients: Ingredient[]): Ingredient[] {
  return ingredients.filter((i) => i.name.length > 1 && step.text.includes(i.name));
}

export function CookingMode({ title, steps, ingredients, onExit }: {
  title: string; steps: Step[]; ingredients: Ingredient[]; onExit(): void;
}) {
  const [i, setI] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  useWakeLock(true);

  const last = steps.length - 1;
  const next = () => setI((n) => Math.max(0, Math.min(n + 1, last)));
  const prev = () => setI((n) => Math.max(Math.min(n, last) - 1, 0));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setI((n) => Math.max(0, Math.min(n + 1, last)));
      if (e.key === "ArrowRight") setI((n) => Math.max(Math.min(n, last) - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last]);

  // The steps array can shrink under us (e.g. the recipe was edited and refetched): clamp instead of crashing.
  const idx = Math.max(0, Math.min(i, last));
  const step = steps[idx];
  if (!step) return null;
  const related = relevantIngredients(step, ingredients);

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-paper pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <header className="flex items-center justify-between px-4 py-3">
        <h1 className="line-clamp-1 font-medium">{title}</h1>
        <button onClick={onExit} className="min-h-11 rounded-full border border-line px-4">יציאה</button>
      </header>
      <p className="px-4 text-sm text-muted" aria-live="polite">שלב {idx + 1} מתוך {steps.length}</p>
      <div
        data-testid="swipe-area"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6"
        onTouchStart={(e) => { touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchEnd={(e) => {
          const start = touchStart.current;
          touchStart.current = null;
          if (!start) return;
          const dx = e.changedTouches[0].clientX - start.x;
          const dy = e.changedTouches[0].clientY - start.y;
          if (Math.abs(dy) > Math.abs(dx)) return; // vertical: the member is scrolling a long step
          if (dx > 60) next();
          if (dx < -60) prev();
        }}
      >
        <div className="my-auto flex flex-col gap-6 py-4">
          <p className={`${step.text.length > 160 ? "text-2xl" : "text-3xl"} font-medium leading-snug`}>{step.text}</p>
          {related.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {related.map((r, k) => <li key={k} className="rounded-full bg-accent-soft px-3 py-1">{formatIngredient(r)}</li>)}
            </ul>
          )}
        </div>
      </div>
      <nav className="flex gap-3 p-4">
        {idx < last
          ? <button onClick={next} className="min-h-14 flex-1 rounded-full bg-accent text-lg font-medium text-white">הבא</button>
          : <button onClick={onExit} className="min-h-14 flex-1 rounded-full bg-accent text-lg font-medium text-white">סיימתי</button>}
        <button onClick={prev} disabled={idx === 0} className="min-h-14 flex-1 rounded-full border border-line text-lg disabled:opacity-40">הקודם</button>
      </nav>
    </div>
  );
}
