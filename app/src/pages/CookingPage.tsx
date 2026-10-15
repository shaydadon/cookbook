import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import { CookingMode } from "../components/CookingMode";
import { getRecipe } from "../lib/recipes";

// Cooking mode is always dark, so its loading/error states are too (no light flash before the steps).
function Dark({ children }: { children: ReactNode }) {
  return <div data-theme="dark" className="fixed inset-0 z-50 grid place-items-center bg-bg p-8 text-center text-ink">{children}</div>;
}

export default function CookingPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const recipe = useQuery({ queryKey: ["recipe", id], queryFn: () => getRecipe(id) });

  if (recipe.isPending) return <Dark><p role="status" className="text-muted">טוען…</p></Dark>;
  if (recipe.isError) {
    if ((recipe.error as { code?: string } | null)?.code === "PGRST116") {
      return <Dark><p role="alert" className="text-muted">המתכון לא נמצא.</p></Dark>;
    }
    return (
      <Dark>
        <div role="alert" className="flex flex-col items-center gap-3">
          <p className="text-muted">לא הצלחנו לטעון את המתכון</p>
          <button type="button" onClick={() => recipe.refetch()} className="pressable min-h-11 rounded-xl bg-accent px-6 font-semibold text-on-accent">
            נסו שוב
          </button>
        </div>
      </Dark>
    );
  }
  const data = recipe.data;
  if (data.steps.length === 0) return <Dark><p role="alert">אין שלבים למתכון הזה.</p></Dark>;
  // Back when we came from inside the app (keeps scroll and history clean); otherwise (opened directly,
  // e.g. from a notification) replace this entry with the recipe page.
  const exit = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(`/recipe/${id}`, { replace: true });
  };
  return <CookingMode title={data.title ?? ""} steps={data.steps} ingredients={data.ingredients} onExit={exit} />;
}
