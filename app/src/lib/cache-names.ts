export const RECIPES_API_CACHE = "recipes-api";
export const RECIPE_IMAGES_CACHE = "recipe-images";

export async function clearRecipesApiCache(): Promise<void> {
  try {
    await globalThis.caches?.delete(RECIPES_API_CACHE);
  } catch { /* cache API unavailable */ }
}
