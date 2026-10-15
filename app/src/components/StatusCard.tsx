import { useEffect, useState } from "react";
import { Link } from "react-router";
import { getRecipe } from "../lib/recipes";
import { STATUS_LABEL } from "../lib/status";
import { supabase } from "../lib/supabase";
import type { RecipeStatus } from "../lib/types";

export function StatusCard({ recipeId, initialStatus, duplicate }: {
  recipeId: string; initialStatus: RecipeStatus; duplicate: boolean;
}) {
  const [status, setStatus] = useState<RecipeStatus>(initialStatus);
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    // Once a Realtime payload has been applied, a slower initial fetch must not overwrite it.
    let realtimeApplied = false;
    let active = true;
    const refetch = () => {
      getRecipe(recipeId)
        .then((r) => {
          if (!active || realtimeApplied) return;
          setStatus(r.status);
          setTitle(r.title);
        })
        .catch(() => {});
    };
    refetch();
    const channel = supabase.channel(`recipe-${recipeId}-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "recipes", filter: `id=eq.${recipeId}` },
        (payload) => {
          const row = payload.new as { status: RecipeStatus; title: string | null };
          realtimeApplied = true;
          setStatus(row.status);
          setTitle(row.title);
        })
      .subscribe((s) => { if (s === "SUBSCRIBED") refetch(); });
    return () => { active = false; supabase.removeChannel(channel); };
  }, [recipeId]);

  const done = status === "published";
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-white p-4 shadow-sm" aria-live="polite">
      {duplicate && <p className="text-sm text-muted">המתכון הזה כבר קיים — רשמנו שגם את/ה שיתפת.</p>}
      <p className="font-medium">{title ?? "מתכון חדש"}</p>
      <p className={done ? "text-green-700" : status === "failed" || status === "needs_review" ? "text-red-700" : "text-muted"}>
        {STATUS_LABEL[status]}
      </p>
      {done && <Link to={`/recipe/${recipeId}`} className="text-accent underline">לצפייה במתכון</Link>}
    </div>
  );
}
