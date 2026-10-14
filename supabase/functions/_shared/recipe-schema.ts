import { z } from "./npm.ts";

export const CATEGORIES = [
  "ארוחת בוקר", "מנות עיקריות", "תוספות", "סלטים", "מרקים",
  "אפייה וקינוחים", "לחמים ובצקים", "משקאות", "נשנושים",
] as const;
export type Category = typeof CATEGORIES[number];

// Unknown strings come back as "" and unknown numbers as 0 (no nullable types in the output schema).
export const RecipeAiSchema = z.object({
  insufficient_content: z.boolean(),
  title: z.string(),
  description: z.string(),
  ingredients: z.array(z.object({
    group: z.string(),
    name: z.string(),
    amount: z.string(),
    unit: z.string(),
    note: z.string(),
  })),
  steps: z.array(z.object({ text: z.string() })),
  prep_minutes: z.number().int(),
  cook_minutes: z.number().int(),
  servings: z.number().int(),
  category: z.enum(CATEGORIES),
  tags: z.array(z.string()),
  image_prompt: z.string(),
});
export type RecipeAi = z.infer<typeof RecipeAiSchema>;

const str = { type: "string" } as const;
const int = { type: "integer" } as const;

export const RECIPE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "insufficient_content", "title", "description", "ingredients", "steps",
    "prep_minutes", "cook_minutes", "servings", "category", "tags", "image_prompt",
  ],
  properties: {
    insufficient_content: { type: "boolean" },
    title: str,
    description: str,
    ingredients: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["group", "name", "amount", "unit", "note"],
        properties: { group: str, name: str, amount: str, unit: str, note: str },
      },
    },
    steps: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["text"], properties: { text: str } },
    },
    prep_minutes: int,
    cook_minutes: int,
    servings: int,
    category: { type: "string", enum: [...CATEGORIES] },
    tags: { type: "array", items: str },
    image_prompt: str,
  },
} as const;
