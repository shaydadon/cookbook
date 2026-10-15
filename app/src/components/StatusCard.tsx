import { useEffect, useState } from "react";
import { Link } from "react-router";
import { getRecipe } from "../lib/recipes";
import { STATUS_LABEL } from "../lib/status";
import { supabase } from "../lib/supabase";
import type { RecipeStatus } from "../lib/types";

const TERMINAL: RecipeStatus[] = ["published", "failed", "needs_review"];
const POLL_MS = 5000;
const POLL_MAX_MS = 3 * 60 * 1000;

export function StatusCard({ recipeId, initialStatus, duplicate }: {
  recipeId: string; initialStatus: RecipeStatus; duplicate: boolean;
}) {
  const [status, setStatus] = useState<RecipeStatus>(initialStatus);
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    // Every fetch and every Realtime payload takes a sequence number; only the newest result is applied.
    let seq = 0;
    let active = true;
    let poll: ReturnType<typeof setInterval> | undefined;
    const stopPoll = () => { if (poll) { clearInterval(poll); poll = undefined; } };
    const apply = (st: RecipeStatus, t: string | null) => {
      setStatus(st);
      setTitle(t);
      if (TERMINAL.includes(st)) stopPoll();
    };
    const refetch = () => {
      const my = ++seq;
      getRecipe(recipeId)
        .then((r) => { if (active && my === seq) apply(r.status, r.title); })
        .catch(() => {});
    };
    refetch();
    // Backstop: Realtime can drop UPDATEs that land before postgres_changes is actually live.
    const startedAt = Date.now();
    poll = setInterval(() => {
      if (Date.now() - startedAt >= POLL_MAX_MS) { stopPoll(); return; }
      refetch();
    }, POLL_MS);
    const channel = supabase.channel(`recipe-${recipeId}-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "recipes", filter: `id=eq.${recipeId}` },
        (payload) => {
          const row = payload.new as { status: RecipeStatus; title: string | null };
          seq++;
          apply(row.status, row.title);
        })
      .on("system", {}, (p: { extension?: string; status?: string }) => {
        if (p?.extension === "postgres_changes" && p?.status === "ok") refetch();
      })
      .subscribe((s) => {
        if (s === "SUBSCRIBED" || s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") refetch();
      });
    return () => { active = false; stopPoll(); supabase.removeChannel(channel); };
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
