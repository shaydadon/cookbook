// OAuth / auth redirect errors (e.g. Google sign-in rejected by the members-only hook) arrive as
// `error` / `error_description` in the query string or the hash. They are captured once at startup,
// before the router and the Supabase client see the URL, and shown by the login page.

export const AUTH_ERROR_KEY = "auth-error";
const PARAMS = ["error", "error_code", "error_description"];

export const MEMBERS_ONLY = "הגישה מותרת לחברי הקבוצה בלבד";
export const SIGN_IN_FAILED = "הכניסה נכשלה. נסו שוב.";

export function captureAuthError(
  loc: Pick<Location, "search" | "hash" | "pathname"> = window.location,
  hist: Pick<History, "replaceState" | "state"> = window.history,
  store: Pick<Storage, "setItem"> = sessionStorage,
): void {
  try {
    const search = new URLSearchParams(loc.search);
    const hash = new URLSearchParams(loc.hash.replace(/^#/, ""));
    const from = search.has("error") ? search : hash.has("error") ? hash : null;
    if (!from) return;
    const description = from.get("error_description") || from.get("error") || "";
    try { store.setItem(AUTH_ERROR_KEY, description); } catch { /* storage unavailable */ }
    for (const p of PARAMS) {
      search.delete(p);
      hash.delete(p);
    }
    const qs = search.toString();
    const hs = hash.toString();
    hist.replaceState(hist.state, "", `${loc.pathname}${qs ? `?${qs}` : ""}${hs ? `#${hs}` : ""}`);
  } catch {
    // never block startup
  }
}

/** Reads and clears the stashed error; returns the Hebrew message to show, or null. */
export function takeAuthError(store: Pick<Storage, "getItem" | "removeItem"> = sessionStorage): string | null {
  let raw: string | null = null;
  try {
    raw = store.getItem(AUTH_ERROR_KEY);
    store.removeItem(AUTH_ERROR_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  // The members-only hook rejects with MEMBERS_ONLY itself, which Supabase passes through as the description.
  return /hook|403|not allowed|access/i.test(raw) || raw.includes(MEMBERS_ONLY) ? MEMBERS_ONLY : SIGN_IN_FAILED;
}
