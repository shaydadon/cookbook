# Recipes App — Plan 2: PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An installable, Hebrew RTL PWA where group members browse, search, favourite and cook the recipes produced by the backend, add links themselves (including from the phone's share sheet), get push notifications, and where the admin fixes failed recipes and imports chat history.

**Architecture:** React SPA (Vite) talking directly to Supabase (`supabase-js`: RPC `search_recipes`, table reads under RLS, Realtime for status, Edge Functions for writes). Pure helpers in `src/lib/` are unit-tested; pages are tested with mocked data modules; a Playwright suite runs the whole thing against the local Supabase stack from Plan 1 with `AI_FAKE=1`. A custom Workbox service worker handles offline caching, push and notification clicks.

**Tech Stack:** Vite 8, React 19, TypeScript, React Router 7 (`react-router@7`), TanStack Query 5, Tailwind CSS 4 (`@tailwindcss/vite`), `@supabase/supabase-js@2`, `vite-plugin-pwa@2` (injectManifest) + Workbox, Vitest 5 + Testing Library + jsdom, Playwright 1.64.

**Spec:** `docs/superpowers/specs/2026-10-14-recipes-app-design.md`

**Depends on:** Plan 1 (`docs/superpowers/plans/2026-10-14-recipes-backend.md`) fully implemented — migrations, functions, `AI_FAKE` mode.

## Global Constraints

- `<html lang="he" dir="rtl">`; every layout uses logical properties (Tailwind `ms-*`/`me-*`/`ps-*`/`pe-*`, `start`/`end`), never `left`/`right`.
- All UI copy is Hebrew. App name constant `APP_NAME = "המתכונים שלנו"` lives only in `src/lib/app.ts` and the manifest.
- Font: Heebo (Google Fonts, weights 400/500/700).
- Categories list must equal the backend list (verbatim): `ארוחת בוקר`, `מנות עיקריות`, `תוספות`, `סלטים`, `מרקים`, `אפייה וקינוחים`, `לחמים ובצקים`, `משקאות`, `נשנושים` — enforced by a test that reads the backend file.
- Env vars (Vite): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`. Nothing secret in the client.
- Push permission is **never** requested on page load; only after the member taps "כן" in the in-app prompt.
- Page size 24 (matches `search_recipes`).
- Mobile first: design at 375 px, 16 px side gutter, no horizontal scroll; tap targets ≥ 44 px.
- Writes go through Edge Functions (`ingest`, `admin-action`, `import-chat`, `push-subscribe`) except favourites, recipe edits by admins and allow-list management, which go through RLS-protected table writes.

## Review Focus

1. **Share target payloads differ by app/OS**: Android often puts the link inside `text` (with extra words), iOS uses `url`, some apps put it in `title` → the Add page must pre-fill the first URL found in any of them. Pinned in Task 7 (`prefillFromShare` tests).
2. **Search input with LIKE wildcards or quotes** (`50%`, `_`, `"`) and very fast typing → no errors, one request per pause. Pinned in Task 4 (debounce test) — escaping is server-side (Plan 1, Task 2).
3. **Recipe with missing optional data** (no image, no times, no servings, no description, ingredients without groups, single step) → page renders without "null"/"NaN"/empty headings. Pinned in Task 5.
4. **Wake Lock unsupported or rejected** (iOS < 16.4, battery saver) → cooking mode still works, no crash. Pinned in Task 6.
5. **Signed-in Google user whose email is not allow-listed** (hook blocks sign-up, or a pre-existing auth user with no `members` row) → clear "group members only" screen with sign-out, never an empty feed or a spinner. Pinned in Task 3.

---

## File Structure

```
recipes-app/app/
  index.html
  package.json, vite.config.ts, tsconfig*.json, playwright.config.ts, vercel.json, .env.example
  public/icon.svg  (+ generated PNG icons)
  src/
    main.tsx                 # providers + router
    App.tsx                  # route table
    index.css                # tailwind + font + tokens
    sw.ts                    # service worker (precache, runtime cache, push)
    lib/
      app.ts                 # APP_NAME
      supabase.ts            # client
      types.ts               # Recipe, Ingredient, Share, Member, RecipeStatus
      categories.ts          # CATEGORIES (+ test vs backend)
      recipes.ts             # data access + pure formatting helpers
      share.ts               # prefillFromShare, extractFirstUrl
      push.ts                # urlBase64ToUint8Array, pushSupported, subscribePush, iOS helpers
      import.ts              # runImport loop
      edit-format.ts         # ingredients/steps <-> textarea
      status.ts              # Hebrew status labels
    auth/
      AuthProvider.tsx       # session + member context
      RequireMember.tsx      # guard
    hooks/
      useDebounced.ts, useFavorites.ts, useWakeLock.ts
    components/
      Layout.tsx, RecipeCard.tsx, FavoriteButton.tsx, CategoryChips.tsx, SearchBar.tsx,
      StatusCard.tsx, PushPrompt.tsx, IosInstallHint.tsx, CookingMode.tsx
      admin/ReviewQueue.tsx, admin/ChatImport.tsx, admin/AllowList.tsx, admin/EditRecipe.tsx
    pages/
      LoginPage.tsx, FeedPage.tsx, RecipePage.tsx, CookingPage.tsx, AddRecipePage.tsx, AdminPage.tsx
    test/
      setup.ts, render.tsx
  e2e/
    global-setup.ts, local.ts, fixture-server.mjs, fixtures/recipe.html, app.spec.ts
```

---

### Task 1: Scaffold the app (Vite, React, Tailwind, RTL, Vitest)

**Files:**
- Create: everything under `app/` from the Vite template; `app/src/index.css`, `app/src/lib/app.ts`, `app/src/lib/supabase.ts`, `app/src/test/setup.ts`, `app/.env.example`
- Modify: root `package.json` (add `app:*` scripts), `.gitignore`
- Test: `app/src/App.test.tsx` (temporary smoke, replaced in Task 3)

**Interfaces:**
- Produces: `supabase` client (`src/lib/supabase.ts`), `APP_NAME`, npm scripts `npm run dev|build|test|e2e` inside `app/`.

- [ ] **Step 1: Create the Vite project**

```bash
cd /c/xampp/htdocs/recipes-app
npm create vite@latest app -- --template react-ts
cd app
npm install
npm install @supabase/supabase-js@2 @tanstack/react-query@5 react-router@7
npm install -D tailwindcss@4 @tailwindcss/vite@4 vite-plugin-pwa@2 workbox-precaching workbox-routing workbox-strategies workbox-expiration \
  vitest@5 jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom @playwright/test@1.64 @vite-pwa/assets-generator
```

Delete `src/App.css`, `src/assets/`, and the template's demo content in `src/App.tsx`.

- [ ] **Step 2: `vite.config.ts`** (PWA plugin is added in Task 9)

```ts
/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    env: { VITE_SUPABASE_URL: "http://localhost:54321", VITE_SUPABASE_ANON_KEY: "test-anon-key" },
  },
});
```

- [ ] **Step 3: `index.html`**

```html
<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#c2410c" />
    <link rel="icon" href="/icon.svg" type="image/svg+xml" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700&display=swap" rel="stylesheet" />
    <title>המתכונים שלנו</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: `src/index.css`**

```css
@import "tailwindcss";

@theme {
  --font-sans: "Heebo", system-ui, sans-serif;
  --color-paper: #fffaf3;
  --color-ink: #1c1917;
  --color-muted: #78716c;
  --color-accent: #c2410c;
  --color-accent-soft: #ffedd5;
  --color-line: #e7e5e4;
}

html, body, #root { min-height: 100%; }
body {
  background: var(--color-paper);
  color: var(--color-ink);
  font-family: var(--font-sans);
  -webkit-tap-highlight-color: transparent;
}
button, a { touch-action: manipulation; }
input, textarea, select { font-size: 16px; } /* no iOS zoom on focus */
```

- [ ] **Step 5: `src/lib/app.ts`, `src/lib/supabase.ts`, `.env.example`, `src/test/setup.ts`**

```ts
// src/lib/app.ts
export const APP_NAME = "המתכונים שלנו";
```

```ts
// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
```

```dotenv
# app/.env.example — copy to app/.env.local
# Local: values from `npx supabase status` (API URL, anon/publishable key)
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=
VITE_VAPID_PUBLIC_KEY=
```

```ts
// src/test/setup.ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());
```

- [ ] **Step 6: Scripts** — in `app/package.json` set:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview --port 5173",
  "test": "vitest run",
  "test:watch": "vitest",
  "e2e": "playwright test",
  "icons": "pwa-assets-generator --preset minimal-2023 public/icon.svg"
}
```

In the root `package.json` add: `"app:dev": "npm --prefix app run dev"`, `"app:test": "npm --prefix app test"`, `"app:e2e": "npm --prefix app run e2e"`.

- [ ] **Step 7: Smoke test** — `src/App.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { APP_NAME } from "./lib/app";

test("renders the app name", () => {
  render(<h1>{APP_NAME}</h1>);
  expect(screen.getByRole("heading")).toHaveTextContent("המתכונים שלנו");
});
```

Replace `src/App.tsx` with `export default function App() { return null; }` for now.

Run: `cd app && npm test`
Expected: `1 passed`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore(app): scaffold Vite React app with Tailwind, RTL shell and Vitest"
```

---

### Task 2: Types, categories, data access and formatting helpers

**Files:**
- Create: `src/lib/types.ts`, `src/lib/categories.ts`, `src/lib/recipes.ts`, `src/lib/status.ts`
- Test: `src/lib/categories.test.ts`, `src/lib/recipes.test.ts`

**Interfaces:**
- Produces:
  - Types: `Platform`, `RecipeStatus`, `Ingredient`, `Step`, `Recipe`, `Share`, `Member`
  - `CATEGORIES: readonly string[]`
  - `PAGE_SIZE = 24`
  - Data: `listRecipes(o: { q: string; category: string | null; favoritesOnly: boolean; page: number }): Promise<Recipe[]>`, `getRecipe(id): Promise<Recipe>`, `getShares(recipeId): Promise<Share[]>`, `listFavoriteIds(): Promise<Set<string>>`, `setFavorite(memberId, recipeId, on: boolean): Promise<void>`, `ingestLink(text: string): Promise<IngestResult[]>`, `adminAction(body: AdminActionBody): Promise<Record<string, unknown>>`, `listReviewQueue(): Promise<Recipe[]>`, `updateRecipe(id, patch: Partial<Recipe>): Promise<void>`
  - `IngestResult = { url: string; recipe_id: string; status: RecipeStatus; duplicate: boolean }`
  - `AdminActionBody = { action: "retry"; recipe_id: string; raw_content?: string } | { action: "regenerate-image" | "delete"; recipe_id: string }`
  - Pure: `imageUrl(path: string | null): string | null`, `totalMinutes(r): number | null`, `formatMinutes(min: number): string`, `formatIngredient(i: Ingredient): string`, `groupIngredients(list: Ingredient[]): { group: string | null; items: Ingredient[] }[]`, `sourceLabel(url: string, platform: Platform): string`, `formatDate(iso: string): string`, `formatAttribution(r: Pick<Recipe, "source_url" | "source_platform">, share: Share | null): string`
  - `STATUS_LABEL: Record<RecipeStatus, string>`

- [ ] **Step 1: Write failing tests**

`src/lib/categories.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { CATEGORIES } from "./categories";

test("categories match the backend schema exactly", () => {
  const backend = readFileSync(resolve(__dirname, "../../../supabase/functions/_shared/recipe-schema.ts"), "utf8");
  const block = backend.slice(backend.indexOf("export const CATEGORIES"), backend.indexOf("] as const"));
  const backendList = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  expect([...CATEGORIES]).toEqual(backendList);
});
```

(`__dirname` works here because Vitest transforms test files; if it errors, use `fileURLToPath(new URL(".", import.meta.url))`.)

`src/lib/recipes.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  formatAttribution, formatIngredient, formatMinutes, groupIngredients, imageUrl, sourceLabel, totalMinutes,
} from "./recipes";
import type { Ingredient, Share } from "./types";

const ing = (name: string, over: Partial<Ingredient> = {}): Ingredient =>
  ({ group: null, name, amount: null, unit: null, note: null, ...over });

