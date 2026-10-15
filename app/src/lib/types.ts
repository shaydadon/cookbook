export type Platform = "web" | "instagram" | "tiktok" | "youtube" | "facebook";
export type RecipeStatus = "queued" | "rewriting" | "imaging" | "published" | "needs_review" | "failed";

export interface Ingredient { group: string | null; name: string; amount: string | null; unit: string | null; note: string | null }
export interface Step { text: string }

export interface Recipe {
  id: string;
  status: RecipeStatus;
  source_url: string;
  source_platform: Platform;
  raw_content?: string | null;
  title: string | null;
  description: string | null;
  ingredients: Ingredient[];
  steps: Step[];
  prep_minutes: number | null;
  cook_minutes: number | null;
  servings: number | null;
  category: string | null;
  tags: string[];
  image_path: string | null;
  error: string | null;
  created_at: string;
  published_at: string | null;
}

export interface Share {
  id: string;
  recipe_id: string;
  shared_by_name: string | null;
  shared_at: string;
  via: "whatsapp" | "app" | "import";
}

export interface Member { id: string; email: string; display_name: string; role: "admin" | "member" }
