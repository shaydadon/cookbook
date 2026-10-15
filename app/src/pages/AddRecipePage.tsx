import { type FormEvent, useState } from "react";
import { useSearchParams } from "react-router";
import { StatusCard } from "../components/StatusCard";
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

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!extractFirstUrl(url)) return setError("לא נמצא קישור. הדביקו קישור שמתחיל ב-https://");
    setBusy(true);
    try {
      const res = await ingestLink([note.trim(), url.trim()].filter(Boolean).join("\n"));
      setResults((prev) => [...res, ...prev]);
      setUrl("");
      setNote("");
    } catch {
      setError("משהו השתבש. נסו שוב בעוד רגע.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <h2 className="text-lg font-bold">הוספת מתכון</h2>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label htmlFor="url" className="font-medium">קישור למתכון</label>
        <input id="url" dir="ltr" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…" className="min-h-12 rounded-xl border border-line bg-white px-4" />
        <label htmlFor="note" className="font-medium">הערה (לא חובה)</label>
        <textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="אפשר להדביק כאן גם את טקסט המתכון אם הוא בתיאור הסרטון"
          className="rounded-xl border border-line bg-white p-4" />
        <button disabled={busy} className="min-h-12 rounded-full bg-accent font-medium text-white disabled:opacity-60">הוספה</button>
      </form>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {results.map((r) => (
        <StatusCard key={r.recipe_id} recipeId={r.recipe_id} initialStatus={r.status} duplicate={r.duplicate} />
      ))}
    </div>
  );
}
