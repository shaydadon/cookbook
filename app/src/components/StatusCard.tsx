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
    <div className="card flex items-center gap-3 rounded-xl p-3" aria-live="polite">
      {!TERMINAL.includes(status) && <span className="size-[18px] shrink-0 animate-spin rounded-full border-[2.5px] border-accent-soft border-t-accent" aria-hidden />}
      <div className="min-w-0 flex-1">
        {duplicate && <p className="text-[12px] text-muted">המתכון הזה כבר קיים — רשמנו שגם את/ה שיתפת.</p>}
        <p className="truncate text-[14px] font-semibold">{title ?? "מתכון חדש"}</p>
        <p className={`text-[12.5px] ${done ? "text-success" : status === "failed" || status === "needs_review" ? "text-danger" : "text-muted"}`}>
          {STATUS_LABEL[status]}
        </p>
      </div>
      {done && <Link to={`/recipe/${recipeId}`} className="pressable inline-flex min-h-11 items-center px-2 text-[14px] font-semibold text-accent">לצפייה במתכון</Link>}
    </div>
  );
}
