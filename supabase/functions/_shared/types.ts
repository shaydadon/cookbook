export type Platform = "web" | "instagram" | "tiktok" | "youtube" | "facebook";

export type RecipeStatus =
  | "queued"
  | "rewriting"
  | "imaging"
  | "published"
  | "needs_review"
  | "failed";

export interface Ingredient {
  group: string | null;
  name: string;
  amount: string | null;
  unit: string | null;
  note: string | null;
}

export interface Step {
  text: string;
}

export interface RecipeRow {
  id: string;
  status: RecipeStatus;
  source_url: string;
  source_url_normalized: string;
  source_platform: Platform;
  raw_content: string | null;
  title: string | null;
  description: string | null;
  ingredients: Ingredient[];
  steps: Step[];
  prep_minutes: number | null;
  cook_minutes: number | null;
  servings: number | null;
  category: string | null;
  tags: string[];
  image_prompt: string | null;
  image_path: string | null;
  error: string | null;
  attempts: number;
  next_attempt_at: string;
  locked_until: string | null;
  published_at: string | null;
}

export type RecipePatch = Partial<
  Omit<RecipeRow, "id" | "source_url" | "source_url_normalized" | "source_platform">
>;
