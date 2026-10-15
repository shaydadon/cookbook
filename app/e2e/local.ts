import { execSync } from "node:child_process";

export function localSupabase(): { url: string; anonKey: string; serviceKey: string } {
  const s = JSON.parse(execSync("npx supabase status -o json", { cwd: "..", encoding: "utf8" }));
  return { url: s.API_URL, anonKey: s.ANON_KEY ?? s.PUBLISHABLE_KEY, serviceKey: s.SERVICE_ROLE_KEY ?? s.SECRET_KEY };
}

export const E2E_MEMBER = "e2e-member@test.local";
export const E2E_ADMIN = "e2e-admin@test.local";
export const SEEDED_RECIPE_ID = "00000000-0000-4000-8000-0000000e2e01";
