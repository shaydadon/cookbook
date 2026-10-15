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

export function textToIngredients(text: string): Ingredient[] {
  let group: string | null = null;
  const out: Ingredient[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      group = line.slice(1).trim() || null;
      continue;
    }
    out.push({ group, name: line, amount: null, unit: null, note: null });
  }
  return out;
}

export const stepsToText = (steps: Step[]) => steps.map((s) => s.text).join("\n");
export const textToSteps = (text: string): Step[] =>
  text.split("\n").map((t) => t.trim()).filter(Boolean).map((t) => ({ text: t }));
