import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));

export function localSupabase(): { url: string; anonKey: string; serviceKey: string } {
  const s = JSON.parse(execSync("npx supabase status -o json", { cwd: REPO_ROOT, encoding: "utf8" }));
  return { url: s.API_URL, anonKey: s.ANON_KEY ?? s.PUBLISHABLE_KEY, serviceKey: s.SERVICE_ROLE_KEY ?? s.SECRET_KEY };
}

export const E2E_MEMBER = "e2e-member@test.local";
export const E2E_ADMIN = "e2e-admin@test.local";
export const SEEDED_RECIPE_ID = "00000000-0000-4000-8000-0000000e2e01";

export const DEV_ORIGIN = "http://localhost:5173";
/** `vite preview` of the production build (the only place the service worker is registered). */
export const PREVIEW_ORIGIN = "http://localhost:4173";
