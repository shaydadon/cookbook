import { useState } from "react";
import { type ImportPage, runImport } from "../../lib/import";
import { supabase } from "../../lib/supabase";

export function ChatImport() {
  const [progress, setProgress] = useState<{ done: number; total: number; created: number; duplicates: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File) {
    setBusy(true);
    setError(null);
    setProgress(null);
    try {
      const content = await file.text();
      await runImport(content, async (body) => {
        const { data, error } = await supabase.functions.invoke("import-chat", { body });
        if (error) throw error;
        return data as ImportPage;
      }, setProgress);
    } catch {
      setError("הייבוא נעצר. אפשר להעלות את אותו קובץ שוב — כפילויות לא ייווצרו.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="px-1 text-[13px] text-muted">בוואטסאפ: הקבוצה ← ⋮ ← עוד ← ייצוא צ'אט ← ללא מדיה. העלו כאן את קובץ ה-txt.</p>
      <p className="px-1 text-[13px] text-muted">באייפון הקובץ מגיע כ-zip — פתחו אותו והעלו את _chat.txt</p>
      <label htmlFor="chat-file" className="px-1 text-[13px] text-muted">קובץ ייצוא (.txt)</label>
      <input id="chat-file" type="file" accept=".txt,text/plain" disabled={busy} className="card w-full rounded-xl p-3 text-[14px]"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (file) void onFile(file);
        }} />
      {progress && (
        <p role="status">
          {progress.done} מתוך {progress.total} הודעות עם קישור · {progress.created} מתכונים חדשים · {progress.duplicates} כבר היו
        </p>
      )}
      {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
    </div>
  );
}