describe("formatting", () => {
  test("formatIngredient joins amount, unit, name and note", () => {
    expect(formatIngredient(ing("קמח", { amount: "2", unit: "כוסות", note: "מנופה" }))).toBe("2 כוסות קמח (מנופה)");
    expect(formatIngredient(ing("מלח"))).toBe("מלח");
  });

  test("groupIngredients keeps order and groups consecutive items", () => {
    const groups = groupIngredients([
      ing("קמח", { group: "לבצק" }), ing("מים", { group: "לבצק" }), ing("עגבניות", { group: "לרוטב" }),
    ]);
    expect(groups.map((g) => [g.group, g.items.length])).toEqual([["לבצק", 2], ["לרוטב", 1]]);
    expect(groupIngredients([ing("א"), ing("ב")])).toEqual([{ group: null, items: [ing("א"), ing("ב")] }]);
  });

  test("totalMinutes and formatMinutes", () => {
    expect(totalMinutes({ prep_minutes: 10, cook_minutes: 35 })).toBe(45);
    expect(totalMinutes({ prep_minutes: null, cook_minutes: null })).toBeNull();
    expect(formatMinutes(45)).toBe("45 דק׳");
    expect(formatMinutes(60)).toBe("שעה");
    expect(formatMinutes(75)).toBe("שעה ו-15 דק׳");
    expect(formatMinutes(150)).toBe("2 שע׳ ו-30 דק׳");
  });

  test("sourceLabel names social platforms in Hebrew and strips www for sites", () => {
    expect(sourceLabel("https://instagram.com/reel/x", "instagram")).toBe("אינסטגרם");
    expect(sourceLabel("https://www.mako.co.il/food/1", "web")).toBe("mako.co.il");
  });

  test("formatAttribution with and without a share", () => {
    const share: Share = { id: "s", recipe_id: "r", shared_by_name: "רחל", shared_at: "2026-10-12T09:00:00Z", via: "whatsapp" };
    expect(formatAttribution({ source_url: "https://www.mako.co.il/a", source_platform: "web" }, share))
      .toBe("מקור: mako.co.il · שותף ע״י רחל ב-12.10.2026");
    expect(formatAttribution({ source_url: "https://tiktok.com/x", source_platform: "tiktok" }, null)).toBe("מקור: טיקטוק");
  });

  test("imageUrl builds a public storage URL or null", () => {
    expect(imageUrl(null)).toBeNull();
    expect(imageUrl("r1/a.webp")).toBe("http://localhost:54321/storage/v1/object/public/recipe-images/r1/a.webp");
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL (modules missing).

- [ ] **Step 3: Implement**

`src/lib/types.ts`:

```ts
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
```

`src/lib/categories.ts`:

```ts
export const CATEGORIES = [
  "ארוחת בוקר", "מנות עיקריות", "תוספות", "סלטים", "מרקים",
  "אפייה וקינוחים", "לחמים ובצקים", "משקאות", "נשנושים",
] as const;
```

`src/lib/status.ts`:

```ts
import type { RecipeStatus } from "./types";

export const STATUS_LABEL: Record<RecipeStatus, string> = {
  queued: "ממתין לקריאת הקישור…",
  rewriting: "כותבים את המתכון…",
  imaging: "מצלמים את המנה…",
  published: "פורסם",
  needs_review: "צריך בדיקה ידנית",
  failed: "נכשל",
};
```

`src/lib/recipes.ts`:

```ts
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
  if (error) throw error;
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
```

- [ ] **Step 4: Run tests** — `npm test` → PASS. (If `formatDate` yields `12/10/2026` in your Node ICU, keep the test and change `formatDate` to build `dd.mm.yyyy` from `formatToParts`.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(app): types, categories, Supabase data access and Hebrew formatting helpers"
```

---

### Task 3: Auth (provider, guard, login, not-allowed screen) and app shell

**Files:**
- Create: `src/auth/AuthProvider.tsx`, `src/auth/RequireMember.tsx`, `src/pages/LoginPage.tsx`, `src/components/Layout.tsx`, `src/main.tsx`, `src/App.tsx`, `src/test/render.tsx`
- Delete: `src/App.test.tsx`
- Test: `src/auth/RequireMember.test.tsx`, `src/pages/LoginPage.test.tsx`

**Interfaces:**
- Consumes: `supabase`, `Member`.
- Produces:
  - `AuthContext` (exported for tests) with value `AuthState = { loading: boolean; session: Session | null; member: Member | null; signOut(): Promise<void> }`; `useAuth(): AuthState`; `<AuthProvider>`
  - `<RequireMember>` renders `<Outlet/>` for members, redirects to `/login` when signed out, renders the not-allowed screen for signed-in non-members.
  - `<Layout>`: header + bottom nav (`בית`, `מועדפים`, `הוספה`, `ניהול` for admins) + `<Outlet/>`.
  - Routes: `/login`, `/`, `/favorites`, `/recipe/:id`, `/recipe/:id/cook`, `/add`, `/admin`.
  - Test helper `renderWithProviders(ui, { member?, route?, path? })`.

- [ ] **Step 1: Test helper** — `src/test/render.tsx`

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { AuthContext, type AuthState } from "../auth/AuthProvider";
import type { Member } from "../lib/types";

export const TEST_MEMBER: Member = { id: "m1", email: "rachel@test.local", display_name: "רחל", role: "member" };
export const TEST_ADMIN: Member = { ...TEST_MEMBER, id: "a1", display_name: "שי", role: "admin" };

export function renderWithProviders(
  ui: ReactElement,
  opts: { member?: Member | null; signedIn?: boolean; route?: string; path?: string } = {},
) {
  const member = opts.member === undefined ? TEST_MEMBER : opts.member;
  const signedIn = opts.signedIn ?? member !== null;
  const auth: AuthState = {
    loading: false,
    session: signedIn ? ({ user: { id: member?.id ?? "u", email: member?.email ?? "x@y.z" } } as AuthState["session"]) : null,
    member,
    signOut: async () => {},
  };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[opts.route ?? "/"]}>
          <Routes>
            <Route path={opts.path ?? "*"} element={ui} />
            <Route path="/login" element={<div>LOGIN PAGE</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}
```

- [ ] **Step 2: Write failing tests**

`src/auth/RequireMember.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router";
import { expect, test } from "vitest";
import { renderWithProviders } from "../test/render";
import { RequireMember } from "./RequireMember";

const guarded = (
  <Routes>
    <Route element={<RequireMember />}>
      <Route path="/" element={<div>FEED</div>} />
    </Route>
  </Routes>
);

test("member sees the page", () => {
  renderWithProviders(guarded);
  expect(screen.getByText("FEED")).toBeInTheDocument();
});

test("signed-out user is sent to login", () => {
  renderWithProviders(guarded, { member: null, signedIn: false });
  expect(screen.getByText("LOGIN PAGE")).toBeInTheDocument();
});

test("signed-in non-member sees the members-only screen with sign out", () => {
  renderWithProviders(guarded, { member: null, signedIn: true });
  expect(screen.getByText("הגישה מותרת לחברי הקבוצה בלבד")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "התנתקות" })).toBeInTheDocument();
  expect(screen.queryByText("FEED")).not.toBeInTheDocument();
});
```

`src/pages/LoginPage.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { renderWithProviders } from "../test/render";
import LoginPage from "./LoginPage";

const signInWithOtp = vi.fn();
vi.mock("../lib/supabase", () => ({
  supabase: { auth: { signInWithOtp: (...a: unknown[]) => signInWithOtp(...a), signInWithOAuth: vi.fn() } },
}));

beforeEach(() => signInWithOtp.mockReset());

test("sends a magic link and confirms", async () => {
  signInWithOtp.mockResolvedValue({ error: null });
  renderWithProviders(<LoginPage />, { member: null, signedIn: false });
  await userEvent.type(screen.getByLabelText("אימייל"), "Rachel@Test.local");
  await userEvent.click(screen.getByRole("button", { name: "שלחו לי קישור כניסה" }));
  expect(signInWithOtp).toHaveBeenCalledWith(expect.objectContaining({ email: "rachel@test.local" }));
  expect(await screen.findByText(/שלחנו קישור/)).toBeInTheDocument();
});

test("shows the members-only message when the hook rejects", async () => {
  signInWithOtp.mockResolvedValue({ error: { status: 403, message: "הגישה מותרת לחברי הקבוצה בלבד" } });
  renderWithProviders(<LoginPage />, { member: null, signedIn: false });
  await userEvent.type(screen.getByLabelText("אימייל"), "stranger@x.com");
  await userEvent.click(screen.getByRole("button", { name: "שלחו לי קישור כניסה" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("הגישה מותרת לחברי הקבוצה בלבד");
});
```

- [ ] **Step 3: Run to verify failure** — `npm test` → FAIL.

- [ ] **Step 4: Implement**

`src/auth/AuthProvider.tsx`:

```tsx
import type { Session } from "@supabase/supabase-js";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Member } from "../lib/types";

export interface AuthState {
  loading: boolean;
  session: Session | null;
  member: Member | null;
  signOut(): Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load(s: Session | null) {
      setSession(s);
      if (!s) {
        setMember(null);
        setLoading(false);
        return;
      }
      const { data } = await supabase.from("members").select("id, email, display_name, role").eq("id", s.user.id).maybeSingle();
      if (!cancelled) {
        setMember((data as Member | null) ?? null);
        setLoading(false);
      }
    }
    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setLoading(true);
      // defer: supabase-js forbids awaiting its own calls inside this callback
      setTimeout(() => load(s), 0);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthState = {
    loading, session, member,
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
```

`src/auth/RequireMember.tsx`:

```tsx
import { Navigate, Outlet } from "react-router";
import { useAuth } from "./AuthProvider";

export function RequireMember() {
  const { loading, session, member, signOut } = useAuth();
  if (loading) return <div className="p-8 text-center text-muted" role="status">טוען…</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!member) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <h1 className="mb-3 text-xl font-bold">הגישה מותרת לחברי הקבוצה בלבד</h1>
        <p className="mb-6 text-muted">
          נכנסת עם {session.user.email}. אם זו טעות, בקשו ממנהל הקבוצה להוסיף את הכתובת.
        </p>
        <button className="min-h-11 rounded-full border border-line px-5" onClick={() => signOut()}>התנתקות</button>
      </main>
    );
  }
  return <Outlet />;
}
```

`src/pages/LoginPage.tsx`:

```tsx
import { type FormEvent, useState } from "react";
import { Navigate } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { APP_NAME } from "../lib/app";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const { session, member } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session && member) return <Navigate to="/" replace />;

  async function sendLink(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (!error) return setSent(true);
    setError(error.status === 403 || error.status === 422
      ? "הגישה מותרת לחברי הקבוצה בלבד"
      : "לא הצלחנו לשלוח קישור. נסו שוב בעוד רגע.");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-center text-3xl font-bold">{APP_NAME}</h1>
      {sent
        ? <p className="rounded-2xl bg-accent-soft p-4 text-center">שלחנו קישור כניסה ל-{email}. פתחו אותו מהטלפון הזה.</p>
        : (
          <form onSubmit={sendLink} className="flex flex-col gap-3">
            <label htmlFor="email" className="font-medium">אימייל</label>
            <input id="email" type="email" required autoComplete="email" dir="ltr" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-12 rounded-xl border border-line bg-white px-4" />
            <button disabled={busy} className="min-h-12 rounded-full bg-accent font-medium text-white disabled:opacity-60">
              שלחו לי קישור כניסה
            </button>
          </form>
        )}
      {error && <p role="alert" className="text-center text-red-700">{error}</p>}
      <div className="flex items-center gap-3 text-muted"><hr className="flex-1 border-line" />או<hr className="flex-1 border-line" /></div>
      <button
        className="min-h-12 rounded-full border border-line bg-white font-medium"
        onClick={() => supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } })}
      >
        כניסה עם Google
      </button>
    </main>
  );
}
```

`src/components/Layout.tsx`:

```tsx
import { NavLink, Outlet } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { APP_NAME } from "../lib/app";

const tab = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-14 flex-1 flex-col items-center justify-center text-sm ${isActive ? "text-accent font-medium" : "text-muted"}`;

export function Layout() {
  const { member } = useAuth();
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col">
      <header className="sticky top-0 z-10 bg-paper/95 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <h1 className="text-xl font-bold">{APP_NAME}</h1>
      </header>
      <main className="flex-1 px-4 pb-24">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
        <NavLink to="/" end className={tab}>בית</NavLink>
        <NavLink to="/favorites" className={tab}>מועדפים</NavLink>
        <NavLink to="/add" className={tab}>הוספה</NavLink>
        {member?.role === "admin" && <NavLink to="/admin" className={tab}>ניהול</NavLink>}
      </nav>
    </div>
  );
}
```

`src/App.tsx` (pages from later tasks are imported as they are created; until then keep placeholders):

```tsx
import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";
import { RequireMember } from "./auth/RequireMember";
import { Layout } from "./components/Layout";
import LoginPage from "./pages/LoginPage";

const FeedPage = lazy(() => import("./pages/FeedPage"));
const RecipePage = lazy(() => import("./pages/RecipePage"));
const CookingPage = lazy(() => import("./pages/CookingPage"));
const AddRecipePage = lazy(() => import("./pages/AddRecipePage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));

export default function App() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted" role="status">טוען…</div>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireMember />}>
          <Route path="/recipe/:id/cook" element={<CookingPage />} />
          <Route element={<Layout />}>
            <Route path="/" element={<FeedPage />} />
            <Route path="/favorites" element={<FeedPage favoritesOnly />} />
            <Route path="/recipe/:id" element={<RecipePage />} />
            <Route path="/add" element={<AddRecipePage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
```

Create placeholder default exports for the five lazy pages so the build passes (each: `export default function X() { return null; }`); later tasks replace them.

`src/main.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App";
import { AuthProvider } from "./auth/AuthProvider";
import "./index.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
```

Delete `src/App.test.tsx`.

- [ ] **Step 5: Run tests + build** — `npm test && npm run build` → PASS, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(app): auth context, members-only guard, magic-link/Google login and app shell"
```

---

### Task 4: Feed and favourites (search, categories, infinite list, favourite toggle)

**Files:**
- Create: `src/hooks/useDebounced.ts`, `src/hooks/useFavorites.ts`, `src/components/SearchBar.tsx`, `src/components/CategoryChips.tsx`, `src/components/RecipeCard.tsx`, `src/components/FavoriteButton.tsx`, `src/pages/FeedPage.tsx`
- Test: `src/hooks/useDebounced.test.ts`, `src/pages/FeedPage.test.tsx`

**Interfaces:**
- Consumes: `listRecipes`, `listFavoriteIds`, `setFavorite`, `imageUrl`, `totalMinutes`, `formatMinutes`, `CATEGORIES`, `useAuth`.
- Produces: `useDebounced<T>(value: T, ms: number): T`; `useFavorites(): { ids: Set<string>; toggle(recipeId: string): void }`; `<FeedPage favoritesOnly?: boolean>`; `<RecipeCard recipe isFavorite onToggleFavorite>`.

- [ ] **Step 1: Write failing tests**

`src/hooks/useDebounced.test.ts`:

```ts
import { act, renderHook } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { useDebounced } from "./useDebounced";

test("only emits the last value after the pause", () => {
  vi.useFakeTimers();
  const { result, rerender } = renderHook(({ v }) => useDebounced(v, 300), { initialProps: { v: "" } });
  rerender({ v: "ש" });
  rerender({ v: "שק" });
  rerender({ v: "שקשוקה 50%" });
  expect(result.current).toBe("");
  act(() => vi.advanceTimersByTime(300));
  expect(result.current).toBe("שקשוקה 50%");
  vi.useRealTimers();
});
```

`src/pages/FeedPage.test.tsx`:

```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import type { Recipe } from "../lib/types";
import { renderWithProviders } from "../test/render";
import FeedPage from "./FeedPage";

const listRecipes = vi.fn();
const setFavorite = vi.fn();
vi.mock("../lib/recipes", async (orig) => ({
  ...(await orig<typeof import("../lib/recipes")>()),
  listRecipes: (...a: unknown[]) => listRecipes(...a),
  listFavoriteIds: async () => new Set(["r2"]),
  setFavorite: (...a: unknown[]) => setFavorite(...a),
}));

const recipe = (id: string, title: string, over: Partial<Recipe> = {}): Recipe => ({
  id, title, status: "published", source_url: "https://a.test", source_platform: "web", description: null,
  ingredients: [], steps: [], prep_minutes: 10, cook_minutes: 20, servings: 4, category: "מרקים", tags: [],
  image_path: null, error: null, created_at: "", published_at: "", ...over,
});

beforeEach(() => {
  listRecipes.mockReset();
  setFavorite.mockReset().mockResolvedValue(undefined);
});

test("shows recipe cards with total time; no image renders a placeholder", async () => {
  listRecipes.mockResolvedValue([recipe("r1", "מרק עדשים"), recipe("r2", "עוגת שמרים", { prep_minutes: null, cook_minutes: null })]);
  renderWithProviders(<FeedPage />);
  expect(await screen.findByRole("link", { name: /מרק עדשים/ })).toHaveAttribute("href", "/recipe/r1");
  expect(screen.getByText("30 דק׳")).toBeInTheDocument();
  expect(screen.queryByText(/NaN|null/)).not.toBeInTheDocument();
});

test("category chip filters and search is passed through", async () => {
  listRecipes.mockResolvedValue([]);
  renderWithProviders(<FeedPage />);
  await userEvent.click(await screen.findByRole("button", { name: "מרקים" }));
  await waitFor(() => expect(listRecipes).toHaveBeenLastCalledWith(expect.objectContaining({ category: "מרקים", page: 0 })));
  await userEvent.type(screen.getByRole("searchbox"), "עדשים");
  await waitFor(() => expect(listRecipes).toHaveBeenLastCalledWith(expect.objectContaining({ q: "עדשים" })), { timeout: 2000 });
});

test("empty state", async () => {
  listRecipes.mockResolvedValue([]);
  renderWithProviders(<FeedPage />);
  expect(await screen.findByText("עוד אין כאן מתכונים")).toBeInTheDocument();
});

test("favourite toggle calls setFavorite with the member id", async () => {
  listRecipes.mockResolvedValue([recipe("r1", "מרק עדשים")]);
  renderWithProviders(<FeedPage />);
  await userEvent.click(await screen.findByRole("button", { name: "הוספה למועדפים" }));
  expect(setFavorite).toHaveBeenCalledWith("m1", "r1", true);
});

test("favourites page asks for favourites only", async () => {
  listRecipes.mockResolvedValue([]);
  renderWithProviders(<FeedPage favoritesOnly />);
  await waitFor(() => expect(listRecipes).toHaveBeenCalledWith(expect.objectContaining({ favoritesOnly: true })));
  expect(await screen.findByText("עוד לא סימנת מתכונים כמועדפים")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL.

- [ ] **Step 3: Implement**

`src/hooks/useDebounced.ts`:

```ts
import { useEffect, useState } from "react";

export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
```

`src/hooks/useFavorites.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthProvider";
import { listFavoriteIds, setFavorite } from "../lib/recipes";

export function useFavorites() {
  const { member } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["favorites"], queryFn: listFavoriteIds });
  const ids = data ?? new Set<string>();

  const mutation = useMutation({
    mutationFn: ({ recipeId, on }: { recipeId: string; on: boolean }) => setFavorite(member!.id, recipeId, on),
    onMutate: async ({ recipeId, on }) => {
      await qc.cancelQueries({ queryKey: ["favorites"] });
      const prev = qc.getQueryData<Set<string>>(["favorites"]);
      const next = new Set(prev);
      on ? next.add(recipeId) : next.delete(recipeId);
      qc.setQueryData(["favorites"], next);
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(["favorites"], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ["recipes"] }),
  });

  return { ids, toggle: (recipeId: string) => mutation.mutate({ recipeId, on: !ids.has(recipeId) }) };
}
```

`src/components/FavoriteButton.tsx`:

```tsx
export function FavoriteButton({ active, onClick }: { active: boolean; onClick(): void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? "הסרה מהמועדפים" : "הוספה למועדפים"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className="grid size-11 place-items-center rounded-full bg-white/90 text-xl shadow-sm"
    >
      {active ? "❤️" : "🤍"}
    </button>
  );
}
```

`src/components/RecipeCard.tsx`:

```tsx
import { Link } from "react-router";
import { formatMinutes, imageUrl, totalMinutes } from "../lib/recipes";
import type { Recipe } from "../lib/types";
import { FavoriteButton } from "./FavoriteButton";

export function RecipeCard({ recipe, isFavorite, onToggleFavorite }: {
  recipe: Recipe; isFavorite: boolean; onToggleFavorite(): void;
}) {
  const img = imageUrl(recipe.image_path);
  const total = totalMinutes(recipe);
  return (
    // The favourite button is a sibling of the link (no interactive element nested inside <a>).
    <div className="relative overflow-hidden rounded-2xl bg-white shadow-sm">
      <Link to={`/recipe/${recipe.id}`} className="block">
        <div className="aspect-square bg-accent-soft">
          {img
            ? <img src={img} alt="" loading="lazy" className="size-full object-cover" />
            : <div className="grid size-full place-items-center text-5xl" aria-hidden>🍽️</div>}
        </div>
        <div className="p-3">
          <h2 className="line-clamp-2 font-medium leading-snug">{recipe.title}</h2>
          {total && <p className="mt-1 text-sm text-muted">{formatMinutes(total)}</p>}
        </div>
      </Link>
      <div className="absolute end-2 top-2">
        <FavoriteButton active={isFavorite} onClick={onToggleFavorite} />
      </div>
    </div>
  );
}
```

`src/components/SearchBar.tsx`:

```tsx
export function SearchBar({ value, onChange }: { value: string; onChange(v: string): void }) {
  return (
    <input
      type="search"
      inputMode="search"
      placeholder="חיפוש מתכון או מרכיב…"
      aria-label="חיפוש"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-12 w-full rounded-full border border-line bg-white px-5"
    />
  );
}
```

`src/components/CategoryChips.tsx`:

```tsx
import { CATEGORIES } from "../lib/categories";

export function CategoryChips({ value, onChange }: { value: string | null; onChange(v: string | null): void }) {
  const chip = (active: boolean) =>
    `min-h-10 shrink-0 rounded-full border px-4 text-sm ${active ? "border-accent bg-accent text-white" : "border-line bg-white"}`;
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      <button type="button" className={chip(value === null)} aria-pressed={value === null} onClick={() => onChange(null)}>הכל</button>
      {CATEGORIES.map((c) => (
        <button key={c} type="button" className={chip(value === c)} aria-pressed={value === c}
          onClick={() => onChange(value === c ? null : c)}>{c}</button>
      ))}
    </div>
  );
}
```

`src/pages/FeedPage.tsx`:

```tsx
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { CategoryChips } from "../components/CategoryChips";
import { PushPrompt } from "../components/PushPrompt";
import { RecipeCard } from "../components/RecipeCard";
import { SearchBar } from "../components/SearchBar";
import { useDebounced } from "../hooks/useDebounced";
import { useFavorites } from "../hooks/useFavorites";
import { listRecipes, PAGE_SIZE } from "../lib/recipes";

export default function FeedPage({ favoritesOnly = false }: { favoritesOnly?: boolean }) {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const category = params.get("cat");
  const debouncedQ = useDebounced(q, 300);
  const favorites = useFavorites();

  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    setParams(next, { replace: true });
  };

  const query = useInfiniteQuery({
    queryKey: ["recipes", debouncedQ, category, favoritesOnly],
    queryFn: ({ pageParam }) => listRecipes({ q: debouncedQ, category, favoritesOnly, page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length === PAGE_SIZE ? all.length : undefined),
  });
  const recipes = query.data?.pages.flat() ?? [];

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sentinel.current || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
    }, { rootMargin: "400px" });
    io.observe(sentinel.current);
    return () => io.disconnect();
  }, [query]);

  const empty = favoritesOnly ? "עוד לא סימנת מתכונים כמועדפים" : "עוד אין כאן מתכונים";

  return (
    <div className="flex flex-col gap-3 pt-2">
      {!favoritesOnly && <PushPrompt />}
      <SearchBar value={q} onChange={(v) => update("q", v || null)} />
      <CategoryChips value={category} onChange={(v) => update("cat", v)} />
      {query.isPending && <p role="status" className="py-8 text-center text-muted">טוען…</p>}
      {query.isError && <p role="alert" className="py-8 text-center text-red-700">לא הצלחנו לטעון מתכונים.</p>}
      {query.isSuccess && recipes.length === 0 && <p className="py-12 text-center text-muted">{empty}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {recipes.map((r) => (
          <RecipeCard key={r.id} recipe={r} isFavorite={favorites.ids.has(r.id)} onToggleFavorite={() => favorites.toggle(r.id)} />
        ))}
      </div>
      <div ref={sentinel} />
      {query.hasNextPage && (
        <button className="mx-auto min-h-11 rounded-full border border-line px-5" onClick={() => query.fetchNextPage()}>
          טען עוד
        </button>
      )}
    </div>
  );
}
```

`FeedPage` imports `PushPrompt` (built in Task 9). Create a placeholder now: `src/components/PushPrompt.tsx` with `export function PushPrompt() { return null; }`.

- [ ] **Step 4: Run tests** — `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(app): feed with debounced search, category chips, infinite list and favourites"
```

---

### Task 5: Recipe page

**Files:**
- Create: `src/pages/RecipePage.tsx`
- Test: `src/pages/RecipePage.test.tsx`

**Interfaces:**
- Consumes: `getRecipe`, `getShares`, `groupIngredients`, `formatIngredient`, `formatMinutes`, `formatAttribution`, `imageUrl`, `useFavorites`, `FavoriteButton`.
- Produces: route `/recipe/:id`, link "התחילו לבשל" → `/recipe/:id/cook`.

- [ ] **Step 1: Write failing test** — `src/pages/RecipePage.test.tsx`

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { Recipe } from "../lib/types";
import { renderWithProviders } from "../test/render";
import RecipePage from "./RecipePage";

let current: Recipe;
vi.mock("../lib/recipes", async (orig) => ({
  ...(await orig<typeof import("../lib/recipes")>()),
  getRecipe: async () => current,
  getShares: async () => [{ id: "s1", recipe_id: "r1", shared_by_name: "רחל", shared_at: "2026-10-12T09:00:00Z", via: "whatsapp" }],
  listFavoriteIds: async () => new Set(),
  setFavorite: async () => {},
}));

const full: Recipe = {
  id: "r1", status: "published", source_url: "https://www.mako.co.il/x", source_platform: "web",
  title: "פשטידת תרד", description: "רכה ועשירה.", prep_minutes: 15, cook_minutes: 40, servings: 6,
  category: "מנות עיקריות", tags: ["חלבי"], image_path: "r1/a.webp", error: null, created_at: "", published_at: "",
  ingredients: [
    { group: "לבסיס", name: "תרד", amount: "500", unit: "גרם", note: null },
    { group: "לציפוי", name: "גבינה צהובה", amount: "1", unit: "כוס", note: "מגוררת" },
  ],
  steps: [{ text: "מחממים תנור ל-180 מעלות." }, { text: "מערבבים ואופים 40 דקות." }],
};

test("renders grouped ingredients, numbered steps, times and attribution", async () => {
  current = full;
  renderWithProviders(<RecipePage />, { route: "/recipe/r1", path: "/recipe/:id" });
  expect(await screen.findByRole("heading", { level: 1, name: "פשטידת תרד" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "לבסיס" })).toBeInTheDocument();
  expect(screen.getByLabelText("1 כוס גבינה צהובה (מגוררת)")).toBeInTheDocument();
  expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toContain("מחממים תנור ל-180 מעלות.");
  expect(screen.getByText("55 דק׳")).toBeInTheDocument();
  expect(screen.getByText("6 מנות")).toBeInTheDocument();
  expect(screen.getByText("מקור: mako.co.il · שותף ע״י רחל ב-12.10.2026")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "התחילו לבשל" })).toHaveAttribute("href", "/recipe/r1/cook");
});

test("ingredient checkbox ticks off", async () => {
  current = full;
  renderWithProviders(<RecipePage />, { route: "/recipe/r1", path: "/recipe/:id" });
  const box = await screen.findByLabelText("500 גרם תרד");
  await userEvent.click(box);
  expect(box).toBeChecked();
});

test("minimal recipe renders without empty sections or null text", async () => {
  current = {
    ...full, description: null, prep_minutes: null, cook_minutes: null, servings: null, image_path: null, tags: [],
    ingredients: [{ group: null, name: "מלח", amount: null, unit: null, note: null }], steps: [{ text: "מפזרים." }],
  };
  renderWithProviders(<RecipePage />, { route: "/recipe/r1", path: "/recipe/:id" });
  expect(await screen.findByLabelText("מלח")).toBeInTheDocument();
  expect(screen.queryByText(/null|NaN|undefined/)).not.toBeInTheDocument();
  expect(screen.queryByText(/\d+ מנות/)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL.

- [ ] **Step 3: Implement** — `src/pages/RecipePage.tsx`

```tsx
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { FavoriteButton } from "../components/FavoriteButton";
import { useFavorites } from "../hooks/useFavorites";
import {
  formatAttribution, formatIngredient, formatMinutes, getRecipe, getShares, groupIngredients, imageUrl, totalMinutes,
} from "../lib/recipes";

export default function RecipePage() {
  const { id = "" } = useParams();
  const recipe = useQuery({ queryKey: ["recipe", id], queryFn: () => getRecipe(id) });
  const shares = useQuery({ queryKey: ["shares", id], queryFn: () => getShares(id) });
  const favorites = useFavorites();
  const [checked, setChecked] = useState<Set<number>>(new Set());

  if (recipe.isPending) return <p role="status" className="py-8 text-center text-muted">טוען…</p>;
  if (recipe.isError) return <p role="alert" className="py-8 text-center text-red-700">המתכון לא נמצא.</p>;

  const r = recipe.data;
  const img = imageUrl(r.image_path);
  const total = totalMinutes(r);
  let index = -1;

  return (
    <article className="flex flex-col gap-5 pt-2">
      <div className="relative -mx-4 aspect-[4/3] bg-accent-soft sm:mx-0 sm:rounded-2xl sm:overflow-hidden">
        {img ? <img src={img} alt="" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-7xl" aria-hidden>🍽️</div>}
        <div className="absolute end-3 top-3">
          <FavoriteButton active={favorites.ids.has(r.id)} onClick={() => favorites.toggle(r.id)} />
        </div>
      </div>

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold leading-tight">{r.title}</h1>
        {r.description && <p className="text-muted">{r.description}</p>}
        <div className="flex flex-wrap gap-2 text-sm">
          {total && <span className="rounded-full bg-white px-3 py-1">{formatMinutes(total)}</span>}
          {r.servings && <span className="rounded-full bg-white px-3 py-1">{r.servings} מנות</span>}
          {r.category && <span className="rounded-full bg-white px-3 py-1">{r.category}</span>}
          {r.tags.map((t) => <span key={t} className="rounded-full bg-accent-soft px-3 py-1">{t}</span>)}
        </div>
      </header>

      <Link to={`/recipe/${r.id}/cook`} className="grid min-h-12 place-items-center rounded-full bg-accent font-medium text-white">
        התחילו לבשל
      </Link>

      <section>
        <h2 className="mb-2 text-lg font-bold">מרכיבים</h2>
        {groupIngredients(r.ingredients).map((g, gi) => (
          <div key={gi} className="mb-3">
            {g.group && <h3 className="mb-1 font-medium">{g.group}</h3>}
            <ul className="flex flex-col">
              {g.items.map((ing) => {
                index++;
                const i = index;
                const text = formatIngredient(ing);
                return (
                  <li key={i} className="border-b border-line last:border-0">
                    <label className="flex min-h-11 items-center gap-3">
                      <input type="checkbox" aria-label={text} checked={checked.has(i)} className="size-5 accent-accent"
                        onChange={() => setChecked((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; })} />
                      <span className={checked.has(i) ? "text-muted line-through" : ""}>{text}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">אופן ההכנה</h2>
        <ol className="flex list-decimal flex-col gap-3 ps-5">
          {r.steps.map((s, i) => <li key={i}>{s.text}</li>)}
        </ol>
      </section>

      <footer className="border-t border-line pt-3 text-sm text-muted">
        <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="underline">
          {formatAttribution(r, shares.data?.[0] ?? null)}
        </a>
      </footer>
    </article>
  );
}
```

- [ ] **Step 4: Run tests** — `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(app): recipe page with grouped tick-off ingredients, steps and attribution"
```

---

### Task 6: Cooking mode with Wake Lock

**Files:**
- Create: `src/hooks/useWakeLock.ts`, `src/components/CookingMode.tsx`, `src/pages/CookingPage.tsx`
- Test: `src/components/CookingMode.test.tsx`

**Interfaces:**
- Consumes: `getRecipe`, `formatIngredient`, `Ingredient`, `Step`.
- Produces: `useWakeLock(active: boolean): void`; `relevantIngredients(step: Step, ingredients: Ingredient[]): Ingredient[]`; `<CookingMode title steps ingredients onExit>`.
- RTL navigation rule: "הבא" button sits on the **start** (right) side visually-left-is-forward; swipe finger right → next step, swipe left → previous; `ArrowLeft` → next, `ArrowRight` → previous.

- [ ] **Step 1: Write failing tests** — `src/components/CookingMode.test.tsx`

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { CookingMode, relevantIngredients } from "./CookingMode";

const steps = [{ text: "קוצצים את הבצל." }, { text: "מטגנים את הבצל עם השום." }, { text: "מגישים." }];
const ingredients = [
  { group: null, name: "בצל", amount: "1", unit: null, note: null },
  { group: null, name: "שום", amount: "2", unit: "שיני", note: null },
];

afterEach(() => {
  // @ts-expect-error test cleanup
  delete navigator.wakeLock;
});

test("relevantIngredients matches names inside the step (with Hebrew prefixes)", () => {
  expect(relevantIngredients(steps[1], ingredients).map((i) => i.name)).toEqual(["בצל", "שום"]);
  expect(relevantIngredients(steps[2], ingredients)).toEqual([]);
});

test("steps forward and back with buttons, keys and swipes", async () => {
  render(<CookingMode title="ממרח" steps={steps} ingredients={ingredients} onExit={() => {}} />);
  expect(screen.getByText("שלב 1 מתוך 3")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "הבא" }));
  expect(screen.getByText("מטגנים את הבצל עם השום.")).toBeInTheDocument();
  expect(screen.getByText("2 שיני שום")).toBeInTheDocument();
  fireEvent.keyDown(window, { key: "ArrowRight" });
  expect(screen.getByText("שלב 1 מתוך 3")).toBeInTheDocument();
  const area = screen.getByTestId("swipe-area");
  fireEvent.touchStart(area, { touches: [{ clientX: 100, clientY: 0 }] });
  fireEvent.touchEnd(area, { changedTouches: [{ clientX: 220, clientY: 0 }] });
  expect(screen.getByText("שלב 2 מתוך 3")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "הקודם" })).toBeEnabled();
});

test("last step offers finishing", async () => {
  const onExit = vi.fn();
  render(<CookingMode title="ממרח" steps={[{ text: "מגישים." }]} ingredients={[]} onExit={onExit} />);
  await userEvent.click(screen.getByRole("button", { name: "סיימתי" }));
  expect(onExit).toHaveBeenCalled();
});

test("requests a screen wake lock and releases it on unmount", async () => {
  const release = vi.fn().mockResolvedValue(undefined);
  const request = vi.fn().mockResolvedValue({ release, addEventListener: () => {} });
  Object.defineProperty(navigator, "wakeLock", { value: { request }, configurable: true });
  const { unmount } = render(<CookingMode title="x" steps={steps} ingredients={[]} onExit={() => {}} />);
  await waitFor(() => expect(request).toHaveBeenCalledWith("screen"));
  unmount();
  await waitFor(() => expect(release).toHaveBeenCalled());
});

test("works when wake lock is unsupported or rejected", async () => {
  Object.defineProperty(navigator, "wakeLock", { value: { request: vi.fn().mockRejectedValue(new Error("NotAllowed")) }, configurable: true });
  render(<CookingMode title="x" steps={steps} ingredients={[]} onExit={() => {}} />);
  await userEvent.click(screen.getByRole("button", { name: "הבא" }));
  expect(screen.getByText("שלב 2 מתוך 3")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL.

- [ ] **Step 3: Implement**

`src/hooks/useWakeLock.ts`:

```ts
import { useEffect } from "react";

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;

    const acquire = async () => {
      try {
        const s = await navigator.wakeLock.request("screen");
        if (disposed) await s.release();
        else sentinel = s;
      } catch {
        // unsupported, battery saver or page not visible: cooking mode still works
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") acquire();
    };

    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisible);
      sentinel?.release().catch(() => {});
    };
  }, [active]);
}
```

`src/components/CookingMode.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { useWakeLock } from "../hooks/useWakeLock";
import { formatIngredient } from "../lib/recipes";
import type { Ingredient, Step } from "../lib/types";

export function relevantIngredients(step: Step, ingredients: Ingredient[]): Ingredient[] {
  return ingredients.filter((i) => i.name.length > 1 && step.text.includes(i.name));
}

export function CookingMode({ title, steps, ingredients, onExit }: {
  title: string; steps: Step[]; ingredients: Ingredient[]; onExit(): void;
}) {
  const [i, setI] = useState(0);
  const touchX = useRef<number | null>(null);
  useWakeLock(true);

  const last = steps.length - 1;
  const next = () => setI((n) => Math.min(n + 1, last));
  const prev = () => setI((n) => Math.max(n - 1, 0));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") next();
      if (e.key === "ArrowRight") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const step = steps[i];
  const related = relevantIngredients(step, ingredients);

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-paper pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <header className="flex items-center justify-between px-4 py-3">
        <h1 className="line-clamp-1 font-medium">{title}</h1>
        <button onClick={onExit} className="min-h-11 rounded-full border border-line px-4">יציאה</button>
      </header>
      <p className="px-4 text-sm text-muted" aria-live="polite">שלב {i + 1} מתוך {steps.length}</p>
      <div
        data-testid="swipe-area"
        className="flex flex-1 flex-col justify-center gap-6 px-6"
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (dx > 60) next();
          if (dx < -60) prev();
          touchX.current = null;
        }}
      >
        <p className="text-3xl font-medium leading-snug">{step.text}</p>
        {related.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {related.map((r, k) => <li key={k} className="rounded-full bg-accent-soft px-3 py-1">{formatIngredient(r)}</li>)}
          </ul>
        )}
      </div>
      <nav className="flex gap-3 p-4">
        {i < last
          ? <button onClick={next} className="min-h-14 flex-1 rounded-full bg-accent text-lg font-medium text-white">הבא</button>
          : <button onClick={onExit} className="min-h-14 flex-1 rounded-full bg-accent text-lg font-medium text-white">סיימתי</button>}
        <button onClick={prev} disabled={i === 0} className="min-h-14 flex-1 rounded-full border border-line text-lg disabled:opacity-40">הקודם</button>
      </nav>
    </div>
  );
}
```

`src/pages/CookingPage.tsx`:

```tsx
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { CookingMode } from "../components/CookingMode";
import { getRecipe } from "../lib/recipes";

export default function CookingPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data, isPending, isError } = useQuery({ queryKey: ["recipe", id], queryFn: () => getRecipe(id) });
  if (isPending) return <p role="status" className="p-8 text-center text-muted">טוען…</p>;
  if (isError || data.steps.length === 0) return <p role="alert" className="p-8 text-center">אין שלבים למתכון הזה.</p>;
  return <CookingMode title={data.title ?? ""} steps={data.steps} ingredients={data.ingredients} onExit={() => navigate(`/recipe/${id}`)} />;
}
```

- [ ] **Step 4: Run tests** — `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(app): full-screen cooking mode with swipe/keys and screen wake lock"
```

---

### Task 7: Add a recipe (paste link, share target, live status)

**Files:**
- Create: `src/lib/share.ts`, `src/components/StatusCard.tsx`, `src/pages/AddRecipePage.tsx`
- Test: `src/lib/share.test.ts`, `src/pages/AddRecipePage.test.tsx`

**Interfaces:**
- Consumes: `ingestLink`, `IngestResult`, `STATUS_LABEL`, `supabase` (Realtime), `getRecipe`.
- Produces: `extractFirstUrl(text: string): string | null`; `prefillFromShare(params: URLSearchParams): { url: string; note: string }`; `<StatusCard recipeId initialStatus duplicate>` subscribing to `postgres_changes` on `recipes` `id=eq.<id>`.

- [ ] **Step 1: Write failing tests**

`src/lib/share.test.ts`:

```ts
import { expect, test } from "vitest";
import { extractFirstUrl, prefillFromShare } from "./share";

