import { defineConfig, devices } from "@playwright/test";
import { DEV_ORIGIN, localSupabase, PREVIEW_ORIGIN } from "./e2e/local";

const sb = localSupabase();
const viteEnv = { VITE_SUPABASE_URL: sb.url, VITE_SUPABASE_ANON_KEY: sb.anonKey, VITE_VAPID_PUBLIC_KEY: "" };

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  // Serial: both projects sign in the same E2E users, and a new magic link invalidates the previous one
  // (parallel projects raced into otp_expired).
  workers: 1,
  globalSetup: "./e2e/global-setup.ts",
  use: { ...devices["Pixel 7"], locale: "he-IL", timezoneId: "Asia/Jerusalem" },
  projects: [
    // Dev server: the main flows.
    { name: "dev", testIgnore: /offline\.spec\.ts/, use: { baseURL: DEV_ORIGIN } },
    // Production build + preview: the service worker is only registered in a build (devOptions.enabled: false).
    { name: "pwa-preview", testMatch: /offline\.spec\.ts/, use: { baseURL: PREVIEW_ORIGIN, serviceWorkers: "allow" } },
  ],
  webServer: [
    {
      command: "npm run dev",
      url: DEV_ORIGIN,
      reuseExistingServer: true,
      env: viteEnv,
    },
    {
      command: "npm run build && npx vite preview --port 4173 --strictPort",
      url: PREVIEW_ORIGIN,
      reuseExistingServer: true,
      timeout: 180_000,
      env: viteEnv,
    },
    { command: "node e2e/fixture-server.mjs", port: 5199, reuseExistingServer: true },
  ],
});
