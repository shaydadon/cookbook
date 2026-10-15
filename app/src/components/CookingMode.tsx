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
  const touchX = useRef<number | null>(null);
  useWakeLock(true);

  const last = steps.length - 1;
  const next = () => setI((n) => Math.min(n + 1, last));
  const prev = () => setI((n) => Math.max(n - 1, 0));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setI((n) => Math.min(n + 1, last));
      if (e.key === "ArrowRight") setI((n) => Math.max(n - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last]);

  const step = steps[i];
  const related = relevantIngredients(step, ingredients);

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-paper pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <header className="flex items-center justify-between px-4 py-3">
        <h1 className="line-clamp-1 font-medium">{title}</h1>
        <button onClick={onExit} className="min-h-11 rounded-full border border-line px-4">יציאה</button>
      </header>
      <p className="px-4 text-sm text-muted" aria-live="polite">שלב {i + 1} מתוך {steps.length}</p>
      <div
        data-testid="swipe-area"
        className="flex flex-1 flex-col justify-center gap-6 px-6"
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (dx > 60) next();
          if (dx < -60) prev();
          touchX.current = null;
        }}
      >
        <p className="text-3xl font-medium leading-snug">{step.text}</p>
        {related.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {related.map((r, k) => <li key={k} className="rounded-full bg-accent-soft px-3 py-1">{formatIngredient(r)}</li>)}
          </ul>
        )}
      </div>
      <nav className="flex gap-3 p-4">
        {i < last
          ? <button onClick={next} className="min-h-14 flex-1 rounded-full bg-accent text-lg font-medium text-white">הבא</button>
          : <button onClick={onExit} className="min-h-14 flex-1 rounded-full bg-accent text-lg font-medium text-white">סיימתי</button>}
        <button onClick={prev} disabled={i === 0} className="min-h-14 flex-1 rounded-full border border-line text-lg disabled:opacity-40">הקודם</button>
      </nav>
    </div>
  );
}