test("extractFirstUrl", () => {
  expect(extractFirstUrl("תראו https://www.instagram.com/reel/abc/?igsh=x יאמי")).toBe("https://www.instagram.com/reel/abc/?igsh=x");
  expect(extractFirstUrl("אין קישור")).toBeNull();
});

test("Android: link inside text with extra words", () => {
  const p = new URLSearchParams({ text: "Check out this recipe! https://vm.tiktok.com/ZS123/" });
  expect(prefillFromShare(p)).toEqual({ url: "https://vm.tiktok.com/ZS123/", note: "Check out this recipe!" });
});

test("iOS: url param, title becomes the note", () => {
  const p = new URLSearchParams({ url: "https://www.mako.co.il/food/1", title: "עוגת גבינה" });
  expect(prefillFromShare(p)).toEqual({ url: "https://www.mako.co.il/food/1", note: "עוגת גבינה" });
});

test("link only in title", () => {
  expect(prefillFromShare(new URLSearchParams({ title: "https://a.test/r" })).url).toBe("https://a.test/r");
});

test("nothing shared", () => {
  expect(prefillFromShare(new URLSearchParams())).toEqual({ url: "", note: "" });
});
```

`src/pages/AddRecipePage.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { renderWithProviders } from "../test/render";
import AddRecipePage from "./AddRecipePage";

