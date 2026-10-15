import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";
import { CATEGORIES } from "../../lib/categories";
import { ingredientsToText, stepsToText, textToIngredients, textToSteps } from "../../lib/edit-format";
import { adminAction, getRecipe, updateRecipe } from "../../lib/recipes";
import { STATUS_LABEL } from "../../lib/status";
import type { Recipe } from "../../lib/types";

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const EDITABLE = ["published", "needs_review", "failed"];
const EMPTY_FORM = { title: "", description: "", category: "", tags: "", ingredients: "", steps: "" };

export function EditRecipe() {
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const id = input.match(UUID_RE)?.[0] ?? "";
  const recipe = useQuery({ queryKey: ["recipe", id], queryFn: () => getRecipe(id), enabled: id.length === 36 });
  const [form, setForm] = useState(EMPTY_FORM);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The feed, this recipe and the admin queue all show recipe data: refresh them after any change.
  const refresh = (recipeId: string) => Promise.all([
    qc.invalidateQueries({ queryKey: ["recipes"] }),
    qc.invalidateQueries({ queryKey: ["recipe", recipeId] }),
  ]);

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
    const original = recipe.data;
    if (!original) return;
    const ingredients = textToIngredients(form.ingredients, original.ingredients);
    const steps = textToSteps(form.steps);
    if (!form.title.trim() || !ingredients.length || !steps.length) {
      setErr("חובה למלא כותרת, מרכיבים ושלבים.");
      return;
    }
    const patch: Partial<Recipe> = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category || null,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    // Untouched lists are not sent, so their structure (amount/unit/note) is never flattened.
    if (form.ingredients !== ingredientsToText(original.ingredients)) patch.ingredients = ingredients;
    if (form.steps !== stepsToText(original.steps)) patch.steps = steps;
    try {
      await updateRecipe(id, patch);
      await refresh(id);
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
      await refresh(id);
      setMsg("נוצרה תמונה חדשה");
    } catch (e2) {
      setErr(e2 instanceof Error && e2.message ? e2.message : "הפעולה נכשלה.");
    }
  }

  async function remove() {
    if (!window.confirm("למחוק את המתכון לצמיתות?")) return;
    const recipeId = id;
    setMsg(null);
    setErr(null);
    setBusy(true);
    try {
      await adminAction({ action: "delete", recipe_id: recipeId });
      setInput("");
      setForm(EMPTY_FORM);
      await Promise.all([refresh(recipeId), qc.invalidateQueries({ queryKey: ["review-queue"] })]);
      setMsg("נמחק");
    } catch (e2) {
      setErr(e2 instanceof Error && e2.message ? e2.message : "הפעולה נכשלה.");
    } finally {
      setBusy(false);
    }
  }

  const field = "rounded-xl border border-line bg-surface p-3";
  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="edit-id" className="font-medium">מזהה מתכון (מהכתובת /recipe/…)</label>
      <input id="edit-id" dir="ltr" value={input} onChange={(e) => setInput(e.target.value.trim())} className={field} />
      {recipe.isError && <p role="alert" className="text-danger">המתכון לא נמצא.</p>}
      {recipe.data && (
        <form onSubmit={save} className="flex flex-col gap-2">
          <p className="text-sm text-muted">סטטוס: {STATUS_LABEL[recipe.data.status]}</p>
          {!editable && <p className="text-sm">המתכון בעיבוד — אפשר לערוך אחרי שיסתיים</p>}
          {(status === "needs_review" || status === "failed") && (
            <p className="text-sm">לפרסום השתמשו ב'עיבוד מחדש' בלשונית לטיפול</p>
          )}
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
            <button disabled={!editable} className="min-h-11 flex-1 rounded-full bg-accent text-on-accent disabled:opacity-60">שמירה</button>
            <button type="button" disabled={recipe.data.status !== "published"} onClick={regenerateImage}
              className="min-h-11 rounded-full border border-line px-4 disabled:opacity-60">
              תמונה חדשה
            </button>
          </div>
          <button type="button" disabled={!editable || busy} onClick={remove}
            className="min-h-11 rounded-full border border-red-700 px-4 text-danger disabled:opacity-60">
            מחיקה
          </button>
        </form>
      )}
      {msg && <p role="status" className="text-success">{msg}</p>}
      {err && <p role="alert" className="text-danger">{err}</p>}
    </div>
  );
}
