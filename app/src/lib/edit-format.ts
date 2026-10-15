import { formatIngredient } from "./recipes";
import type { Ingredient, Step } from "./types";

export function ingredientsToText(list: Ingredient[]): string {
  const lines: string[] = [];
  let group: string | null = null;
  for (const i of list) {
    if (i.group !== group) {
      lines.push(i.group ? `# ${i.group}` : "#");
      group = i.group;
    }
    lines.push(formatIngredient(i));
  }
  return lines.join("\n");
}

/**
 * Parses the editor text. With `original`, a line that still reads exactly like an original ingredient of the
 * same group reuses that ingredient object (keeping amount/unit/note structure); each original is reused once.
 */
export function textToIngredients(text: string, original: Ingredient[] = []): Ingredient[] {
  const pool = [...original];
  let group: string | null = null;
  const out: Ingredient[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      group = line.slice(1).trim() || null;
      continue;
    }
    const k = pool.findIndex((o) => o.group === group && formatIngredient(o) === line);
    if (k >= 0) {
      out.push(pool[k]);
      pool.splice(k, 1);
    } else {
      out.push({ group, name: line, amount: null, unit: null, note: null });
    }
  }
  return out;
}

export const stepsToText = (steps: Step[]) => steps.map((s) => s.text).join("\n");
export const textToSteps = (text: string): Step[] =>
  text.split("\n").map((t) => t.trim()).filter(Boolean).map((t) => ({ text: t }));