const ingestLink = vi.fn();
vi.mock("../lib/recipes", async (orig) => ({
  ...(await orig<typeof import("../lib/recipes")>()),
  ingestLink: (...a: unknown[]) => ingestLink(...a),
}));
vi.mock("../components/StatusCard", () => ({
  StatusCard: ({ recipeId, duplicate }: { recipeId: string; duplicate: boolean }) =>
    <div>STATUS {recipeId} {duplicate ? "dup" : "new"}</div>,
}));

beforeEach(() => ingestLink.mockReset());

test("pre-fills from a share and submits link + note", async () => {
  ingestLink.mockResolvedValue([{ url: "https://vm.tiktok.com/ZS1/", recipe_id: "r9", status: "queued", duplicate: false }]);
  renderWithProviders(<AddRecipePage />, { route: "/add?text=" + encodeURIComponent("מדהים https://vm.tiktok.com/ZS1/") });
  expect(screen.getByLabelText("קישור למתכון")).toHaveValue("https://vm.tiktok.com/ZS1/");
  expect(screen.getByLabelText("הערה (לא חובה)")).toHaveValue("מדהים");
  await userEvent.click(screen.getByRole("button", { name: "הוספה" }));
  expect(ingestLink).toHaveBeenCalledWith("מדהים\nhttps://vm.tiktok.com/ZS1/");
  expect(await screen.findByText("STATUS r9 new")).toBeInTheDocument();
});

