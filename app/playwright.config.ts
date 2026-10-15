import { defineConfig, devices } from "@playwright/test";
import { localSupabase } from "./e2e/local";

const sb = localSupabase();

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  globalSetup: "./e2e/global-setup.ts",
  use: { baseURL: "http://localhost:5173", ...devices["Pixel 7"], locale: "he-IL", timezoneId: "Asia/Jerusalem" },
  webServer: [
    {
      command: "npm run dev",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      env: { VITE_SUPABASE_URL: sb.url, VITE_SUPABASE_ANON_KEY: sb.anonKey, VITE_VAPID_PUBLIC_KEY: "" },
    },
    { command: "node e2e/fixture-server.mjs", port: 5199, reuseExistingServer: true },
  ],
});
