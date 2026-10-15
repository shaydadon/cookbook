import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";
import { CATEGORIES } from "../../lib/categories";
import { ingredientsToText, stepsToText, textToIngredients, textToSteps } from "../../lib/edit-format";
import { adminAction, getRecipe, updateRecipe } from "../../lib/recipes";

export function EditRecipe() {
  const qc = useQueryClient();
  const [id, setId] = useState("");
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

  async function save(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    try {
      await updateRecipe(id, {
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category || null,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        ingredients: textToIngredients(form.ingredients),
        steps: textToSteps(form.steps),
      });
      await qc.invalidateQueries({ queryKey: ["recipe", id] });
      setMsg("נשמר");
    } catch (e2) {
      setErr(e2 instanceof Error && e2.message ? e2.message : "הפעולה נכשלה.");
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
      <input id="edit-id" dir="ltr" value={id} onChange={(e) => setId(e.target.value.trim().split("/").pop() ?? "")} className={field} />
      {recipe.data && (
        <form onSubmit={save} className="flex flex-col gap-2">
          <input aria-label="כותרת" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={field} />
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
            <button className="min-h-11 flex-1 rounded-full bg-accent text-white">שמירה</button>
            <button type="button" className="min-h-11 rounded-full border border-line px-4" onClick={regenerateImage}>
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