test("rejects input without a link", async () => {
  renderWithProviders(<AddRecipePage />, { route: "/add" });
  await userEvent.type(screen.getByLabelText("קישור למתכון"), "סתם טקסט");
  await userEvent.click(screen.getByRole("button", { name: "הוספה" }));
  expect(screen.getByRole("alert")).toHaveTextContent("לא נמצא קישור");
  expect(ingestLink).not.toHaveBeenCalled();
});

test("shows an error when the server fails", async () => {
  ingestLink.mockRejectedValue(new Error("500"));
  renderWithProviders(<AddRecipePage />, { route: "/add?url=https%3A%2F%2Fa.test%2Fr" });
  await userEvent.click(screen.getByRole("button", { name: "הוספה" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("משהו השתבש");
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL.

- [ ] **Step 3: Implement**

`src/lib/share.ts`:

```ts
const URL_RE = /https?:\/\/[^\s<>"'“”]+/i;

export function extractFirstUrl(text: string): string | null {
  return text.match(URL_RE)?.[0] ?? null;
}

export function prefillFromShare(params: URLSearchParams): { url: string; note: string } {
  const fields = ["url", "text", "title"].map((k) => params.get(k)?.trim() ?? "");
  const url = fields.map(extractFirstUrl).find(Boolean) ?? "";
  const note = [params.get("title"), params.get("text")]
    .map((s) => (s ?? "").replace(url, "").trim())
    .filter((s) => s && !extractFirstUrl(s))
    .join(" ")
    .trim();
  return { url, note };
}
```

`src/components/StatusCard.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { getRecipe } from "../lib/recipes";
import { STATUS_LABEL } from "../lib/status";
import { supabase } from "../lib/supabase";
import type { RecipeStatus } from "../lib/types";

export function StatusCard({ recipeId, initialStatus, duplicate }: {
  recipeId: string; initialStatus: RecipeStatus; duplicate: boolean;
}) {
  const [status, setStatus] = useState<RecipeStatus>(initialStatus);
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    getRecipe(recipeId).then((r) => { setStatus(r.status); setTitle(r.title); }).catch(() => {});
    const channel = supabase.channel(`recipe-${recipeId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "recipes", filter: `id=eq.${recipeId}` },
        (payload) => {
          const row = payload.new as { status: RecipeStatus; title: string | null };
          setStatus(row.status);
          setTitle(row.title);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [recipeId]);

  const done = status === "published";
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-white p-4 shadow-sm" aria-live="polite">
      {duplicate && <p className="text-sm text-muted">המתכון הזה כבר קיים — רשמנו שגם את/ה שיתפת.</p>}
      <p className="font-medium">{title ?? "מתכון חדש"}</p>
      <p className={done ? "text-green-700" : status === "failed" || status === "needs_review" ? "text-red-700" : "text-muted"}>
        {STATUS_LABEL[status]}
      </p>
      {done && <Link to={`/recipe/${recipeId}`} className="text-accent underline">לצפייה במתכון</Link>}
    </div>
  );
}
```

`src/pages/AddRecipePage.tsx`:

```tsx
import { type FormEvent, useState } from "react";
import { useSearchParams } from "react-router";
import { StatusCard } from "../components/StatusCard";
import { type IngestResult, ingestLink } from "../lib/recipes";
import { extractFirstUrl, prefillFromShare } from "../lib/share";

export default function AddRecipePage() {
  const [params] = useSearchParams();
  const initial = prefillFromShare(params);
  const [url, setUrl] = useState(initial.url);
  const [note, setNote] = useState(initial.note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<IngestResult[]>([]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!extractFirstUrl(url)) return setError("לא נמצא קישור. הדביקו קישור שמתחיל ב-https://");
    setBusy(true);
    try {
      const res = await ingestLink([note.trim(), url.trim()].filter(Boolean).join("\n"));
      setResults((prev) => [...res, ...prev]);
      setUrl("");
      setNote("");
    } catch {
      setError("משהו השתבש. נסו שוב בעוד רגע.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <h2 className="text-lg font-bold">הוספת מתכון</h2>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label htmlFor="url" className="font-medium">קישור למתכון</label>
        <input id="url" dir="ltr" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…" className="min-h-12 rounded-xl border border-line bg-white px-4" />
        <label htmlFor="note" className="font-medium">הערה (לא חובה)</label>
        <textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="אפשר להדביק כאן גם את טקסט המתכון אם הוא בתיאור הסרטון"
          className="rounded-xl border border-line bg-white p-4" />
        <button disabled={busy} className="min-h-12 rounded-full bg-accent font-medium text-white disabled:opacity-60">הוספה</button>
      </form>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {results.map((r) => (
        <StatusCard key={r.recipe_id} recipeId={r.recipe_id} initialStatus={r.status} duplicate={r.duplicate} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests** — `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(app): add-recipe page with share-target prefill and realtime status cards"
```

---

### Task 8: Admin screen (review queue, edit, chat import, allow-list)

**Files:**
- Create: `src/lib/import.ts`, `src/lib/edit-format.ts`, `src/components/admin/ReviewQueue.tsx`, `src/components/admin/EditRecipe.tsx`, `src/components/admin/ChatImport.tsx`, `src/components/admin/AllowList.tsx`, `src/pages/AdminPage.tsx`
- Test: `src/lib/import.test.ts`, `src/lib/edit-format.test.ts`, `src/components/admin/ReviewQueue.test.tsx`

**Interfaces:**
- Consumes: `adminAction`, `listReviewQueue`, `updateRecipe`, `getRecipe`, `formatIngredient`, `CATEGORIES`, `supabase`.
- Produces:
  - `ImportPage = { total: number; next_offset: number | null; created: number; duplicates: number }`
  - `runImport(content: string, invoke: (b: { content: string; offset: number }) => Promise<ImportPage>, onProgress: (p: { done: number; total: number; created: number; duplicates: number }) => void): Promise<{ total: number; created: number; duplicates: number }>`
  - `ingredientsToText(list: Ingredient[]): string`, `textToIngredients(text: string): Ingredient[]` (lines starting with `#` are group headers), `stepsToText(steps): string`, `textToSteps(text): Step[]`
  - Admin route `/admin` with tabs `לטיפול`, `עריכה`, `ייבוא צ'אט`, `חברים`; non-admins see "אין הרשאה".

- [ ] **Step 1: Write failing tests**

`src/lib/import.test.ts`:

```ts
import { expect, test, vi } from "vitest";
import { runImport } from "./import";

test("loops through pages until next_offset is null and sums counts", async () => {
  const invoke = vi.fn()
    .mockResolvedValueOnce({ total: 250, next_offset: 100, created: 90, duplicates: 10 })
    .mockResolvedValueOnce({ total: 250, next_offset: 200, created: 95, duplicates: 5 })
    .mockResolvedValueOnce({ total: 250, next_offset: null, created: 50, duplicates: 0 });
  const progress = vi.fn();
  const result = await runImport("TXT", invoke, progress);
  expect(invoke.mock.calls.map((c) => c[0].offset)).toEqual([0, 100, 200]);
  expect(result).toEqual({ total: 250, created: 235, duplicates: 15 });
  expect(progress).toHaveBeenLastCalledWith({ done: 250, total: 250, created: 235, duplicates: 15 });
});

test("empty export finishes in one call", async () => {
  const invoke = vi.fn().mockResolvedValue({ total: 0, next_offset: null, created: 0, duplicates: 0 });
  expect(await runImport("", invoke, () => {})).toEqual({ total: 0, created: 0, duplicates: 0 });
});
```

`src/lib/edit-format.test.ts`:

```ts
import { expect, test } from "vitest";
import { ingredientsToText, stepsToText, textToIngredients, textToSteps } from "./edit-format";

test("ingredients round-trip with group headers", () => {
  const text = ingredientsToText([
    { group: "לבצק", name: "קמח", amount: "2", unit: "כוסות", note: null },
    { group: "לבצק", name: "מים", amount: null, unit: null, note: null },
    { group: null, name: "מלח", amount: null, unit: null, note: null },
  ]);
  expect(text).toBe("# לבצק\n2 כוסות קמח\nמים\n#\nמלח");
  expect(textToIngredients(text)).toEqual([
    { group: "לבצק", name: "2 כוסות קמח", amount: null, unit: null, note: null },
    { group: "לבצק", name: "מים", amount: null, unit: null, note: null },
    { group: null, name: "מלח", amount: null, unit: null, note: null },
  ]);
});

test("steps: one per non-empty line", () => {
  expect(textToSteps("א\n\n ב \n")).toEqual([{ text: "א" }, { text: "ב" }]);
  expect(stepsToText([{ text: "א" }, { text: "ב" }])).toBe("א\nב");
});
```

`src/components/admin/ReviewQueue.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { renderWithProviders, TEST_ADMIN } from "../../test/render";
import { ReviewQueue } from "./ReviewQueue";

const adminAction = vi.fn().mockResolvedValue({ status: "rewriting" });
vi.mock("../../lib/recipes", async (orig) => ({
  ...(await orig<typeof import("../../lib/recipes")>()),
  listReviewQueue: async () => [{
    id: "r1", status: "needs_review", source_url: "https://instagram.com/reel/x", source_platform: "instagram",
    title: null, description: null, ingredients: [], steps: [], prep_minutes: null, cook_minutes: null, servings: null,
    category: null, tags: [], image_path: null, error: "לא נמצא תוכן מתכון בקישור", created_at: "2026-10-14T08:00:00Z", published_at: null,
  }],
  adminAction: (...a: unknown[]) => adminAction(...a),
}));

test("shows the error and retries with pasted content", async () => {
  renderWithProviders(<ReviewQueue />, { member: TEST_ADMIN });
  expect(await screen.findByText("לא נמצא תוכן מתכון בקישור")).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText("הדבקת טקסט המתכון"), "2 ביצים, מלח. מטגנים.");
  await userEvent.click(screen.getByRole("button", { name: "עיבוד מחדש" }));
  expect(adminAction).toHaveBeenCalledWith({ action: "retry", recipe_id: "r1", raw_content: "2 ביצים, מלח. מטגנים." });
});

test("delete asks for confirmation", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  renderWithProviders(<ReviewQueue />, { member: TEST_ADMIN });
  await userEvent.click(await screen.findByRole("button", { name: "מחיקה" }));
  expect(adminAction).toHaveBeenCalledWith({ action: "delete", recipe_id: "r1" });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL.

- [ ] **Step 3: Implement**

`src/lib/import.ts`:

```ts
export interface ImportPage { total: number; next_offset: number | null; created: number; duplicates: number }

export async function runImport(
  content: string,
  invoke: (b: { content: string; offset: number }) => Promise<ImportPage>,
  onProgress: (p: { done: number; total: number; created: number; duplicates: number }) => void,
): Promise<{ total: number; created: number; duplicates: number }> {
  let offset = 0, total = 0, created = 0, duplicates = 0;
  for (;;) {
    const page = await invoke({ content, offset });
    total = page.total;
    created += page.created;
    duplicates += page.duplicates;
    onProgress({ done: page.next_offset ?? total, total, created, duplicates });
    if (page.next_offset === null) return { total, created, duplicates };
    offset = page.next_offset;
  }
}
```

`src/lib/edit-format.ts`:

```ts
import { formatIngredient } from "./recipes";
import type { Ingredient, Step } from "./types";

export function ingredientsToText(list: Ingredient[]): string {
  const lines: string[] = [];
  let group: string | null = null;
  for (const i of list) {
    if (i.group !== group) {
      lines.push(i.group ? `# ${i.group}` : "#");
      group = i.group;
    }
    lines.push(formatIngredient(i));
  }
  return lines.join("\n");
}

export function textToIngredients(text: string): Ingredient[] {
  let group: string | null = null;
  const out: Ingredient[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      group = line.slice(1).trim() || null;
      continue;
    }
    out.push({ group, name: line, amount: null, unit: null, note: null });
  }
  return out;
}

export const stepsToText = (steps: Step[]) => steps.map((s) => s.text).join("\n");
export const textToSteps = (text: string): Step[] =>
  text.split("\n").map((t) => t.trim()).filter(Boolean).map((t) => ({ text: t }));
```

`src/components/admin/ReviewQueue.tsx`:

```tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminAction, type AdminActionBody, listReviewQueue } from "../../lib/recipes";
import { STATUS_LABEL } from "../../lib/status";
import type { Recipe } from "../../lib/types";

function Item({ recipe }: { recipe: Recipe }) {
  const qc = useQueryClient();
  const [pasted, setPasted] = useState("");
  const action = useMutation({
    mutationFn: (body: AdminActionBody) => adminAction(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["review-queue"] }),
  });
  return (
    <li className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm">
      <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" dir="ltr" className="truncate text-sm underline">{recipe.source_url}</a>
      <p className="text-sm"><span className="font-medium">{STATUS_LABEL[recipe.status]}:</span> {recipe.error}</p>
      <label htmlFor={`paste-${recipe.id}`} className="text-sm font-medium">הדבקת טקסט המתכון</label>
      <textarea id={`paste-${recipe.id}`} rows={3} value={pasted} onChange={(e) => setPasted(e.target.value)}
        className="rounded-xl border border-line p-3" placeholder="לא חובה — בלי טקסט ננסה שוב מהקישור" />
      <div className="flex gap-2">
        <button disabled={action.isPending} className="min-h-11 flex-1 rounded-full bg-accent text-white disabled:opacity-60"
          onClick={() => action.mutate({ action: "retry", recipe_id: recipe.id, ...(pasted.trim() ? { raw_content: pasted.trim() } : {}) })}>
          עיבוד מחדש
        </button>
        <button disabled={action.isPending} className="min-h-11 rounded-full border border-line px-4"
          onClick={() => window.confirm("למחוק את המתכון?") && action.mutate({ action: "delete", recipe_id: recipe.id })}>
          מחיקה
        </button>
      </div>
      {action.isError && <p role="alert" className="text-sm text-red-700">הפעולה נכשלה.</p>}
    </li>
  );
}

export function ReviewQueue() {
  const { data, isPending } = useQuery({ queryKey: ["review-queue"], queryFn: listReviewQueue });
  if (isPending) return <p role="status" className="text-muted">טוען…</p>;
  if (!data?.length) return <p className="py-8 text-center text-muted">אין מתכונים שמחכים לטיפול 🎉</p>;
  return <ul className="flex flex-col gap-3">{data.map((r) => <Item key={r.id} recipe={r} />)}</ul>;
}
```

`src/components/admin/EditRecipe.tsx`:

```tsx
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";
import { CATEGORIES } from "../../lib/categories";
import { ingredientsToText, stepsToText, textToIngredients, textToSteps } from "../../lib/edit-format";
import { adminAction, getRecipe, updateRecipe } from "../../lib/recipes";

export function EditRecipe() {
  const qc = useQueryClient();
  const [id, setId] = useState("");
  const recipe = useQuery({ queryKey: ["recipe", id], queryFn: () => getRecipe(id), enabled: id.length === 36 });
  const [form, setForm] = useState({ title: "", description: "", category: "", tags: "", ingredients: "", steps: "" });
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const r = recipe.data;
    if (!r) return;
    setForm({
      title: r.title ?? "", description: r.description ?? "", category: r.category ?? "",
      tags: r.tags.join(", "), ingredients: ingredientsToText(r.ingredients), steps: stepsToText(r.steps),
    });
  }, [recipe.data]);

  async function save(e: FormEvent) {
    e.preventDefault();
    await updateRecipe(id, {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category || null,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      ingredients: textToIngredients(form.ingredients),
      steps: textToSteps(form.steps),
    });
    await qc.invalidateQueries({ queryKey: ["recipe", id] });
    setMsg("נשמר");
  }

  const field = "rounded-xl border border-line bg-white p-3";
  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="edit-id" className="font-medium">מזהה מתכון (מהכתובת /recipe/…)</label>
      <input id="edit-id" dir="ltr" value={id} onChange={(e) => setId(e.target.value.trim().split("/").pop() ?? "")} className={field} />
      {recipe.data && (
        <form onSubmit={save} className="flex flex-col gap-2">
          <input aria-label="כותרת" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={field} />
          <textarea aria-label="תיאור" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={field} />
          <select aria-label="קטגוריה" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={field}>
            <option value="">—</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input aria-label="תגיות (מופרדות בפסיק)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className={field} />
          <textarea aria-label="מרכיבים (שורה לכל מרכיב, # לכותרת קבוצה)" rows={8} value={form.ingredients}
            onChange={(e) => setForm({ ...form, ingredients: e.target.value })} className={field} />
          <textarea aria-label="שלבים (שורה לכל שלב)" rows={8} value={form.steps} onChange={(e) => setForm({ ...form, steps: e.target.value })} className={field} />
          <div className="flex gap-2">
            <button className="min-h-11 flex-1 rounded-full bg-accent text-white">שמירה</button>
            <button type="button" className="min-h-11 rounded-full border border-line px-4"
              onClick={async () => { await adminAction({ action: "regenerate-image", recipe_id: id }); await qc.invalidateQueries({ queryKey: ["recipe", id] }); setMsg("נוצרה תמונה חדשה"); }}>
              תמונה חדשה
            </button>
          </div>
          {msg && <p role="status" className="text-green-700">{msg}</p>}
        </form>
      )}
    </div>
  );
}
```

`src/components/admin/ChatImport.tsx`:

```tsx
import { useState } from "react";
import { type ImportPage, runImport } from "../../lib/import";
import { supabase } from "../../lib/supabase";

export function ChatImport() {
  const [progress, setProgress] = useState<{ done: number; total: number; created: number; duplicates: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const content = await file.text();
      await runImport(content, async (body) => {
        const { data, error } = await supabase.functions.invoke("import-chat", { body });
        if (error) throw error;
        return data as ImportPage;
      }, setProgress);
    } catch {
      setError("הייבוא נעצר. אפשר להעלות את אותו קובץ שוב — כפילויות לא ייווצרו.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">בוואטסאפ: הקבוצה ← ⋮ ← עוד ← ייצוא צ'אט ← ללא מדיה. העלו כאן את קובץ ה-txt.</p>
      <label htmlFor="chat-file" className="font-medium">קובץ ייצוא (.txt)</label>
      <input id="chat-file" type="file" accept=".txt,text/plain" disabled={busy}
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      {progress && (
        <p role="status">
          {progress.done} מתוך {progress.total} הודעות עם קישור · {progress.created} מתכונים חדשים · {progress.duplicates} כבר היו
        </p>
      )}
      {error && <p role="alert" className="text-red-700">{error}</p>}
    </div>
  );
}
```

`src/components/admin/AllowList.tsx`:

```tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { supabase } from "../../lib/supabase";

interface Allowed { email: string; whatsapp_name: string | null; role: "admin" | "member" }

export function AllowList() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["allowed"],
    queryFn: async () => {
      const { data, error } = await supabase.from("allowed_emails").select("*").order("email");
      if (error) throw error;
      return data as Allowed[];
    },
  });
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("allowed_emails")
        .insert({ email: email.trim().toLowerCase(), whatsapp_name: name.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => { setEmail(""); setName(""); qc.invalidateQueries({ queryKey: ["allowed"] }); },
  });
  const remove = useMutation({
    mutationFn: async (e: string) => {
      const { error } = await supabase.from("allowed_emails").delete().eq("email", e);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["allowed"] }),
  });

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); add.mutate(); }} className="flex flex-col gap-2">
        <input aria-label="אימייל חבר/ה" type="email" required dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)}
          className="min-h-11 rounded-xl border border-line bg-white px-3" placeholder="name@example.com" />
        <input aria-label="שם בוואטסאפ" value={name} onChange={(e) => setName(e.target.value)}
          className="min-h-11 rounded-xl border border-line bg-white px-3" placeholder="שם בוואטסאפ" />
        <button className="min-h-11 rounded-full bg-accent text-white">הוספה לרשימה</button>
        {add.isError && <p role="alert" className="text-sm text-red-700">לא נוסף (אולי כבר ברשימה?)</p>}
      </form>
      <ul className="flex flex-col divide-y divide-line rounded-2xl bg-white">
        {list.data?.map((a) => (
          <li key={a.email} className="flex items-center justify-between gap-2 p-3">
            <span><span dir="ltr">{a.email}</span>{a.whatsapp_name && ` · ${a.whatsapp_name}`}{a.role === "admin" && " · מנהל/ת"}</span>
            {a.role !== "admin" && (
              <button className="min-h-10 rounded-full border border-line px-3 text-sm"
                onClick={() => window.confirm(`להסיר את ${a.email}?`) && remove.mutate(a.email)}>הסרה</button>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">הסרה מהרשימה חוסמת הרשמה חדשה. חשבון קיים יש להסיר גם ב-Supabase → Authentication.</p>
    </div>
  );
}
```

`src/pages/AdminPage.tsx`:

```tsx
import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { AllowList } from "../components/admin/AllowList";
import { ChatImport } from "../components/admin/ChatImport";
import { EditRecipe } from "../components/admin/EditRecipe";
import { ReviewQueue } from "../components/admin/ReviewQueue";

const TABS = [
  { key: "review", label: "לטיפול", el: <ReviewQueue /> },
  { key: "edit", label: "עריכה", el: <EditRecipe /> },
  { key: "import", label: "ייבוא צ'אט", el: <ChatImport /> },
  { key: "members", label: "חברים", el: <AllowList /> },
] as const;

export default function AdminPage() {
  const { member } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("review");
  if (member?.role !== "admin") return <p className="py-8 text-center">אין הרשאה.</p>;
  return (
    <div className="flex flex-col gap-4 pt-2">
      <div role="tablist" className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={`min-h-10 shrink-0 rounded-full px-4 ${tab === t.key ? "bg-ink text-white" : "border border-line bg-white"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {TABS.find((t) => t.key === tab)!.el}
    </div>
  );
}
```

- [ ] **Step 4: Run tests** — `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(app): admin review queue, recipe editor, chat import and allow-list management"
```

---

### Task 9: PWA — manifest, share target, service worker, push, install hint

**Files:**
- Create: `public/icon.svg`, `src/sw.ts`, `src/lib/push.ts`, `src/components/PushPrompt.tsx` (replace placeholder), `src/components/IosInstallHint.tsx`
- Modify: `vite.config.ts`, `src/pages/FeedPage.tsx` (render `IosInstallHint` above `PushPrompt`), `tsconfig.app.json` (add `"exclude": ["src/sw.ts"]` — the DOM and WebWorker libs conflict; vite-plugin-pwa compiles `sw.ts` itself)
- Test: `src/lib/push.test.ts`, `src/components/PushPrompt.test.tsx`

**Interfaces:**
- Consumes: `supabase.functions.invoke("push-subscribe")`, `useAuth`.
- Produces: `urlBase64ToUint8Array(s: string): Uint8Array`, `pushSupported(): boolean`, `subscribePush(vapidKey: string): Promise<void>`, `isIos(ua: string): boolean`, `isStandalone(): boolean`, `shouldShowIosInstallHint(ua: string, standalone: boolean): boolean`; manifest `share_target` → `/add` (GET, params `title`/`text`/`url`); SW handles `push` (payload `{title, body, url}`) and `notificationclick`.

- [ ] **Step 1: Write failing tests**

`src/lib/push.test.ts`:

```ts
import { expect, test } from "vitest";
import { isIos, shouldShowIosInstallHint, urlBase64ToUint8Array } from "./push";

test("urlBase64ToUint8Array decodes URL-safe base64 without padding", () => {
  expect([...urlBase64ToUint8Array("AQID_-8")]).toEqual([1, 2, 3, 255, 239]);
});

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36";

test("iOS detection and install hint", () => {
  expect(isIos(IPHONE)).toBe(true);
  expect(isIos(ANDROID)).toBe(false);
  expect(shouldShowIosInstallHint(IPHONE, false)).toBe(true);
  expect(shouldShowIosInstallHint(IPHONE, true)).toBe(false);
  expect(shouldShowIosInstallHint(ANDROID, false)).toBe(false);
});
```

`src/components/PushPrompt.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { renderWithProviders } from "../test/render";
import { PushPrompt } from "./PushPrompt";

const subscribePush = vi.fn().mockResolvedValue(undefined);
vi.mock("../lib/push", async (orig) => ({
  ...(await orig<typeof import("../lib/push")>()),
  pushSupported: () => true,
  subscribePush: (...a: unknown[]) => subscribePush(...a),
}));

beforeEach(() => {
  localStorage.clear();
  subscribePush.mockClear();
  // @ts-expect-error jsdom has no Notification
  globalThis.Notification = { permission: "default", requestPermission: vi.fn().mockResolvedValue("granted") };
  vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "BKey");
});

test("never asks on load; asks only after tapping yes", async () => {
  renderWithProviders(<PushPrompt />);
  expect(Notification.requestPermission).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "כן, תודיעו לי" }));
  expect(Notification.requestPermission).toHaveBeenCalled();
  expect(subscribePush).toHaveBeenCalledWith("BKey");
});

test("dismissal is remembered", async () => {
  const { unmount } = renderWithProviders(<PushPrompt />);
  await userEvent.click(screen.getByRole("button", { name: "לא עכשיו" }));
  unmount();
  renderWithProviders(<PushPrompt />);
  expect(screen.queryByRole("button", { name: "כן, תודיעו לי" })).not.toBeInTheDocument();
});

test("hidden when permission was already decided", () => {
  // @ts-expect-error test stub
  globalThis.Notification.permission = "denied";
  renderWithProviders(<PushPrompt />);
  expect(screen.queryByRole("button", { name: "כן, תודיעו לי" })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL.

- [ ] **Step 3: Implement `src/lib/push.ts`**

```ts
import { supabase } from "./supabase";

export function urlBase64ToUint8Array(s: string): Uint8Array {
  const padded = (s + "=".repeat((4 - (s.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function subscribePush(vapidKey: string): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ??
    await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
  const json = sub.toJSON();
  const { error } = await supabase.functions.invoke("push-subscribe", { body: { endpoint: json.endpoint, keys: json.keys } });
  if (error) throw error;
}

export const isIos = (ua: string) => /iPhone|iPad|iPod/.test(ua);

export function isStandalone(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export const shouldShowIosInstallHint = (ua: string, standalone: boolean) => isIos(ua) && !standalone;
```

- [ ] **Step 4: Implement the components**

`src/components/PushPrompt.tsx`:

```tsx
import { useState } from "react";
import { pushSupported, subscribePush } from "../lib/push";

const KEY = "push-prompt-dismissed";

function readDismissed(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

export function PushPrompt() {
  const [hidden, setHidden] = useState(
    () => readDismissed() || !pushSupported() || Notification.permission !== "default" || !import.meta.env.VITE_VAPID_PUBLIC_KEY,
  );
  const [error, setError] = useState(false);
  if (hidden) return null;

  const dismiss = () => {
    try { localStorage.setItem(KEY, "1"); } catch { /* private mode */ }
    setHidden(true);
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-accent-soft p-4">
      <p className="font-medium">לקבל התראה כשמתכון חדש מגיע?</p>
      <div className="flex gap-2">
        <button className="min-h-11 flex-1 rounded-full bg-accent text-white" onClick={async () => {
          const permission = await Notification.requestPermission();
          if (permission === "granted") {
            try { await subscribePush(import.meta.env.VITE_VAPID_PUBLIC_KEY); } catch { return setError(true); }
          }
          dismiss();
        }}>כן, תודיעו לי</button>
        <button className="min-h-11 rounded-full border border-line bg-white px-4" onClick={dismiss}>לא עכשיו</button>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">ההרשמה להתראות נכשלה.</p>}
    </div>
  );
}
```

`src/components/IosInstallHint.tsx`:

```tsx
import { useState } from "react";
import { isStandalone, shouldShowIosInstallHint } from "../lib/push";

export function IosInstallHint() {
  const [show, setShow] = useState(() => {
    try { if (localStorage.getItem("ios-hint-dismissed") === "1") return false; } catch { /* ignore */ }
    return shouldShowIosInstallHint(navigator.userAgent, isStandalone());
  });
  if (!show) return null;
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm">
      <p className="flex-1 text-sm">
        באייפון: לחצו על כפתור השיתוף ⬆️ ואז "הוספה למסך הבית" — כך האפליקציה תיפתח במסך מלא ותוכל לשלוח התראות.
      </p>
      <button aria-label="סגירה" className="size-11" onClick={() => {
        try { localStorage.setItem("ios-hint-dismissed", "1"); } catch { /* ignore */ }
        setShow(false);
      }}>✕</button>
    </div>
  );
}
```

In `FeedPage.tsx` add `import { IosInstallHint } from "../components/IosInstallHint";` and render `{!favoritesOnly && <IosInstallHint />}` directly above `<PushPrompt />`.

- [ ] **Step 5: Service worker** — `src/sw.ts`

```ts
/// <reference lib="webworker" />
import { ExpirationPlugin } from "workbox-expiration";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";

declare let self: ServiceWorkerGlobalScope;

self.skipWaiting();
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")));

// Opened recipes and their shares: readable offline
registerRoute(
  ({ url, request }) => request.method === "GET" && /\/rest\/v1\/(recipes|shares)/.test(url.pathname),
  new StaleWhileRevalidate({ cacheName: "recipes-api", plugins: [new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 })] }),
);

// Recipe images
registerRoute(
  ({ url }) => url.pathname.includes("/storage/v1/object/public/recipe-images/"),
  new CacheFirst({ cacheName: "recipe-images", plugins: [new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 60 })] }),
);

self.addEventListener("push", (event) => {
  const data = (() => {
    try { return event.data?.json() as { title: string; body: string; url: string }; } catch { return null; }
  })() ?? { title: "מתכון חדש", body: "", url: "/" };
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, dir: "rtl", lang: "he", icon: "/pwa-192x192.png", badge: "/pwa-64x64.png", data: { url: data.url },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string })?.url ?? "/";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = all.find((c) => new URL(c.url).origin === self.location.origin);
    if (existing) {
      await existing.navigate(url);
      return existing.focus();
    }
    return self.clients.openWindow(url);
  })());
});
```

- [ ] **Step 6: Icon + manifest + plugin**

`public/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#c2410c"/>
  <path d="M136 250h240v34c0 66-54 120-120 120s-120-54-120-120z" fill="#fffaf3"/>
  <rect x="116" y="232" width="280" height="26" rx="13" fill="#fffaf3"/>
  <path d="M206 196c0-26 22-26 22-52M256 196c0-26 22-26 22-52M306 196c0-26 22-26 22-52"
        stroke="#ffedd5" stroke-width="16" stroke-linecap="round" fill="none"/>
</svg>
```

Run: `npm run icons` → Expected: `public/pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`, `favicon.ico`. Add `<link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />` to `index.html`.

Update `vite.config.ts` plugins:

```ts
import { VitePWA } from "vite-plugin-pwa";
// ...
plugins: [
  react(),
  tailwindcss(),
  VitePWA({
    strategies: "injectManifest",
    srcDir: "src",
    filename: "sw.ts",
    registerType: "autoUpdate",
    injectRegister: "auto",
    devOptions: { enabled: false },
    manifest: {
      name: "המתכונים שלנו",
      short_name: "מתכונים",
      lang: "he",
      dir: "rtl",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#fffaf3",
      theme_color: "#c2410c",
      icons: [
        { src: "/pwa-64x64.png", sizes: "64x64", type: "image/png" },
        { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
        { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
        { src: "/maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
      share_target: {
        action: "/add",
        method: "GET",
        params: { title: "title", text: "text", url: "url" },
      },
    },
  }),
],
```

- [ ] **Step 7: Run tests and build**

Run: `npm test && npm run build`
Expected: tests PASS; build output lists `dist/sw.js` and `dist/manifest.webmanifest`. Then `npm run preview`, open http://localhost:5173 in Chrome → DevTools → Application → Manifest shows no errors and "Share target" is present; Service Workers shows `sw.js` activated.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(app): PWA manifest with share target, Workbox SW with offline recipes and push"
```

---

### Task 10: End-to-end tests against the local stack

**Files:**
- Create: `app/playwright.config.ts`, `app/e2e/local.ts`, `app/e2e/global-setup.ts`, `app/e2e/fixture-server.mjs`, `app/e2e/fixtures/recipe.html`, `app/e2e/app.spec.ts`
- Modify: `.gitignore` (already covers `test-results/`, `playwright-report/`)

**Interfaces:**
- Consumes: local Supabase from Plan 1 (`npm run db:start` + `npm run functions:serve` with `AI_FAKE=1`), every page above.
- Produces: `npm run e2e` (inside `app/`).

Prerequisites (document at the top of `app.spec.ts`): Docker running; in the repo root `npm run db:start` and, in a second terminal, `npm run functions:serve`.

- [ ] **Step 1: Helpers**

`app/e2e/local.ts`:

```ts
import { execSync } from "node:child_process";

export function localSupabase(): { url: string; anonKey: string; serviceKey: string } {
  const s = JSON.parse(execSync("npx supabase status -o json", { cwd: "..", encoding: "utf8" }));
  return { url: s.API_URL, anonKey: s.ANON_KEY ?? s.PUBLISHABLE_KEY, serviceKey: s.SERVICE_ROLE_KEY ?? s.SECRET_KEY };
}

export const E2E_MEMBER = "e2e-member@test.local";
export const E2E_ADMIN = "e2e-admin@test.local";
export const SEEDED_RECIPE_ID = "00000000-0000-4000-8000-0000000e2e01";
```

`app/e2e/fixture-server.mjs`:

```js
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("./fixtures/recipe.html", import.meta.url));
createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}).listen(5199, "0.0.0.0", () => console.log("fixture server on 5199"));
```

`app/e2e/fixtures/recipe.html`:

```html
<!doctype html><html lang="he"><head><meta charset="utf-8"><title>חביתה</title>
<script type="application/ld+json">{"@type":"Recipe","name":"חביתה","recipeIngredient":["2 ביצים","קורט מלח"],"recipeInstructions":[{"@type":"HowToStep","text":"טורפים ומטגנים."}]}</script>
</head><body><article>חביתה פשוטה</article></body></html>
```

- [ ] **Step 2: Global setup — users, allow-list, seeded recipe**

`app/e2e/global-setup.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import { E2E_ADMIN, E2E_MEMBER, localSupabase, SEEDED_RECIPE_ID } from "./local";

export default async function globalSetup() {
  const env = localSupabase();
  const db = createClient(env.url, env.serviceKey, { auth: { persistSession: false } });

  await db.from("allowed_emails").upsert([
    { email: E2E_MEMBER, whatsapp_name: "רחל", role: "member" },
    { email: E2E_ADMIN, whatsapp_name: "שי", role: "admin" },
  ]);
  const { data: users } = await db.auth.admin.listUsers();
  for (const email of [E2E_MEMBER, E2E_ADMIN]) {
    if (!users.users.some((u) => u.email === email)) await db.auth.admin.createUser({ email, email_confirm: true });
  }

  await db.from("recipes").upsert({
    id: SEEDED_RECIPE_ID, status: "published", published_at: new Date().toISOString(),
    source_url: "https://e2e.test/shakshuka", source_url_normalized: "https://e2e.test/shakshuka", source_platform: "web",
    title: "שקשוקה של בדיקה", description: "לבדיקות קצה לקצה.", category: "ארוחת בוקר", tags: ["צמחוני"],
    prep_minutes: 10, cook_minutes: 15, servings: 2,
    ingredients: [
      { group: null, name: "עגבניות", amount: "4", unit: null, note: null },
      { group: null, name: "ביצים", amount: "3", unit: null, note: null },
    ],
    steps: [{ text: "מבשלים את העגבניות." }, { text: "שוברים פנימה את הביצים." }, { text: "מגישים חם." }],
  });
  await db.from("shares").upsert(
    { recipe_id: SEEDED_RECIPE_ID, shared_by_name: "רחל", shared_at: "2026-10-12T09:00:00Z", via: "whatsapp" },
    { onConflict: "recipe_id,shared_by_name,shared_at", ignoreDuplicates: true },
  );
  await db.from("favorites").delete().eq("recipe_id", SEEDED_RECIPE_ID);
}
```

- [ ] **Step 3: Playwright config**

`app/playwright.config.ts`:

```ts
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
```

- [ ] **Step 4: Write the specs** — `app/e2e/app.spec.ts`

```ts
// Prereqs: Docker running; repo root: `npm run db:start` and `npm run functions:serve` (AI_FAKE=1).
import { createClient } from "@supabase/supabase-js";
import { expect, type Page, test } from "@playwright/test";
import { E2E_ADMIN, E2E_MEMBER, localSupabase, SEEDED_RECIPE_ID } from "./local";

const sb = localSupabase();
const admin = createClient(sb.url, sb.serviceKey, { auth: { persistSession: false } });

async function login(page: Page, email: string) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink", email, options: { redirectTo: "http://localhost:5173/" },
  });
  if (error) throw error;
  await page.goto(data.properties.action_link);
  await expect(page.getByRole("navigation")).toBeVisible();
}

test("member: feed, search, recipe, cooking mode, favourite", async ({ page }) => {
  await login(page, E2E_MEMBER);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("searchbox").fill("עגבניות");
  await page.getByRole("link", { name: /שקשוקה של בדיקה/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("שקשוקה של בדיקה");
  await expect(page.getByText("מקור: e2e.test · שותף ע״י רחל ב-12.10.2026")).toBeVisible();

  await page.getByRole("button", { name: "הוספה למועדפים" }).click();
  await page.getByRole("link", { name: "מועדפים" }).click();
  await expect(page.getByRole("link", { name: /שקשוקה של בדיקה/ })).toBeVisible();

  await page.goto(`/recipe/${SEEDED_RECIPE_ID}/cook`);
  await expect(page.getByText("שלב 1 מתוך 3")).toBeVisible();
  await page.getByRole("button", { name: "הבא" }).click();
  await expect(page.getByText("שוברים פנימה את הביצים.")).toBeVisible();
  await expect(page.getByText("3 ביצים")).toBeVisible();
});

test("member: share-target link goes all the way to published", async ({ page }) => {
  await login(page, E2E_MEMBER);
  const link = `http://host.docker.internal:5199/omelette-${Date.now()}`;
  await page.goto(`/add?text=${encodeURIComponent(`חביתה מעולה ${link}`)}`);
  await expect(page.getByLabel("קישור למתכון")).toHaveValue(link);
  await page.getByRole("button", { name: "הוספה" }).click();
  await expect(page.getByText("פורסם")).toBeVisible({ timeout: 90_000 });
  await page.getByRole("link", { name: "לצפייה במתכון" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("מתכון בדיקה"); // AI_FAKE output
});

test("non-member is shown the members-only screen", async ({ page }) => {
  const email = `outsider-${Date.now()}@test.local`;
  await admin.from("allowed_emails").insert({ email });
  await admin.auth.admin.createUser({ email, email_confirm: true });
  await admin.from("members").delete().eq("email", email); // simulate removal after sign-up
  const { data } = await admin.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo: "http://localhost:5173/" } });
  await page.goto(data.properties.action_link);
  await expect(page.getByText("הגישה מותרת לחברי הקבוצה בלבד")).toBeVisible();
});

test("admin: review queue retry with pasted text", async ({ page }) => {
  const url = `https://e2e.test/broken-${Date.now()}`;
  const { data: r } = await admin.from("recipes").insert({
    source_url: url, source_url_normalized: url, source_platform: "instagram", status: "needs_review", error: "לא נמצא תוכן מתכון בקישור",
  }).select("id").single();

  await login(page, E2E_ADMIN);
  await page.getByRole("link", { name: "ניהול" }).click();
  const item = page.getByRole("listitem").filter({ hasText: url });
  await item.getByLabel("הדבקת טקסט המתכון").fill("2 ביצים, מלח. טורפים ומטגנים.");
  await item.getByRole("button", { name: "עיבוד מחדש" }).click();
  await expect.poll(async () => (await admin.from("recipes").select("status").eq("id", r!.id).single()).data?.status,
    { timeout: 90_000 }).toBe("published");
});
```

- [ ] **Step 5: Run**

With the stack and `functions:serve` running: `cd app && npx playwright install chromium && npm run e2e`
Expected: 4 passed. If the share-target test times out at "פורסם", check `preview_logs`/`functions:serve` output: the edge runtime must reach `host.docker.internal:5199` (Docker Desktop provides this name on Windows and macOS).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test(app): Playwright end-to-end suite against local Supabase with fake AI"
```

---

### Task 11: Vercel deployment

**Files:**
- Create: `app/vercel.json`
- Modify: `docs/SETUP.md` (append a "PWA on Vercel" section)

**Interfaces:**
- Consumes: built `dist/`.
- Produces: production URL used as Supabase Site URL / redirect URL.

- [ ] **Step 1: `app/vercel.json`**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/((?!.*\\.).*)", "destination": "/index.html" }],
  "headers": [
    { "source": "/sw.js", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] },
    { "source": "/manifest.webmanifest", "headers": [{ "key": "Content-Type", "value": "application/manifest+json" }] }
  ]
}
```

- [ ] **Step 2: Append to `docs/SETUP.md`**

```markdown
## 7. PWA on Vercel
1. Import the GitHub repo in Vercel; set **Root Directory** = `app`.
2. Environment variables (Production + Preview): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Supabase → Settings → API), `VITE_VAPID_PUBLIC_KEY` (same public key as the function secret).
3. Deploy. Copy the `https://<name>.vercel.app` URL into Supabase → Authentication → URL configuration (Site URL and Redirect URLs) and into the Google OAuth client's authorised JavaScript origins.
4. On Android Chrome: open the URL → "Install app". On iPhone Safari: Share → "Add to Home Screen" (needed for push).
5. Test the share sheet: in Instagram/TikTok tap Share → the app → the Add screen opens with the link filled in.
```

- [ ] **Step 3: Verify the production build locally**

Run: `cd app && npm run build && npm run preview`
Open http://localhost:5173/recipe/anything directly (deep link) → the app shell loads (no 404), redirects to login.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(app): Vercel config with SPA rewrites and SW cache headers; setup docs"
```
