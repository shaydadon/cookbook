import { type FormEvent, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { StatusCard } from "../components/StatusCard";
import { Sheet } from "../components/ui/Sheet";
import { type IngestResult, ingestLink } from "../lib/recipes";
import { extractFirstUrl, prefillFromShare } from "../lib/share";

export default function AddRecipePage() {
  const [params] = useSearchParams();
  const initial = prefillFromShare(params);
  const [url, setUrl] = useState(initial.url);
  const [note, setNote] = useState(initial.note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<IngestResult[]>([]);
  const navigate = useNavigate();
  // Back to wherever the sheet was opened from; opened directly (share target) → the feed.
  const close = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1); else navigate("/", { replace: true });
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!extractFirstUrl(url)) return setError("לא נמצא קישור. הדביקו קישור שמתחיל ב-https://");
    if (!navigator.onLine) return setError("אין חיבור לאינטרנט"); // keep the link in the form for later
    setBusy(true);
    try {
      const res = await ingestLink([note.trim(), url.trim()].filter(Boolean).join("\n"));
      const fresh = [...new Map(res.map((r) => [r.recipe_id, r])).values()];
      setResults((prev) => [...fresh, ...prev.filter((p) => !fresh.some((f) => f.recipe_id === p.recipe_id))]);
      setUrl("");
      setNote("");
    } catch {
      setError(navigator.onLine ? "משהו השתבש. נסו שוב בעוד רגע." : "אין חיבור לאינטרנט");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open onClose={close} title="מתכון חדש"
      leading={<button type="button" onClick={close} className="min-h-11 px-1 text-accent">ביטול</button>}>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <label htmlFor="url" className="px-1 text-[13px] text-muted">קישור למתכון</label>
        <input id="url" dir="ltr" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={url}
          onChange={(e) => setUrl(e.target.value)} placeholder="https://…"
          className="card min-h-12 rounded-xl px-4 outline-none" />
        <label htmlFor="note" className="mt-2 px-1 text-[13px] text-muted">הערה (לא חובה)</label>
        <textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="אפשר להדביק כאן גם את טקסט המתכון אם הוא בתיאור הסרטון"
          className="card rounded-xl p-4 outline-none" />
        <button disabled={busy} className="pressable mt-3 min-h-12 rounded-[14px] bg-accent text-[16px] font-bold text-on-accent disabled:opacity-60">הוספה</button>
      </form>
      {error && <p role="alert" className="mt-3 px-1 text-[13px] text-danger">{error}</p>}
      <div className="mt-4 flex flex-col gap-2.5">
        {results.map((r) => (
          <StatusCard key={r.recipe_id} recipeId={r.recipe_id} initialStatus={r.status} duplicate={r.duplicate} />
        ))}
      </div>
    </Sheet>
  );
}
