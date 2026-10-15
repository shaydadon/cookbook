import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminAction, type AdminActionBody, listReviewQueue } from "../../lib/recipes";
import { STATUS_LABEL } from "../../lib/status";
import type { Recipe } from "../../lib/types";

function Item({ recipe }: { recipe: Recipe }) {
  const qc = useQueryClient();
  const [pasted, setPasted] = useState("");
  const action = useMutation({
    mutationFn: (body: AdminActionBody) => adminAction(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["review-queue"] }),
  });
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" dir="ltr" className="truncate text-sm underline">{recipe.source_url}</a>
      <p className="text-sm"><span className="font-medium">{STATUS_LABEL[recipe.status]}:</span> {recipe.error}</p>
      <label htmlFor={`paste-${recipe.id}`} className="px-1 text-[13px] text-muted">הדבקת טקסט המתכון</label>
      <textarea id={`paste-${recipe.id}`} rows={3} value={pasted} onChange={(e) => setPasted(e.target.value)}
        className="card w-full rounded-xl p-3 outline-none" placeholder="לא חובה — בלי טקסט ננסה שוב מהקישור" />
      <div className="flex gap-2">
        <button disabled={action.isPending} className="pressable min-h-11 rounded-xl bg-accent px-4 font-semibold text-on-accent disabled:opacity-60 flex-1"
          onClick={() => action.mutate({ action: "retry", recipe_id: recipe.id, ...(pasted.trim() ? { raw_content: pasted.trim() } : {}) })}>
          עיבוד מחדש
        </button>
        <button disabled={action.isPending} className="pressable min-h-11 rounded-xl bg-fill px-4 font-medium"
          onClick={() => window.confirm("למחוק את המתכון?") && action.mutate({ action: "delete", recipe_id: recipe.id })}>
          מחיקה
        </button>
      </div>
      {action.isError && (
        <p role="alert" className="text-[13px] text-danger">{action.error.message || "הפעולה נכשלה."}</p>
      )}
    </li>
  );
}

export function ReviewQueue() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["review-queue"], queryFn: listReviewQueue });
  if (isPending) return <p role="status" className="text-muted">טוען…</p>;
  if (isError) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center text-[13px] text-danger">
        <p>לא הצלחנו לטעון את רשימת המתכונים לטיפול</p>
        <button type="button" onClick={() => refetch()} className="pressable min-h-11 rounded-xl bg-accent px-6 font-semibold text-on-accent">
          נסו שוב
        </button>
      </div>
    );
  }
  if (!data?.length) return <p className="py-8 text-center text-muted">אין מתכונים שמחכים לטיפול 🎉</p>;
  return <ul className="card flex flex-col divide-y divide-line overflow-hidden rounded-xl">{data.map((r) => <Item key={r.id} recipe={r} />)}</ul>;
}
