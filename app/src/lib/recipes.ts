import { supabase } from "./supabase";
import type { Ingredient, Platform, Recipe, RecipeStatus, Share } from "./types";

export const PAGE_SIZE = 24;

export interface IngestResult { url: string; recipe_id: string; status: RecipeStatus; duplicate: boolean }
export type AdminActionBody =
  | { action: "retry"; recipe_id: string; raw_content?: string }
  | { action: "regenerate-image" | "delete"; recipe_id: string };

// ---------- data access ----------

export async function listRecipes(o: { q: string; category: string | null; favoritesOnly: boolean; page: number }): Promise<Recipe[]> {
  const { data, error } = await supabase.rpc("search_recipes", {
    q: o.q.trim() || null,
    cat: o.category,
    favorites_only: o.favoritesOnly,
    page_size: PAGE_SIZE,
    page_offset: o.page * PAGE_SIZE,
  });
  if (error) throw error;
  return (data ?? []) as Recipe[];
}

export async function getRecipe(id: string): Promise<Recipe> {
  const { data, error } = await supabase.from("recipes").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Recipe;
}

export async function getShares(recipeId: string): Promise<Share[]> {
  const { data, error } = await supabase.from("shares")
    .select("id, recipe_id, shared_by_name, shared_at, via").eq("recipe_id", recipeId).order("shared_at");
  if (error) throw error;
  return (data ?? []) as Share[];
}

export async function listFavoriteIds(): Promise<Set<string>> {
  const { data, error } = await supabase.from("favorites").select("recipe_id");
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.recipe_id as string));
}

export async function setFavorite(memberId: string, recipeId: string, on: boolean): Promise<void> {
  const { error } = on
    ? await supabase.from("favorites").insert({ member_id: memberId, recipe_id: recipeId })
    : await supabase.from("favorites").delete().eq("member_id", memberId).eq("recipe_id", recipeId);
  if (error && error.code !== "23505") throw error;
}

export async function ingestLink(text: string): Promise<IngestResult[]> {
  const { data, error } = await supabase.functions.invoke("ingest", { body: { text } });
  if (error) throw error;
  return (data as { results: IngestResult[] }).results;
}

export async function adminAction(body: AdminActionBody): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke("admin-action", { body });
  if (error) {
    // FunctionsHttpError carries the Response in `context`; surface the server's Hebrew message.
    let message: string | null = null;
    const ctx = (error as { context?: unknown }).context;
    if (ctx instanceof Response) {
      try {
        const j = (await ctx.json()) as { message?: unknown };
        if (typeof j.message === "string" && j.message) message = j.message;
      } catch {
        // body was not JSON; fall back to the original error
      }
    }
    throw message ? new Error(message) : error;
  }
  return data as Record<string, unknown>;
}

export async function listReviewQueue(): Promise<Recipe[]> {
  const { data, error } = await supabase.from("recipes").select("*")
    .in("status", ["needs_review", "failed"]).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Recipe[];
}

export async function updateRecipe(id: string, patch: Partial<Recipe>): Promise<void> {
  const { error } = await supabase.from("recipes").update(patch).eq("id", id);
  if (error) throw error;
}

// ---------- pure helpers ----------

export function imageUrl(path: string | null): string | null {
  return path ? supabase.storage.from("recipe-images").getPublicUrl(path).data.publicUrl : null;
}

export function totalMinutes(r: { prep_minutes: number | null; cook_minutes: number | null }): number | null {
  const t = (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0);
  return t > 0 ? t : null;
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} דק׳`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hours = h === 1 ? "שעה" : `${h} שע׳`;
  return m ? `${hours} ו-${m} דק׳` : hours;
}

export function formatIngredient(i: Ingredient): string {
  const main = [i.amount, i.unit, i.name].filter(Boolean).join(" ");
  return i.note ? `${main} (${i.note})` : main;
}

export function groupIngredients(list: Ingredient[]): { group: string | null; items: Ingredient[] }[] {
  const out: { group: string | null; items: Ingredient[] }[] = [];
  for (const i of list) {
    const last = out[out.length - 1];
    if (last && last.group === i.group) last.items.push(i);
    else out.push({ group: i.group, items: [i] });
  }
  return out;
}

const PLATFORM_LABEL: Record<Exclude<Platform, "web">, string> = {
  instagram: "אינסטגרם", tiktok: "טיקטוק", youtube: "יוטיוב", facebook: "פייסבוק",
};

export function sourceLabel(url: string, platform: Platform): string {
  if (platform !== "web") return PLATFORM_LABEL[platform];
  return new URL(url).hostname.replace(/^www\./, "");
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Jerusalem",
  }).format(new Date(iso));
}

export function formatAttribution(r: Pick<Recipe, "source_url" | "source_platform">, share: Share | null): string {
  const source = `מקור: ${sourceLabel(r.source_url, r.source_platform)}`;
  if (!share?.shared_by_name) return source;
  return `${source} · שותף ע״י ${share.shared_by_name} ב-${formatDate(share.shared_at)}`;
}
