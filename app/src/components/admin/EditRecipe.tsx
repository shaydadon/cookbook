import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";
import { CATEGORIES } from "../../lib/categories";
import { ingredientsToText, stepsToText, textToIngredients, textToSteps } from "../../lib/edit-format";
import { adminAction, getRecipe, updateRecipe } from "../../lib/recipes";
import { STATUS_LABEL } from "../../lib/status";

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const EDITABLE = ["published", "needs_review", "failed"];

export function EditRecipe() {
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const id = input.match(UUID_RE)?.[0] ?? "";
  const recipe = useQuery({ queryKey: ["recipe", id], queryFn: () => getRecipe(id), enabled: id.length === 36 });
  const [form, setForm] = useState({ title: "", description: "", category: "", tags: "", ingredients: "", steps: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const r = recipe.data;
    if (!r) return;
    setForm({
      title: r.title ?? "", description: r.description ?? "", category: r.category ?? "",
      tags: r.tags.join(", "), ingredients: ingredientsToText(r.ingredients), steps: stepsToText(r.steps),
    });
  }, [recipe.data]);

  const status = recipe.data?.status;
  const editable = !!status && EDITABLE.includes(status);

  async function save(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    const ingredients = textToIngredients(form.ingredients);
    const steps = textToSteps(form.steps);
    if (!form.title.trim() || !ingredients.length || !steps.length) {
      setErr("חובה למלא כותרת, מרכיבים ושלבים.");
      return;
    }
    try {
      await updateRecipe(id, {
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category || null,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        ingredients,
        steps,
      });
      await qc.invalidateQueries({ queryKey: ["recipe", id] });
      setMsg("נשמר");
    } catch {
      setErr("השמירה נכשלה.");
    }
  }

  async function regenerateImage() {
    setMsg(null);
    setErr(null);
    try {
      await adminAction({ action: "regenerate-image", recipe_id: id });
      await qc.invalidateQueries({ queryKey: ["recipe", id] });
      setMsg("נוצרה תמונה חדשה");
    } catch (e2) {
      setErr(e2 instanceof Error && e2.message ? e2.message : "הפעולה נכשלה.");
    }
  }

  const field = "rounded-xl border border-line bg-white p-3";
  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="edit-id" className="font-medium">מזהה מתכון (מהכתובת /recipe/…)</label>
      <input id="edit-id" dir="ltr" value={input} onChange={(e) => setInput(e.target.value.trim())} className={field} />
      {recipe.isError && <p role="alert" className="text-red-700">המתכון לא נמצא.</p>}
      {recipe.data && (
        <form onSubmit={save} className="flex flex-col gap-2">
          <p className="text-sm text-muted">סטטוס: {STATUS_LABEL[recipe.data.status]}</p>
          {!editable && <p className="text-sm">המתכון בעיבוד — אפשר לערוך אחרי שיסתיים</p>}
          <input aria-label="כותרת" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={field} />
          <textarea aria-label="תיאור" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={field} />
          <select aria-label="קטגוריה" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={field}>
            <option value="">—</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input aria-label="תגיות (מופרדות בפסיק)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className={field} />
          <textarea aria-label="מרכיבים (שורה לכל מרכיב, # לכותרת קבוצה)" rows={8} value={form.ingredients}
            onChange={(e) => setForm({ ...form, ingredients: e.target.value })} className={field} />
          <textarea aria-label="שלבים (שורה לכל שלב)" rows={8} value={form.steps} onChange={(e) => setForm({ ...form, steps: e.target.value })} className={field} />
          <div className="flex gap-2">
            <button disabled={!editable} className="min-h-11 flex-1 rounded-full bg-accent text-white disabled:opacity-60">שמירה</button>
            <button type="button" disabled={recipe.data.status !== "published"} onClick={regenerateImage}
              className="min-h-11 rounded-full border border-line px-4 disabled:opacity-60">
              תמונה חדשה
            </button>
          </div>
          {msg && <p role="status" className="text-green-700">{msg}</p>}
          {err && <p role="alert" className="text-red-700">{err}</p>}
        </form>
      )}
    </div>
  );
}
