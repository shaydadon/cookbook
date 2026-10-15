// Pure helpers used by the service worker (src/sw.ts); kept here so they can be unit-tested.

/**
 * API reads the SW keeps for offline use: single recipe reads (`id=eq.`), shares and the feed RPC (GET),
 * plus the signed-in member's own row (`members?id=eq.`), without which AuthProvider cannot start offline.
 * Everything else (admin list `status=in.`, favourites, other members reads, writes) bypasses the SW.
 */
export function isRecipesApiRequest(url: URL, method: string): boolean {
  if (method !== "GET") return false;
  const p = url.pathname;
  const byId = url.searchParams.get("id")?.startsWith("eq.") ?? false;
  if (p.endsWith("/rest/v1/recipes") || p.endsWith("/rest/v1/members")) return byId;
  return p.endsWith("/rest/v1/shares") || p.endsWith("/rest/v1/rpc/search_recipes");
}

/** Resolves a notification target; anything pointing at another origin falls back to the app root. */
export function notificationTarget(url: string | undefined, origin: string): string {
  try {
    const u = new URL(url || "/", origin);
    return u.origin === origin ? u.href : "/";
  } catch {
    return "/";
  }
}
