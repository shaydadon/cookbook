# iOS Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the PWA into a native-feeling iOS app (tokens, light/soft-slate dark themes with a System/Light/Dark toggle, phone-width frame on desktop, large-title header, icon tab bar, sheets, photo grid, photo+sheet recipe page, dark cooking mode) without changing behaviour or data.

**Architecture:** All colours become CSS variables with a light set on `:root` and a dark set on `[data-theme="dark"]`; Tailwind v4 `@theme inline` maps them to utility names, and the **existing** class names (`bg-paper`, `text-ink`, `text-muted`, `bg-accent`, `bg-accent-soft`, `border-line`) are kept as aliases so every screen picks up the theme at once. A transformed, internally scrolling `AppFrame` (max 430px wide) contains every fixed element (tab bar, sheets, cooking mode), which is what keeps them inside the column on desktop. Small token-only UI primitives (`Sheet`, `Segmented`, `IconButton`, `GroupedList`, icons, `Skeleton`) are reused by every screen.

**Tech Stack:** React 19, React Router 7, Tailwind CSS 4 (`@theme inline`, `@utility`, `@custom-variant`), TanStack Query 5, Vitest 5 + Testing Library, Playwright 1.64.

**Spec:** `docs/superpowers/specs/2026-10-15-ios-redesign-design.md`

## Global Constraints

- Work only inside `app/`. Do not modify `supabase/`. No new npm dependencies.
- Exact token values (light / dark): `--bg #F2F2F7 / #1E242C`, `--surface #FFFFFF / #283039`, `--fill rgba(118,118,128,.12) / #323B46`, `--bar rgba(249,249,249,.82) / rgba(34,41,49,.88)`, `--line rgba(60,60,67,.18) / rgba(255,255,255,.06)`, `--text #000000 / #E4E8EE`, `--text-2 #8E8E93 / #8D97A5`, `--accent #FF9500 / #FF9500`, `--accent-soft #FFF4E5 / rgba(255,149,0,.16)`, `--on-accent #FFFFFF / #1B1206`, `--danger #FF3B30 / #FF6961`, `--success #34C759 / #30D158`.
- Desktop backdrop behind the frame: light `#E5E5EA`, dark `#151A20`. theme-color meta: light `#F2F2F7`, dark `#1E242C`.
- Components use tokens only — no raw hex/rgb colours and no `bg-white`, `text-white`, `text-red-*`, `text-green-*` classes anywhere in `app/src` after Task 1.
- Dark mode is matte: cards get a 1px `--line` border and no shadow; light mode cards get `0 1px 2px rgba(0,0,0,.04)` (via the `card` utility).
- Theme storage key `theme-pref`; values `"light" | "dark"`; absent = `"system"`. All storage access in try/catch.
- Frame: max width 430px; at ≥600px viewport: rounded 24px, shadow, 1rem vertical margin.
- Tap targets ≥ 44px; inputs ≥ 16px font; one `<h1>` per screen; all motion disabled under `prefers-reduced-motion: reduce`.
- Keep every existing accessible name used by tests: tab links "בית", "מועדפים", "הוספה", "ניהול" (links); submit button "הוספה"; cooking close button accessible name "יציאה"; "הוספה למועדפים"/"הסרה מהמועדפים"; all form labels unchanged.
- Hebrew copy unchanged except where this plan states new copy.
- Write files with the editor Write/Edit tools only (never shell heredocs/sed). Tests: block-bodied `beforeEach(() => { … })`.
- Commit message trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Storage blocked / private mode** → theme falls back to "system" and the app renders without throwing. Pinned in Task 1 (`theme.test.ts` "storage failure").
2. **Recipe without image / very long Hebrew title** → grid card and hero show the placeholder panel, titles clamp to 2 lines, layout doesn't break. Pinned in Task 5 and Task 6 tests.
3. **Opening `/add` directly (share target) then closing the sheet** → lands on `/` (not a blank screen or a back-navigation out of the app); Esc closes; focus returns. Pinned in Task 2 (`Sheet` Esc/focus) and Task 8 (close → `/`).
4. **Cooking mode while the app theme is Light** → cooking mode still renders dark. Pinned in Task 7.
5. **Signed-in member opens the settings sheet and switches theme** → `data-theme` updates immediately and persists across reload. Pinned in Task 4.

---

## File Structure

```
app/
  index.html                          # Task 1: no-flash theme script, theme-color meta
  src/
    index.css                         # Task 1 tokens/aliases/utilities; Task 3 frame + motion CSS
    theme/
      theme.ts        theme.test.ts   # Task 1: pref storage, resolve, apply
      ThemeProvider.tsx ThemeProvider.test.tsx  # Task 1: context + system listener
    components/ui/
      icons.tsx                       # Task 2
      IconButton.tsx                  # Task 2
      Segmented.tsx   Segmented.test.tsx   # Task 2
      Sheet.tsx       Sheet.test.tsx       # Task 2
      GroupedList.tsx                 # Task 2
      Skeleton.tsx                    # Task 2
    components/
      AppFrame.tsx    AppFrame.test.tsx    # Task 3
      Layout.tsx      Layout.test.tsx      # Task 3 (rewrite)
      SettingsSheet.tsx SettingsSheet.test.tsx  # Task 4
      RecipeCard.tsx, CategoryChips.tsx, SearchBar.tsx, FavoriteButton.tsx, PushPrompt.tsx, IosInstallHint.tsx  # Task 5
      CookingMode.tsx                 # Task 7
      StatusCard.tsx                  # Task 8
      admin/*.tsx                     # Task 9
    lib/push.ts                       # Task 4: getPushSubscription, unsubscribePush
    pages/FeedPage.tsx                # Task 5
    pages/RecipePage.tsx              # Task 6
    pages/CookingPage.tsx             # Task 7
    pages/AddRecipePage.tsx           # Task 8
    pages/AdminPage.tsx, LoginPage.tsx  # Task 9
    auth/RequireMember.tsx, components/ErrorBoundary.tsx  # Task 9
    App.tsx, main.tsx                 # Task 1 (ThemeProvider), Task 3 (AppFrame), Task 8 (/add route)
  e2e/app.spec.ts, e2e/screens.spec.ts, playwright.config.ts  # Task 10
```

---

### Task 1: Design tokens, theme engine, legacy class sweep

**Files:**
- Modify: `app/src/index.css`, `app/index.html`, `app/src/main.tsx`
- Create: `app/src/theme/theme.ts`, `app/src/theme/theme.test.ts`, `app/src/theme/ThemeProvider.tsx`, `app/src/theme/ThemeProvider.test.tsx`
- Modify (class sweep only): every `app/src/**/*.tsx` containing `bg-white`, `text-white`, `text-red-700`, `text-green-700`

**Interfaces:**
- Produces: `type ThemePref = "system" | "light" | "dark"`, `type Theme = "light" | "dark"`, `THEME_KEY = "theme-pref"`, `THEME_COLORS: Record<Theme, string>`, `getThemePref(): ThemePref`, `setThemePref(p: ThemePref): void`, `systemPrefersDark(): boolean`, `resolveTheme(p: ThemePref, prefersDark: boolean): Theme`, `applyTheme(t: Theme, doc?: Document): void`; `<ThemeProvider>`; `useTheme(): { pref: ThemePref; resolved: Theme; setPref(p: ThemePref): void }`.
- Tailwind utility names available to all later tasks: `bg-bg`, `bg-surface`, `bg-fill`, `bg-bar`, `border-line`, `text-ink`, `text-muted`, `bg-accent`, `text-accent`, `bg-accent-soft`, `text-on-accent`, `text-danger`, `text-success`, legacy alias `bg-paper` (= `--bg`); utilities `card`, `pressable`, `frost`.

- [ ] **Step 1: Write failing tests** — `app/src/theme/theme.test.ts`

```ts
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { applyTheme, getThemePref, resolveTheme, setThemePref, THEME_COLORS, THEME_KEY } from "./theme";

describe("theme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.head.querySelector('meta[name="theme-color"]')?.remove();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("pref defaults to system and round-trips", () => {
    expect(getThemePref()).toBe("system");
    setThemePref("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
    expect(getThemePref()).toBe("dark");
    setThemePref("system");
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
  });

  test("unknown stored value reads as system", () => {
    localStorage.setItem(THEME_KEY, "purple");
    expect(getThemePref()).toBe("system");
  });

  test("storage failure falls back to system and never throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(getThemePref()).toBe("system");
    expect(() => setThemePref("dark")).not.toThrow();
  });

  test("resolveTheme", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  test("applyTheme sets data-theme, color-scheme and theme-color meta", () => {
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(document.head.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe(THEME_COLORS.dark);
    applyTheme("light");
    expect(document.head.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe(THEME_COLORS.light);
  });
});
```

`app/src/theme/ThemeProvider.test.tsx`:

```tsx
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ThemeProvider, useTheme } from "./ThemeProvider";

let listeners: Array<() => void> = [];
let dark = false;

beforeEach(() => {
  localStorage.clear();
  listeners = [];
  dark = false;
  vi.stubGlobal("matchMedia", (q: string) => ({
    get matches() { return q.includes("dark") ? dark : false; },
    media: q,
    addEventListener: (_: string, cb: () => void) => { listeners.push(cb); },
    removeEventListener: (_: string, cb: () => void) => { listeners = listeners.filter((l) => l !== cb); },
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function Probe() {
  const { pref, resolved, setPref } = useTheme();
  return (
    <div>
      <span>{pref}/{resolved}</span>
      <button onClick={() => setPref("dark")}>dark</button>
      <button onClick={() => setPref("system")}>system</button>
    </div>
  );
}

test("follows the system while pref is system", () => {
  render(<ThemeProvider><Probe /></ThemeProvider>);
  expect(screen.getByText("system/light")).toBeInTheDocument();
  expect(document.documentElement.dataset.theme).toBe("light");
  act(() => { dark = true; listeners.forEach((l) => l()); });
  expect(screen.getByText("system/dark")).toBeInTheDocument();
  expect(document.documentElement.dataset.theme).toBe("dark");
});

test("explicit pref wins, persists, and stops listening", async () => {
  render(<ThemeProvider><Probe /></ThemeProvider>);
  await userEvent.click(screen.getByRole("button", { name: "dark" }));
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.getItem("theme-pref")).toBe("dark");
  expect(listeners).toHaveLength(0);
});
```

- [ ] **Step 2: Run to verify failure** — `cd app && npx vitest run src/theme` → FAIL (modules missing).

- [ ] **Step 3: Implement** — `app/src/theme/theme.ts`

```ts
export type ThemePref = "system" | "light" | "dark";
export type Theme = "light" | "dark";

export const THEME_KEY = "theme-pref";
export const THEME_COLORS: Record<Theme, string> = { light: "#F2F2F7", dark: "#1E242C" };

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function setThemePref(p: ThemePref): void {
  try {
    if (p === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, p);
  } catch {
    // private mode: the choice lasts for this page only
  }
}

export function systemPrefersDark(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(p: ThemePref, prefersDark: boolean): Theme {
  return p === "system" ? (prefersDark ? "dark" : "light") : p;
}

export function applyTheme(t: Theme, doc: Document = document): void {
  doc.documentElement.dataset.theme = t;
  doc.documentElement.style.colorScheme = t;
  let meta = doc.head.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = doc.createElement("meta");
    meta.setAttribute("name", "theme-color");
    doc.head.appendChild(meta);
  }
  meta.setAttribute("content", THEME_COLORS[t]);
}
```

`app/src/theme/ThemeProvider.tsx`:

```tsx
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { applyTheme, getThemePref, resolveTheme, setThemePref, systemPrefersDark, type Theme, type ThemePref } from "./theme";

interface ThemeState { pref: ThemePref; resolved: Theme; setPref(p: ThemePref): void }
const ThemeContext = createContext<ThemeState | null>(null);

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme outside ThemeProvider");
  return ctx;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(getThemePref);
  const [prefersDark, setPrefersDark] = useState(systemPrefersDark);
  const resolved = resolveTheme(pref, prefersDark);

  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  useEffect(() => {
    if (pref !== "system" || typeof matchMedia !== "function") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setPrefersDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  const setPref = (p: ThemePref) => {
    setThemePref(p);
    setPrefState(p);
    if (p === "system") setPrefersDark(systemPrefersDark());
  };

  return <ThemeContext.Provider value={{ pref, resolved, setPref }}>{children}</ThemeContext.Provider>;
}
```

- [ ] **Step 4: Replace `app/src/index.css`**

```css
@import "tailwindcss";

@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

:root {
  --bg: #F2F2F7;
  --surface: #FFFFFF;
  --fill: rgba(118, 118, 128, 0.12);
  --bar: rgba(249, 249, 249, 0.82);
  --line: rgba(60, 60, 67, 0.18);
  --text: #000000;
  --text-2: #8E8E93;
  --accent: #FF9500;
  --accent-soft: #FFF4E5;
  --on-accent: #FFFFFF;
  --danger: #FF3B30;
  --success: #34C759;
  --backdrop: #E5E5EA;
  --card-border: transparent;
  --card-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

[data-theme="dark"] {
  --bg: #1E242C;
  --surface: #283039;
  --fill: #323B46;
  --bar: rgba(34, 41, 49, 0.88);
  --line: rgba(255, 255, 255, 0.06);
  --text: #E4E8EE;
  --text-2: #8D97A5;
  --accent: #FF9500;
  --accent-soft: rgba(255, 149, 0, 0.16);
  --on-accent: #1B1206;
  --danger: #FF6961;
  --success: #30D158;
  --backdrop: #151A20;
  --card-border: rgba(255, 255, 255, 0.06);
  --card-shadow: none;
}

@theme inline {
  --font-sans: "Heebo", -apple-system, "SF Pro Text", system-ui, sans-serif;
  --color-bg: var(--bg);
  --color-paper: var(--bg); /* legacy alias */
  --color-surface: var(--surface);
  --color-fill: var(--fill);
  --color-bar: var(--bar);
  --color-line: var(--line);
  --color-ink: var(--text);
  --color-muted: var(--text-2);
  --color-accent: var(--accent);
  --color-accent-soft: var(--accent-soft);
  --color-on-accent: var(--on-accent);
  --color-danger: var(--danger);
  --color-success: var(--success);
}

@utility card {
  background: var(--surface);
  border: 1px solid var(--card-border);
  box-shadow: var(--card-shadow);
}

@utility frost {
  background: var(--bar);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  backdrop-filter: saturate(180%) blur(20px);
}

@utility pressable {
  transition: transform 120ms ease, opacity 120ms ease;
  &:active { transform: scale(0.97); opacity: 0.85; }
}

html, body, #root { height: 100%; }
body {
  margin: 0;
  background: var(--backdrop);
  color: var(--text);
  font-family: var(--font-sans);
  -webkit-tap-highlight-color: transparent;
  -webkit-font-smoothing: antialiased;
}
button, a { touch-action: manipulation; }
button, [role="tab"], [role="radio"] { user-select: none; -webkit-user-select: none; }
input, textarea, select { font-size: 16px; } /* no iOS zoom on focus */
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
```

- [ ] **Step 5: `app/index.html`** — replace the `theme-color` meta line with the two lines below and add the inline script as the **first** element in `<head>`:

```html
    <script>
      (function () {
        try {
          var p = localStorage.getItem("theme-pref");
          var dark = p === "dark" || (p !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
          document.documentElement.dataset.theme = dark ? "dark" : "light";
          document.documentElement.style.colorScheme = dark ? "dark" : "light";
        } catch (e) {}
      })();
    </script>
```

```html
    <meta name="theme-color" content="#F2F2F7" />
```

Also change the Google Fonts URL weights to `wght@400;500;600;700;800`.

- [ ] **Step 6: Wire the provider** — in `app/src/main.tsx` import `{ ThemeProvider } from "./theme/ThemeProvider"` and wrap `<QueryClientProvider>…</QueryClientProvider>` inside `<ThemeProvider>` (ThemeProvider directly inside `<ErrorBoundary>`). Add `ThemeProvider` to `app/src/test/render.tsx`'s wrapper so component tests that call `useTheme` work (wrap the existing tree in `<ThemeProvider>`).

- [ ] **Step 7: Legacy class sweep** (Edit tool, file by file). In every `app/src/**/*.tsx` (not tests):
  - `bg-white` → `bg-surface` (keep `bg-white/90` → `bg-surface/90`)
  - `text-white` (text on an accent background) → `text-on-accent`
  - `text-red-700` → `text-danger`; `text-green-700` → `text-success`
  - `bg-ink text-white` (AdminPage active tab) → `bg-ink text-bg`
  Then verify none remain: `grep -rnE "bg-white|text-white|text-red-|text-green-" app/src --include=*.tsx | grep -v test` → no output.

- [ ] **Step 8: Run all tests and build** — `cd app && npm test && npm run build` → all PASS (existing tests must not need changes in this task; if one does, report why).

- [ ] **Step 9: Commit**

```bash
git add -A app
git commit -m "feat(app): design tokens, light/soft-slate dark theme engine and no-flash script"
```

---

### Task 2: UI primitives (icons, IconButton, Segmented, Sheet, GroupedList, Skeleton)

**Files:**
- Create: `app/src/components/ui/icons.tsx`, `IconButton.tsx`, `Segmented.tsx`, `Segmented.test.tsx`, `Sheet.tsx`, `Sheet.test.tsx`, `GroupedList.tsx`, `Skeleton.tsx`

**Interfaces:**
- Produces:
  - icons: `HomeIcon, HeartIcon, PlusCircleIcon, ShieldIcon, ChevronBackIcon, CloseIcon, SearchIcon, ClockIcon, UsersIcon, CheckIcon, BellIcon` — each `(p: { className?: string; filled?: boolean }) => ReactElement`, 24×24, `stroke="currentColor"`, `aria-hidden`.
  - `IconButton({ label, onClick, children, className? })` — 36px round frosted button, `aria-label={label}`.
  - `Segmented<T extends string>({ label, options: { value: T; label: string }[], value: T, onChange(v: T): void })` — `role="radiogroup"` with `role="radio"` + `aria-checked` children.
  - `Sheet({ open, onClose, title, children, leading?, trailing? })` — renders nothing when closed; when open: backdrop (click closes), panel `role="dialog" aria-modal="true" aria-labelledby` its title, grabber, Esc closes, focus moves into the panel and returns to the previously focused element on close.
  - `GroupedList({ header?, children })` and `ListRow({ children, onClick?, danger? })`.
  - `SkeletonCard()`.

- [ ] **Step 1: Write failing tests**

`app/src/components/ui/Segmented.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { Segmented } from "./Segmented";

test("renders radios, marks the selected one and reports changes", async () => {
  const onChange = vi.fn();
  render(<Segmented label="מראה" value="light" onChange={onChange}
    options={[{ value: "system", label: "מערכת" }, { value: "light", label: "בהיר" }, { value: "dark", label: "כהה" }]} />);
  expect(screen.getByRole("radiogroup", { name: "מראה" })).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "בהיר" })).toHaveAttribute("aria-checked", "true");
  expect(screen.getByRole("radio", { name: "כהה" })).toHaveAttribute("aria-checked", "false");
  await userEvent.click(screen.getByRole("radio", { name: "כהה" }));
  expect(onChange).toHaveBeenCalledWith("dark");
});
```

`app/src/components/ui/Sheet.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, test, vi } from "vitest";
import { Sheet } from "./Sheet";

test("closed sheet renders nothing", () => {
  render(<Sheet open={false} onClose={() => {}} title="מתכון חדש"><p>body</p></Sheet>);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("open sheet is a labelled modal dialog; Esc and backdrop close it", async () => {
  const onClose = vi.fn();
  render(<Sheet open onClose={onClose} title="מתכון חדש"><p>body</p></Sheet>);
  const dialog = screen.getByRole("dialog", { name: "מתכון חדש" });
  expect(dialog).toHaveAttribute("aria-modal", "true");
  await userEvent.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByTestId("sheet-backdrop"));
  expect(onClose).toHaveBeenCalledTimes(2);
});

test("focus moves into the sheet and returns to the opener on close", async () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>open</button>
        <Sheet open={open} onClose={() => setOpen(false)} title="הגדרות"><button>inside</button></Sheet>
      </>
    );
  }
  render(<Harness />);
  const opener = screen.getByRole("button", { name: "open" });
  await userEvent.click(opener);
  expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
  await userEvent.keyboard("{Escape}");
  expect(opener).toHaveFocus();
});
```

- [ ] **Step 2: Run to verify failure** — `cd app && npx vitest run src/components/ui` → FAIL.

- [ ] **Step 3: Implement**

`app/src/components/ui/icons.tsx`:

```tsx
import type { ReactNode } from "react";

type P = { className?: string; filled?: boolean };

function Svg({ className = "size-6", filled = false, children }: P & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={filled ? "currentColor" : "none"} stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const HomeIcon = (p: P) => <Svg {...p}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></Svg>;
export const HeartIcon = (p: P) => <Svg {...p}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></Svg>;
export const PlusCircleIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9.5" /><path d="M12 8v8M8 12h8" /></Svg>;
export const ShieldIcon = (p: P) => <Svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></Svg>;
/** Points right: "back" in an RTL app. */
export const ChevronBackIcon = (p: P) => <Svg {...p}><path d="m9 18 6-6-6-6" /></Svg>;
export const CloseIcon = (p: P) => <Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>;
export const SearchIcon = (p: P) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>;
export const ClockIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>;
export const UsersIcon = (p: P) => <Svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></Svg>;
export const CheckIcon = (p: P) => <Svg {...p}><path d="M20 6 9 17l-5-5" /></Svg>;
export const BellIcon = (p: P) => <Svg {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" /></Svg>;
```

`app/src/components/ui/IconButton.tsx`:

```tsx
import type { ReactNode } from "react";

export function IconButton({ label, onClick, children, className = "" }: {
  label: string; onClick(): void; children: ReactNode; className?: string;
}) {
  return (
    <button type="button" aria-label={label} onClick={onClick}
      className={`pressable frost grid size-11 place-items-center rounded-full text-ink ${className}`}>
      {children}
    </button>
  );
}
```

`app/src/components/ui/Segmented.tsx`:

```tsx
export function Segmented<T extends string>({ label, options, value, onChange }: {
  label: string; options: { value: T; label: string }[]; value: T; onChange(v: T): void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-[10px] bg-fill p-0.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className={`min-h-9 flex-1 rounded-lg text-[13px] font-semibold transition ${on ? "bg-surface text-ink shadow-sm" : "text-ink/80"}`}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
```

`app/src/components/ui/Sheet.tsx`:

```tsx
import { type ReactNode, useEffect, useId, useRef } from "react";

export function Sheet({ open, onClose, title, children, leading, trailing }: {
  open: boolean; onClose(): void; title: string; children: ReactNode; leading?: ReactNode; trailing?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>("input, textarea, select, button, [href]");
    (first ?? panel.current)?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <div data-testid="sheet-backdrop" className="sheet-backdrop absolute inset-0 bg-black/35" onClick={() => closeRef.current()} />
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className="sheet-panel relative max-h-[92%] overflow-y-auto rounded-t-2xl bg-bg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 text-ink outline-none">
        <div className="mx-auto mb-3 h-[5px] w-9 rounded-full bg-muted/40" aria-hidden="true" />
        <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center">
          <div className="justify-self-start">{leading}</div>
          <h2 id={titleId} className="text-[17px] font-semibold">{title}</h2>
          <div className="justify-self-end">{trailing}</div>
        </div>
        {children}
      </div>
    </div>
  );
}
```

Append to `app/src/index.css`:

```css
@keyframes sheet-up { from { transform: translateY(100%); } to { transform: none; } }
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
.sheet-panel { animation: sheet-up 280ms cubic-bezier(0.32, 0.72, 0, 1); }
.sheet-backdrop { animation: fade-in 200ms ease-out; }
```

`app/src/components/ui/GroupedList.tsx`:

```tsx
import type { ReactNode } from "react";

export function GroupedList({ header, children }: { header?: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      {header && <h3 className="mb-1.5 px-4 text-[13px] text-muted">{header}</h3>}
      <div className="card divide-y divide-line overflow-hidden rounded-xl">{children}</div>
    </section>
  );
}

export function ListRow({ children, onClick, danger = false }: { children: ReactNode; onClick?(): void; danger?: boolean }) {
  const cls = `flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2.5 text-start text-[15px] ${danger ? "justify-center text-danger" : ""}`;
  return onClick
    ? <button type="button" onClick={onClick} className={`pressable ${cls}`}>{children}</button>
    : <div className={cls}>{children}</div>;
}
```

`app/src/components/ui/Skeleton.tsx`:

```tsx
export function SkeletonCard() {
  return (
    <div className="card overflow-hidden rounded-2xl" aria-hidden="true">
      <div className="aspect-square animate-pulse bg-fill" />
      <div className="space-y-2 p-2.5">
        <div className="h-3 w-4/5 animate-pulse rounded bg-fill" />
        <div className="h-2.5 w-1/2 animate-pulse rounded bg-fill" />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests** — `cd app && npx vitest run src/components/ui` → PASS; then `npm test` → all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A app/src/components/ui app/src/index.css
git commit -m "feat(app): iOS UI primitives (icons, sheet, segmented, grouped list, skeleton)"
```

---

### Task 3: App frame, large-title header, icon tab bar, page transitions

**Files:**
- Create: `app/src/components/AppFrame.tsx`, `app/src/components/AppFrame.test.tsx`
- Modify: `app/src/components/Layout.tsx` (rewrite), `app/src/components/Layout.test.tsx`, `app/src/App.tsx`, `app/src/index.css`, `app/src/pages/FeedPage.tsx` (remove its sr-only `<h1>`), `app/src/pages/AdminPage.tsx` (remove its `<h1>`)

**Interfaces:**
- Consumes: icons, `IconButton` (Task 2); `useAuth()` → `{ member }` with `member.display_name`.
- Produces: `AppFrame({ children })` — the single scroll container, `id="app-scroll"`, contains all fixed descendants. `Layout` renders: compact frosted bar (appears after scrolling 40px), large-title `<h1>` with avatar button (`aria-label="הגדרות"`) for `/`, `/favorites`, `/admin`; no header for `/recipe/*`; frosted icon tab bar with links "בית", "מועדפים", "הוספה", "ניהול" (admin only); `onOpenSettings` state (sheet itself arrives in Task 4 — in this task the avatar button sets `settingsOpen` state and renders nothing else). Exported helper `titleFor(pathname: string): string | null`.

- [ ] **Step 1: Write failing tests**

`app/src/components/AppFrame.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { AppFrame } from "./AppFrame";

test("frame is the scroll container and contains fixed children", () => {
  render(<AppFrame><div style={{ position: "fixed" }}>tab bar</div></AppFrame>);
  const frame = document.getElementById("app-scroll")!;
  expect(frame).toBeInTheDocument();
  expect(frame).toContainElement(screen.getByText("tab bar"));
  expect(frame.className).toMatch(/max-w-\[430px\]/);
  expect(frame.className).toMatch(/overflow-y-auto/);
});
```

Replace `app/src/components/Layout.test.tsx` with:

```tsx
import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router";
import { expect, test } from "vitest";
import { renderWithProviders, TEST_ADMIN } from "../test/render";
import { Layout, titleFor } from "./Layout";

const tree = (
  <Routes>
    <Route element={<Layout />}>
      <Route path="/" element={<p>feed</p>} />
      <Route path="/recipe/:id" element={<p>recipe</p>} />
    </Route>
  </Routes>
);

test("titleFor maps routes to large titles", () => {
  expect(titleFor("/")).toBe("המתכונים");
  expect(titleFor("/favorites")).toBe("מועדפים");
  expect(titleFor("/admin")).toBe("ניהול");
  expect(titleFor("/recipe/abc")).toBeNull();
});

test("admin sees the ניהול tab and a single large-title h1 with an avatar button", () => {
  renderWithProviders(tree, { member: TEST_ADMIN });
  expect(screen.getByRole("link", { name: "ניהול" })).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("המתכונים");
  expect(screen.getByRole("button", { name: "הגדרות" })).toBeInTheDocument();
  for (const name of ["בית", "מועדפים", "הוספה"]) expect(screen.getByRole("link", { name })).toBeInTheDocument();
});

test("member does not see the ניהול tab", () => {
  renderWithProviders(tree);
  expect(screen.queryByRole("link", { name: "ניהול" })).not.toBeInTheDocument();
});

test("recipe route has no large-title header", () => {
  renderWithProviders(tree, { route: "/recipe/r1" });
  expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  expect(screen.getByText("recipe")).toBeInTheDocument();
});
```

(If `renderWithProviders` already wraps its own `<Routes>`/`path`, pass `path="*"` and keep the same assertions; check `src/test/render.tsx` and adapt the call, not the assertions.)

- [ ] **Step 2: Run to verify failure** — `cd app && npx vitest run src/components/AppFrame.test.tsx src/components/Layout.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

`app/src/components/AppFrame.tsx`:

```tsx
import type { ReactNode } from "react";

/**
 * The app's only scroll container. `transform` makes it the containing block for every
 * `position: fixed` descendant (tab bar, sheets, cooking mode), which keeps them inside the
 * phone-width column on desktop.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <div id="app-scroll"
      className="relative mx-auto h-dvh w-full max-w-[430px] overflow-y-auto overscroll-contain bg-bg text-ink [transform:translateZ(0)] min-[600px]:my-4 min-[600px]:h-[calc(100dvh-2rem)] min-[600px]:rounded-3xl min-[600px]:shadow-2xl">
      {children}
    </div>
  );
}
```

`app/src/components/Layout.tsx`:

```tsx
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { HeartIcon, HomeIcon, PlusCircleIcon, ShieldIcon } from "./ui/icons";

export function titleFor(pathname: string): string | null {
  if (pathname === "/" || pathname === "/add") return "המתכונים";
  if (pathname === "/favorites") return "מועדפים";
  if (pathname === "/admin") return "ניהול";
  return null;
}

const tab = ({ isActive }: { isActive: boolean }) =>
  `pressable flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${isActive ? "text-accent" : "text-muted"}`;

export function Layout() {
  const { member } = useAuth();
  const { pathname } = useLocation();
  const title = titleFor(pathname);
  const [collapsed, setCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const el = document.getElementById("app-scroll");
    if (!el) return;
    const onScroll = () => setCollapsed(el.scrollTop > 40);
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [pathname]);

  const initial = member?.display_name?.trim().charAt(0) || "?";

  return (
    <div className="flex min-h-full flex-col">
      {title && (
        <>
          <div aria-hidden={!collapsed}
            className={`frost sticky top-0 z-20 flex h-11 items-center justify-center border-b border-line pt-[env(safe-area-inset-top)] text-[17px] font-semibold transition-opacity ${collapsed ? "opacity-100" : "pointer-events-none opacity-0"}`}>
            {title}
          </div>
          <header className="-mt-11 flex items-end justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top)+3rem)]">
            <h1 className="text-[30px] font-extrabold leading-tight tracking-tight">{title}</h1>
            <button type="button" aria-label="הגדרות" onClick={() => setSettingsOpen(true)}
              className="pressable grid size-9 place-items-center rounded-full bg-accent text-sm font-bold text-on-accent">
              {initial}
            </button>
          </header>
        </>
      )}
      <main key={pathname} className={`page-in flex-1 pb-28 ${title ? "px-4" : ""}`}>
        <Outlet />
      </main>
      <nav aria-label="ניווט ראשי"
        className="frost fixed inset-x-0 bottom-0 z-30 flex border-t border-line pb-[env(safe-area-inset-bottom)]">
        <NavLink to="/" end className={tab}><HomeIcon />בית</NavLink>
        <NavLink to="/favorites" className={tab}><HeartIcon />מועדפים</NavLink>
        <NavLink to="/add" className={tab}><PlusCircleIcon />הוספה</NavLink>
        {member?.role === "admin" && <NavLink to="/admin" className={tab}><ShieldIcon />ניהול</NavLink>}
      </nav>
      {settingsOpen && null /* SettingsSheet arrives in Task 4 */}
    </div>
  );
}
```

Append to `app/src/index.css`:

```css
@keyframes page-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.page-in { animation: page-in 200ms ease-out; }
```

`app/src/App.tsx`: import `{ AppFrame } from "./components/AppFrame"` and wrap the `<Suspense>` element in `<AppFrame>`; change the Suspense fallback to `<div className="p-8 text-center text-muted" role="status">טוען…</div>` (unchanged text, keeps tests).

Remove `<h1 className="sr-only">…</h1>` from `FeedPage.tsx` and `<h1 className="text-lg font-bold">ניהול</h1>` from `AdminPage.tsx` (Layout now owns the page h1).

- [ ] **Step 4: Run tests and build** — `cd app && npm test && npm run build` → all PASS. Fix any existing test that looked for the removed page h1s by asserting the Layout title instead (list each in the report).

- [ ] **Step 5: Commit**

```bash
git add -A app/src
git commit -m "feat(app): phone-width app frame, large-title header, icon tab bar, page transitions"
```

---

### Task 4: Settings sheet (account, theme switch, notifications, sign-out)

**Files:**
- Create: `app/src/components/SettingsSheet.tsx`, `app/src/components/SettingsSheet.test.tsx`
- Modify: `app/src/lib/push.ts`, `app/src/components/Layout.tsx`

**Interfaces:**
- Consumes: `Sheet`, `Segmented`, `GroupedList`, `ListRow` (Task 2); `useTheme()` (Task 1); `useAuth()` → `{ member, session, signOut }`; `pushSupported`, `subscribePush` (existing).
- Produces: `getPushSubscription(): Promise<PushSubscription | null>`, `unsubscribePush(): Promise<void>` in `lib/push.ts`; `SettingsSheet({ open, onClose })`.

- [ ] **Step 1: Write failing test** — `app/src/components/SettingsSheet.test.tsx`

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { renderWithProviders, TEST_MEMBER } from "../test/render";
import { SettingsSheet } from "./SettingsSheet";

vi.mock("../lib/push", async (orig) => ({
  ...(await orig<typeof import("../lib/push")>()),
  pushSupported: () => false,
}));

beforeEach(() => {
  localStorage.clear();
  document.documentElement.dataset.theme = "light";
});

test("shows the account and switches + persists the theme", async () => {
  renderWithProviders(<SettingsSheet open onClose={() => {}} />);
  expect(screen.getByRole("dialog", { name: "הגדרות" })).toBeInTheDocument();
  expect(screen.getByText(TEST_MEMBER.display_name)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("radio", { name: "כהה" }));
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.getItem("theme-pref")).toBe("dark");
});

test("notifications row explains when push is unsupported", () => {
  renderWithProviders(<SettingsSheet open onClose={() => {}} />);
  expect(screen.getByText("התראות לא נתמכות בדפדפן הזה")).toBeInTheDocument();
});

test("sign-out row calls signOut", async () => {
  const signOut = vi.fn().mockResolvedValue(undefined);
  renderWithProviders(<SettingsSheet open onClose={() => {}} />, { signOut });
  await userEvent.click(screen.getByRole("button", { name: "התנתקות" }));
  expect(signOut).toHaveBeenCalled();
});
```

(If `renderWithProviders` does not accept `signOut`, add an optional `signOut` override to its options object in `src/test/render.tsx`, defaulting to the current no-op.)

- [ ] **Step 2: Run to verify failure** — `cd app && npx vitest run src/components/SettingsSheet.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

Append to `app/src/lib/push.ts`:

```ts
export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function unsubscribePush(): Promise<void> {
  const sub = await getPushSubscription();
  if (!sub) return;
  await supabase.functions.invoke("push-subscribe", { method: "DELETE", body: { endpoint: sub.endpoint } });
  await sub.unsubscribe();
}
```

`app/src/components/SettingsSheet.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { getPushSubscription, pushSupported, subscribePush, unsubscribePush } from "../lib/push";
import { useTheme } from "../theme/ThemeProvider";
import type { ThemePref } from "../theme/theme";
import { GroupedList, ListRow } from "./ui/GroupedList";
import { Segmented } from "./ui/Segmented";
import { Sheet } from "./ui/Sheet";

const THEMES: { value: ThemePref; label: string }[] = [
  { value: "system", label: "מערכת" },
  { value: "light", label: "בהיר" },
  { value: "dark", label: "כהה" },
];

export function SettingsSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  const { member, session, signOut } = useAuth();
  const { pref, setPref } = useTheme();
  const supported = pushSupported() && !!import.meta.env.VITE_VAPID_PUBLIC_KEY;
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !supported) return;
    getPushSubscription().then((s) => setSubscribed(!!s && Notification.permission === "granted")).catch(() => {});
  }, [open, supported]);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      if (subscribed) {
        await unsubscribePush();
        setSubscribed(false);
      } else {
        const p = await Notification.requestPermission();
        if (p !== "granted") throw new Error("denied");
        await subscribePush(import.meta.env.VITE_VAPID_PUBLIC_KEY);
        setSubscribed(true);
      }
    } catch {
      setError("לא הצלחנו לעדכן את ההתראות");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="הגדרות"
      trailing={<button type="button" onClick={onClose} className="min-h-11 px-1 font-semibold text-accent">סיום</button>}>
      <GroupedList>
        <ListRow>
          <span className="font-medium">{member?.display_name}</span>
          <span dir="ltr" className="truncate text-[13px] text-muted">{session?.user.email}</span>
        </ListRow>
      </GroupedList>
      <GroupedList header="מראה">
        <div className="p-2"><Segmented label="מראה" options={THEMES} value={pref} onChange={setPref} /></div>
      </GroupedList>
      <GroupedList header="התראות">
        {supported ? (
          <ListRow>
            <span>התראה על מתכון חדש</span>
            <button type="button" role="switch" aria-checked={subscribed} aria-label="התראה על מתכון חדש"
              disabled={busy} onClick={toggle}
              className={`relative h-[31px] w-[51px] rounded-full transition ${subscribed ? "bg-success" : "bg-fill"} disabled:opacity-60`}>
              <span className={`absolute top-0.5 size-[27px] rounded-full bg-surface shadow transition-all ${subscribed ? "start-0.5" : "start-[22px]"}`} />
            </button>
          </ListRow>
        ) : (
          <ListRow><span className="text-muted">התראות לא נתמכות בדפדפן הזה</span></ListRow>
        )}
      </GroupedList>
      {error && <p role="alert" className="-mt-3 mb-4 px-4 text-[13px] text-danger">{error}</p>}
      <GroupedList>
        <ListRow danger onClick={() => { void signOut(); }}>התנתקות</ListRow>
      </GroupedList>
    </Sheet>
  );
}
```

In `Layout.tsx`: import `SettingsSheet` and replace `{settingsOpen && null …}` with `<SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />`.

- [ ] **Step 4: Run tests and build** — `cd app && npm test && npm run build` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A app/src
git commit -m "feat(app): settings sheet with theme switch, notifications toggle and sign-out"
```

---

### Task 5: Feed and favourites (grid cards, search, chips, skeletons, banners)

**Files:**
- Modify: `app/src/components/RecipeCard.tsx`, `CategoryChips.tsx`, `SearchBar.tsx`, `FavoriteButton.tsx`, `PushPrompt.tsx`, `IosInstallHint.tsx`, `app/src/pages/FeedPage.tsx`
- Test: `app/src/components/RecipeCard.test.tsx` (create)

**Interfaces:**
- Consumes: `SkeletonCard`, icons (Task 2); `formatMinutes`, `totalMinutes`, `imageUrl` (existing).
- Produces: `RecipeCard` caption line = `[category, formatMinutes(total)].filter(Boolean).join(" · ")`; FavoriteButton visual: 32px frosted circle with `HeartIcon` (filled + accent when active). Accessible names unchanged.

- [ ] **Step 1: Write failing test** — `app/src/components/RecipeCard.test.tsx`

```tsx
import { screen } from "@testing-library/react";
import { expect, test } from "vitest";
import type { Recipe } from "../lib/types";
import { renderWithProviders } from "../test/render";
import { RecipeCard } from "./RecipeCard";

const base: Recipe = {
  id: "r1", status: "published", source_url: "https://a.test", source_platform: "web", title: "פנקייק דק (קרפ) קל",
  description: null, ingredients: [], steps: [], prep_minutes: 10, cook_minutes: 20, servings: 4,
  category: "ארוחת בוקר", tags: [], image_path: null, error: null, created_at: "", published_at: "",
} as Recipe;

test("caption shows category · time", () => {
  renderWithProviders(<RecipeCard recipe={base} isFavorite={false} onToggleFavorite={() => {}} />);
  expect(screen.getByText("ארוחת בוקר · 30 דק׳")).toBeInTheDocument();
});

test("no image → placeholder panel; long title is clamped; no time → category only", () => {
  const long = "מתכון עם כותרת ארוכה מאוד מאוד מאוד שחייבת להיחתך אחרי שתי שורות כדי לא לשבור את הכרטיס";
  renderWithProviders(<RecipeCard recipe={{ ...base, title: long, prep_minutes: null, cook_minutes: null }}
    isFavorite onToggleFavorite={() => {}} />);
  expect(screen.getByTestId("card-placeholder")).toBeInTheDocument();
  expect(screen.getByText(long).className).toMatch(/line-clamp-2/);
  expect(screen.getByText("ארוחת בוקר")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "הסרה מהמועדפים" })).toBeInTheDocument();
});
```

(If `formatMinutes(30)` renders differently, use its actual output in the expectation — check `src/lib/recipes.ts`.)

- [ ] **Step 2: Run to verify failure** — `cd app && npx vitest run src/components/RecipeCard.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

`RecipeCard.tsx`:

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
  const caption = [recipe.category, total ? formatMinutes(total) : null].filter(Boolean).join(" · ");
  return (
    // The favourite button is a sibling of the link (no interactive element nested inside <a>).
    <div className="card pressable relative overflow-hidden rounded-2xl">
      <Link to={`/recipe/${recipe.id}`} className="block">
        <div className="aspect-square bg-accent-soft">
          {img
            ? <img src={img} alt="" crossOrigin="anonymous" loading="lazy" className="size-full object-cover" />
            : <div data-testid="card-placeholder" className="grid size-full place-items-center text-5xl" aria-hidden>🍽️</div>}
        </div>
        <div className="px-2.5 pb-2.5 pt-2">
          <h2 className="line-clamp-2 text-[13px] font-semibold leading-snug">{recipe.title}</h2>
          {caption && <p className="mt-0.5 text-[11.5px] text-muted">{caption}</p>}
        </div>
      </Link>
      <div className="absolute end-2 top-2">
        <FavoriteButton active={isFavorite} onClick={onToggleFavorite} />
      </div>
    </div>
  );
}
```

`FavoriteButton.tsx` (same props/labels; 44px hit area, 32px visual):

```tsx
import { HeartIcon } from "./ui/icons";

export function FavoriteButton({ active, onClick }: { active: boolean; onClick(): void }) {
  return (
    <button type="button" aria-pressed={active} aria-label={active ? "הסרה מהמועדפים" : "הוספה למועדפים"}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      className="pressable grid size-11 place-items-center">
      <span className={`frost grid size-8 place-items-center rounded-full ${active ? "text-accent" : "text-ink"}`}>
        <HeartIcon className="size-[18px]" filled={active} />
      </span>
    </button>
  );
}
```

`SearchBar.tsx`:

```tsx
import { SearchIcon } from "./ui/icons";

export function SearchBar({ value, onChange }: { value: string; onChange(v: string): void }) {
  return (
    <label className="flex h-10 items-center gap-2 rounded-[10px] bg-fill px-3 text-muted">
      <SearchIcon className="size-[18px] shrink-0" />
      <input type="search" inputMode="search" placeholder="חיפוש מתכון או מרכיב…" aria-label="חיפוש"
        value={value} onChange={(e) => onChange(e.target.value)}
        className="h-full w-full bg-transparent text-ink outline-none placeholder:text-muted" />
    </label>
  );
}
```

`CategoryChips.tsx` — keep markup/behaviour, change `chip()` to:

```tsx
  const chip = (active: boolean) =>
    `pressable min-h-11 shrink-0 rounded-full px-4 text-[13px] font-medium ${active ? "bg-accent text-on-accent" : "card"}`;
```

`PushPrompt.tsx` — replace only the returned JSX container classes:

```tsx
    <div className="card flex flex-col gap-3 rounded-2xl p-4">
      <p className="flex items-center gap-2 font-semibold"><BellIcon className="size-5 text-accent" />לקבל התראה כשמתכון חדש מגיע?</p>
      <div className="flex gap-2">
        <button disabled={busy} className="pressable min-h-11 flex-1 rounded-xl bg-accent font-semibold text-on-accent disabled:opacity-60" onClick={accept}>כן, תודיעו לי</button>
        <button className="pressable min-h-11 rounded-xl bg-fill px-4 font-medium" onClick={dismiss}>לא עכשיו</button>
      </div>
      {error && <p role="alert" className="text-sm text-danger">ההרשמה להתראות נכשלה.</p>}
    </div>
```

(import `BellIcon` from `./ui/icons`). `IosInstallHint.tsx`: container → `card flex items-start gap-3 rounded-2xl p-4`; close button → `<IconButton label="סגירה" onClick={…}><CloseIcon className="size-4" /></IconButton>` keeping the same onClick body.

`FeedPage.tsx` — replace the loading paragraph and the grid/empty/error/load-more blocks:

```tsx
      {query.isPending && (
        <div role="status" aria-label="טוען" className="grid grid-cols-2 gap-2.5">
          {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}
        </div>
      )}
      {query.isError && (
        <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-muted">{navigator.onLine ? "לא הצלחנו לטעון מתכונים." : "אין חיבור לאינטרנט"}</p>
          <button type="button" onClick={() => query.refetch()} className="pressable min-h-11 rounded-xl bg-accent px-6 font-semibold text-on-accent">נסו שוב</button>
        </div>
      )}
      {query.isSuccess && !query.isPlaceholderData && recipes.length === 0 && (
        <p className="py-16 text-center text-muted">{empty}</p>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        {recipes.map((r) => (
          <RecipeCard key={r.id} recipe={r} isFavorite={favorites.ids.has(r.id)} onToggleFavorite={() => favorites.toggle(r.id)} />
        ))}
      </div>
      <div ref={sentinel} />
      {query.hasNextPage && (
        <button className="pressable mx-auto min-h-11 rounded-xl bg-fill px-5 font-medium" onClick={() => query.fetchNextPage()}>טען עוד</button>
      )}
```

(import `SkeletonCard` from `../components/ui/Skeleton`; container `gap-3 pt-2` stays). Any existing FeedPage test that asserted the text "טוען…" should now assert `getByRole("status", { name: "טוען" })` — list it in the report.

- [ ] **Step 4: Run tests and build** — `cd app && npm test && npm run build` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A app/src
git commit -m "feat(app): iOS feed — photo grid cards, search field, chips, skeletons, banners"
```

---

### Task 6: Recipe page (full-bleed photo, content sheet, stat tiles, floating CTA)

**Files:**
- Modify: `app/src/pages/RecipePage.tsx`
- Test: `app/src/pages/RecipePage.test.tsx` (extend)

**Interfaces:**
- Consumes: `IconButton`, `ChevronBackIcon`, `HeartIcon`, `ClockIcon`, `UsersIcon`, `CheckIcon` (Task 2); `useFavorites` (existing). Back: `history.state.idx > 0` → `navigate(-1)`, else `navigate("/", { replace: true })`.
- Produces: unchanged checkbox accessible names (ingredient text), "התחילו לבשל" link, attribution link.

- [ ] **Step 1: Write failing tests** — append to `app/src/pages/RecipePage.test.tsx` (reuse the file's existing mocks/fixtures; the fixture recipe is referred to here as `RECIPE` — use the file's actual variable):

```tsx
test("hero has back and favourite buttons; no image shows the placeholder", async () => {
  // render with a recipe whose image_path is null
  // (follow the file's existing render pattern)
  expect(await screen.findByRole("button", { name: "חזרה" })).toBeInTheDocument();
  expect(screen.getByTestId("hero-placeholder")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "התחילו לבשל" })).toBeInTheDocument();
});

test("stat tiles: missing servings hides only that tile", async () => {
  // render with servings: null, prep 10 + cook 20, category "ארוחת בוקר"
  expect(await screen.findByText("30 דק׳")).toBeInTheDocument();
  expect(screen.queryByText("מנות")).not.toBeInTheDocument();
  expect(screen.getByText("ארוחת בוקר")).toBeInTheDocument();
});
```

Make the render calls concrete by copying the existing test's render helper invocation and overriding the mocked `getRecipe` return value for these two cases.

- [ ] **Step 2: Run to verify failure** — `cd app && npx vitest run src/pages/RecipePage.test.tsx` → the new tests FAIL.

- [ ] **Step 3: Implement** — replace the success-path JSX of `RecipePage.tsx` (keep the loading/error branches, but restyle them: loading `→` `<div role="status" className="h-[40vh] animate-pulse bg-fill" />`; error blocks use `text-muted` text and an accent `pressable min-h-11 rounded-xl px-6 font-semibold text-on-accent` button):

```tsx
  const navigate = useNavigate();
  const back = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1); else navigate("/", { replace: true });
  };
  // … existing data/groups computation …
  const stats = [
    total ? { icon: <ClockIcon className="size-4" />, value: formatMinutes(total), label: "זמן" } : null,
    r.servings ? { icon: <UsersIcon className="size-4" />, value: String(r.servings), label: "מנות" } : null,
    r.category ? { icon: null, value: r.category, label: "קטגוריה" } : null,
  ].filter(Boolean) as { icon: ReactNode; value: string; label: string }[];

  return (
    <article>
      <div className="relative h-[40vh] min-h-56 bg-accent-soft">
        {img
          ? <img src={img} alt="" crossOrigin="anonymous" className="size-full object-cover" />
          : <div data-testid="hero-placeholder" className="grid size-full place-items-center text-7xl" aria-hidden>🍽️</div>}
        <div className="absolute inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] flex justify-between">
          <IconButton label="חזרה" onClick={back}><ChevronBackIcon className="size-5" /></IconButton>
          <FavoriteButton active={favorites.ids.has(r.id)} onClick={() => favorites.toggle(r.id)} />
        </div>
      </div>

      <div className="relative -mt-6 rounded-t-3xl bg-surface px-4 pb-32 pt-5">
        <h1 className="text-[22px] font-extrabold leading-tight tracking-tight">{r.title}</h1>
        <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="mt-1 block text-[12.5px] text-muted underline-offset-2 hover:underline">
          {formatAttribution(r, shares.data?.[0] ?? null)}
        </a>
        {r.description && <p className="mt-3 text-[15px] leading-relaxed text-muted">{r.description}</p>}

        {stats.length > 0 && (
          <div className="mt-4 flex gap-2">
            {stats.map((s) => (
              <div key={s.label} className="flex-1 rounded-xl bg-fill px-2 py-2 text-center">
                <div className="flex items-center justify-center gap-1 text-[14px] font-bold">{s.icon}{s.value}</div>
                <div className="text-[10.5px] text-muted">{s.label}</div>
              </div>
            ))}
          </div>
        )}
        {r.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {r.tags.map((t) => <span key={t} className="rounded-full bg-accent-soft px-2.5 py-1 text-[12px] text-accent">{t}</span>)}
          </div>
        )}

        <section className="mt-6">
          <h2 className="mb-1 text-[17px] font-bold">מרכיבים</h2>
          {groups.map((g, gi) => (
            <div key={gi} className="mb-2">
              {g.group && <h3 className="mt-2 text-[13px] font-semibold text-muted">{g.group}</h3>}
              <ul>
                {g.items.map((ing, k) => {
                  const i = g.start + k;
                  const text = formatIngredient(ing);
                  const on = checked.has(i);
                  return (
                    <li key={i} className="border-b border-line last:border-0">
                      <label className="flex min-h-11 items-center gap-3">
                        <span className="relative grid size-[22px] shrink-0 place-items-center">
                          <input type="checkbox" aria-label={text} checked={on}
                            className="peer size-[22px] appearance-none rounded-full border-2 border-line checked:border-accent checked:bg-accent"
                            onChange={() => setChecked((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })} />
                          <CheckIcon className="pointer-events-none absolute size-3.5 text-on-accent opacity-0 peer-checked:opacity-100" />
                        </span>
                        <span className={`text-[15px] ${on ? "text-muted line-through" : ""}`}>{text}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>

        <section className="mt-5">
          <h2 className="mb-2 text-[17px] font-bold">אופן ההכנה</h2>
          <ol className="flex flex-col gap-3">
            {r.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-relaxed">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[12px] font-bold text-accent">{i + 1}</span>
                <span>{s.text}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <Link to={`/recipe/${r.id}/cook`}
        className="pressable fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] z-20 grid h-[50px] place-items-center rounded-[14px] bg-accent text-[16px] font-bold text-on-accent shadow-[0_8px_20px_rgba(255,149,0,0.35)]">
        התחילו לבשל
      </Link>
    </article>
  );
```

Imports: `useNavigate` from react-router; `IconButton`; `ChevronBackIcon, CheckIcon, ClockIcon, UsersIcon` from `../components/ui/icons`; `type ReactNode` from react. Steps no longer use `list-decimal`; if an existing test located steps via `getAllByRole("listitem")` text, the step `<li>` text still contains the step text (number badge adds a leading digit — adapt the assertion to `toHaveTextContent(stepText)` and report it).

- [ ] **Step 4: Run tests and build** — `cd app && npm test && npm run build` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A app/src/pages
git commit -m "feat(app): recipe page — full-bleed photo, content sheet, stat tiles, floating cook button"
```

---

### Task 7: Cooking mode (always dark, progress bars)

**Files:**
- Modify: `app/src/components/CookingMode.tsx`, `app/src/pages/CookingPage.tsx` (loading/error classes only)
- Test: `app/src/components/CookingMode.test.tsx` (extend)

**Interfaces:**
- Consumes: `CloseIcon` (Task 2).
- Produces: root element `data-theme="dark"`; close button accessible name "יציאה"; `role="progressbar"` with `aria-valuenow={idx + 1}` `aria-valuemax={steps.length}`; existing "שלב X מתוך Y" text, הבא / הקודם / סיימתי buttons, swipe and keys unchanged.

- [ ] **Step 1: Write failing test** — append to `app/src/components/CookingMode.test.tsx` (use the file's existing steps fixture):

```tsx
test("always renders dark with a progress bar, even when the app is light", () => {
  document.documentElement.dataset.theme = "light";
  render(<CookingMode title="t" steps={[{ text: "a" }, { text: "b" }, { text: "c" }]} ingredients={[]} onExit={() => {}} />);
  const root = screen.getByRole("progressbar").closest("[data-theme]");
  expect(root).toHaveAttribute("data-theme", "dark");
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "3");
  expect(screen.getByRole("button", { name: "יציאה" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify failure** — `cd app && npx vitest run src/components/CookingMode.test.tsx` → new test FAILS.

- [ ] **Step 3: Implement** — replace the returned JSX in `CookingMode.tsx` (logic above `return` unchanged):

```tsx
  return (
    <div data-theme="dark"
      className="fixed inset-0 z-50 flex flex-col bg-bg pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-ink">
      <div role="progressbar" aria-label="התקדמות" aria-valuemin={1} aria-valuenow={idx + 1} aria-valuemax={steps.length}
        className="flex gap-1 px-4 pt-3">
        {steps.map((_, k) => <span key={k} className={`h-[3px] flex-1 rounded-full ${k <= idx ? "bg-accent" : "bg-fill"}`} />)}
      </div>
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[13px] text-muted" aria-live="polite">שלב {idx + 1} מתוך {steps.length}</p>
          <h1 className="line-clamp-1 text-[15px] font-semibold">{title}</h1>
        </div>
        <button type="button" aria-label="יציאה" onClick={onExit}
          className="pressable grid size-11 shrink-0 place-items-center rounded-full bg-fill">
          <CloseIcon className="size-5" />
        </button>
      </header>
      <div
        data-testid="swipe-area"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6"
        onTouchStart={(e) => { touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchEnd={(e) => {
          const start = touchStart.current;
          touchStart.current = null;
          if (!start) return;
          const dx = e.changedTouches[0].clientX - start.x;
          const dy = e.changedTouches[0].clientY - start.y;
          if (Math.abs(dy) > Math.abs(dx)) return; // vertical: the member is scrolling a long step
          if (dx > 60) next();
          if (dx < -60) prev();
        }}
      >
        <div className="my-auto flex flex-col gap-6 py-4">
          <p className={`${step.text.length > 160 ? "text-[22px]" : "text-[26px]"} font-semibold leading-snug`}>{step.text}</p>
          {related.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {related.map((r, k) => <li key={k} className="rounded-full bg-accent-soft px-3 py-1 text-[13px] text-accent">{formatIngredient(r)}</li>)}
            </ul>
          )}
        </div>
      </div>
      <nav className="flex gap-3 p-4">
        {idx < last
          ? <button onClick={next} className="pressable min-h-[52px] flex-1 rounded-[14px] bg-accent text-[17px] font-bold text-on-accent">הבא</button>
          : <button onClick={onExit} className="pressable min-h-[52px] flex-1 rounded-[14px] bg-accent text-[17px] font-bold text-on-accent">סיימתי</button>}
        <button onClick={prev} disabled={idx === 0} className="pressable min-h-[52px] flex-1 rounded-[14px] bg-fill text-[17px] font-semibold disabled:opacity-40">הקודם</button>
      </nav>
    </div>
  );
```

Import `CloseIcon` from `./ui/icons`. In `CookingPage.tsx` restyle the loading/error/no-steps blocks: wrap each in `<div data-theme="dark" className="fixed inset-0 z-50 grid place-items-center bg-bg p-8 text-center text-ink">…</div>`, error text `text-muted`, retry button `pressable min-h-11 rounded-xl bg-accent px-6 font-semibold text-on-accent` (same copy).

- [ ] **Step 4: Run tests and build** — `cd app && npm test && npm run build` → PASS (existing "יציאה" tests still find the button by name).

- [ ] **Step 5: Commit**

```bash
git add -A app/src
git commit -m "feat(app): dark slate cooking mode with progress bars"
```

---

### Task 8: Add recipe as a bottom sheet (+ status cards)

**Files:**
- Modify: `app/src/pages/AddRecipePage.tsx`, `app/src/App.tsx`, `app/src/components/StatusCard.tsx`
- Test: `app/src/pages/AddRecipePage.test.tsx` (extend)

**Interfaces:**
- Consumes: `Sheet` (Task 2).
- Produces: `/add` route renders `<FeedPage key="feed" />` **and** `<AddRecipePage />`; `AddRecipePage` renders `<Sheet open title="מתכון חדש">` containing the existing form (labels "קישור למתכון", "הערה (לא חובה)", submit "הוספה") and status cards; closing (ביטול, Esc, backdrop) → `navigate(-1)` when `history.state.idx > 0`, else `navigate("/", { replace: true })`.

- [ ] **Step 1: Write failing tests** — append to `app/src/pages/AddRecipePage.test.tsx` (use the file's existing render helper; add `Routes` so "/" is observable):

```tsx
test("renders as a dialog titled מתכון חדש", async () => {
  renderWithProviders(<AddRecipePage />, { route: "/add" });
  expect(screen.getByRole("dialog", { name: "מתכון חדש" })).toBeInTheDocument();
  expect(screen.getByLabelText("קישור למתכון")).toBeInTheDocument();
});

test("opened directly (share target), ביטול closes to the feed", async () => {
  renderWithProviders(
    <Routes>
      <Route path="/add" element={<AddRecipePage />} />
      <Route path="/" element={<p>FEED</p>} />
    </Routes>,
    { route: "/add?text=https%3A%2F%2Fa.test%2Fr" },
  );
  await userEvent.click(screen.getByRole("button", { name: "ביטול" }));
  expect(await screen.findByText("FEED")).toBeInTheDocument();
});
```

(Adapt the `renderWithProviders` call signature to the real helper; if it wraps its own `<Routes>`, pass `path="*"` and keep the nested routes.)

- [ ] **Step 2: Run to verify failure** — `cd app && npx vitest run src/pages/AddRecipePage.test.tsx` → new tests FAIL.

- [ ] **Step 3: Implement** — `AddRecipePage.tsx` keeps all state/logic; add `useNavigate` + `close`; replace the returned JSX:

```tsx
  const navigate = useNavigate();
  const close = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1); else navigate("/", { replace: true });
  };

  return (
    <Sheet open onClose={close} title="מתכון חדש"
      leading={<button type="button" onClick={close} className="min-h-11 px-1 text-accent">ביטול</button>}>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <label htmlFor="url" className="px-1 text-[13px] text-muted">קישור למתכון</label>
        <input id="url" dir="ltr" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={url}
          onChange={(e) => setUrl(e.target.value)} placeholder="https://…"
          className="card min-h-12 rounded-xl px-4 outline-none" />
        <label htmlFor="note" className="mt-2 px-1 text-[13px] text-muted">הערה (לא חובה)</label>
        <textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="אפשר להדביק כאן גם את טקסט המתכון אם הוא בתיאור הסרטון"
          className="card rounded-xl p-4 outline-none" />
        <button disabled={busy} className="pressable mt-3 min-h-12 rounded-[14px] bg-accent text-[16px] font-bold text-on-accent disabled:opacity-60">הוספה</button>
      </form>
      {error && <p role="alert" className="mt-3 px-1 text-[13px] text-danger">{error}</p>}
      <div className="mt-4 flex flex-col gap-2.5">
        {results.map((r) => (
          <StatusCard key={r.recipe_id} recipeId={r.recipe_id} initialStatus={r.status} duplicate={r.duplicate} />
        ))}
      </div>
    </Sheet>
  );
```

Remove the page `<h1>` (the sheet title is the heading). Imports: `useNavigate` from react-router; `Sheet` from `../components/ui/Sheet`.

`App.tsx`: change the `/add` route element to `<><FeedPage key="feed" /><AddRecipePage /></>`.

`StatusCard.tsx` — restyle only the returned JSX:

```tsx
    <div className="card flex items-center gap-3 rounded-xl p-3" aria-live="polite">
      {!TERMINAL.includes(status) && <span className="size-[18px] shrink-0 animate-spin rounded-full border-[2.5px] border-accent-soft border-t-accent" aria-hidden />}
      <div className="min-w-0 flex-1">
        {duplicate && <p className="text-[12px] text-muted">המתכון הזה כבר קיים — רשמנו שגם את/ה שיתפת.</p>}
        <p className="truncate text-[14px] font-semibold">{title ?? "מתכון חדש"}</p>
        <p className={`text-[12.5px] ${done ? "text-success" : status === "failed" || status === "needs_review" ? "text-danger" : "text-muted"}`}>
          {STATUS_LABEL[status]}
        </p>
      </div>
      {done && <Link to={`/recipe/${recipeId}`} className="pressable inline-flex min-h-11 items-center px-2 text-[14px] font-semibold text-accent">לצפייה במתכון</Link>}
    </div>
```

- [ ] **Step 4: Run tests and build** — `cd app && npm test && npm run build` → PASS (the existing tests that click `getByRole("button", { name: "הוספה" })` still match only the submit button, because the tab is a link).

- [ ] **Step 5: Commit**

```bash
git add -A app/src
git commit -m "feat(app): add recipe as an iOS bottom sheet over the feed"
```

---

### Task 9: Admin, login, members-only and error screens

**Files:**
- Modify: `app/src/pages/AdminPage.tsx`, `app/src/components/admin/ReviewQueue.tsx`, `AllowList.tsx`, `ChatImport.tsx`, `EditRecipe.tsx`, `app/src/pages/LoginPage.tsx`, `app/src/auth/RequireMember.tsx`, `app/src/components/ErrorBoundary.tsx`
- Test: existing tests for these files must stay green; add `app/src/pages/AdminPage.test.tsx` case below.

**Interfaces:**
- Consumes: `GroupedList`/`ListRow` (Task 2), tokens.
- Produces: AdminPage keeps `role="tablist"`/`role="tab"`/`role="tabpanel"` markup and ids (behaviour unchanged), styled as a segmented control.

- [ ] **Step 1: Write failing test** — add to `app/src/pages/AdminPage.test.tsx` (create the file if missing, rendering as `TEST_ADMIN` with the admin child components mocked to simple placeholders via `vi.mock` of `../components/admin/*`):

```tsx
test("tabs render as a segmented control with the review tab selected", () => {
  renderWithProviders(<AdminPage />, { member: TEST_ADMIN });
  const list = screen.getByRole("tablist");
  expect(list.className).toMatch(/bg-fill/);
  expect(screen.getByRole("tab", { name: "לטיפול" })).toHaveAttribute("aria-selected", "true");
});
```

- [ ] **Step 2: Run to verify failure** — `cd app && npx vitest run src/pages/AdminPage.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

`AdminPage.tsx` tab strip:

```tsx
      <div role="tablist" className="flex rounded-[10px] bg-fill p-0.5">
        {TABS.map((t) => (
          <button key={t.key} role="tab" id={`tab-${t.key}`} aria-controls={`panel-${t.key}`} aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`min-h-9 flex-1 rounded-lg px-1 text-[13px] font-semibold transition ${tab === t.key ? "bg-surface text-ink shadow-sm" : "text-ink/80"}`}>
            {t.label}
          </button>
        ))}
      </div>
```

Admin components — apply these class substitutions consistently (Edit tool), keeping all text, labels, roles and handlers:
  - list/queue containers (`rounded-2xl bg-surface …shadow-sm`, `divide-y` lists) → `card divide-y divide-line overflow-hidden rounded-xl`
  - each queue item / list row → `px-4 py-3`
  - text inputs and textareas → `card min-h-11 w-full rounded-xl px-3 outline-none` (textarea: `p-3`)
  - primary buttons (`bg-accent … rounded-full`) → `pressable min-h-11 rounded-xl bg-accent px-4 font-semibold text-on-accent disabled:opacity-60`
  - secondary/outline buttons (`border border-line … rounded-full`) → `pressable min-h-11 rounded-xl bg-fill px-4 font-medium`
  - destructive buttons (delete) → `pressable min-h-11 rounded-xl bg-fill px-4 font-medium text-danger`
  - section labels → `px-1 text-[13px] text-muted`
  - `role="alert"` messages → `text-[13px] text-danger`; status/success → `text-success`

`LoginPage.tsx` — keep logic; returned JSX:

```tsx
    <main className="flex min-h-full flex-col justify-center gap-6 px-6 py-10">
      <div className="flex flex-col items-center gap-3">
        <img src="/pwa-192x192.png" alt="" className="size-20 rounded-[22px] shadow-lg" />
        <h1 className="text-[28px] font-extrabold tracking-tight">{APP_NAME}</h1>
      </div>
      {sent
        ? <p className="card rounded-2xl p-4 text-center">שלחנו קישור כניסה ל-{email}. פתחו אותו מהטלפון הזה.</p>
        : (
          <form onSubmit={sendLink} className="flex flex-col gap-2">
            <label htmlFor="email" className="px-1 text-[13px] text-muted">אימייל</label>
            <input id="email" type="email" required autoComplete="email" dir="ltr" value={email}
              onChange={(e) => setEmail(e.target.value)} className="card min-h-12 rounded-xl px-4 outline-none" />
            <button disabled={busy} className="pressable mt-2 min-h-12 rounded-[14px] bg-accent font-bold text-on-accent disabled:opacity-60">
              שלחו לי קישור כניסה
            </button>
          </form>
        )}
      {error && <p role="alert" className="text-center text-[14px] text-danger">{error}</p>}
      <div className="flex items-center gap-3 text-[13px] text-muted"><hr className="flex-1 border-line" />או<hr className="flex-1 border-line" /></div>
      <button className="pressable card min-h-12 rounded-[14px] font-semibold" onClick={/* existing Google handler unchanged */}>
        כניסה עם Google
      </button>
    </main>
```

`RequireMember.tsx` — loading: `<div role="status" className="grid min-h-full place-items-center text-muted">טוען…</div>`; error and not-member blocks: `<main className="flex min-h-full flex-col items-center justify-center gap-4 px-6 text-center">`, heading `text-[22px] font-bold`, body `text-muted`, buttons `pressable min-h-11 rounded-xl bg-accent px-5 font-semibold text-on-accent` / `pressable min-h-11 rounded-xl bg-fill px-5 font-medium` (same copy).

`ErrorBoundary.tsx` — `main` → `flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg p-6 text-center text-ink`; button → `pressable min-h-11 rounded-xl bg-accent px-6 font-semibold text-on-accent` (copy unchanged).

- [ ] **Step 4: Run tests and build** — `cd app && npm test && npm run build` → PASS. Then `grep -rnE "bg-white|text-white|text-red-|text-green-|rounded-full bg-accent px-6" app/src --include=*.tsx | grep -v test` → no output.

- [ ] **Step 5: Commit**

```bash
git add -A app/src
git commit -m "feat(app): iOS-style admin, login, members-only and error screens"
```

---

### Task 10: E2E updates, screenshot pass, final verification

**Files:**
- Modify: `app/e2e/app.spec.ts` (only where markup changed), `app/playwright.config.ts`, `app/.gitignore`
- Create: `app/e2e/screens.spec.ts`

**Interfaces:**
- Consumes: everything above; existing `app/e2e/login.ts` helper (magic-link login) and `local.ts`.
- Produces: `SCREENS=1 npx playwright test e2e/screens.spec.ts --project=dev` writes PNGs to `app/e2e/screenshots/` (git-ignored).

- [ ] **Step 1: Run the existing E2E to see what changed** — from repo root `npm run db:reset`, start `npm run functions:serve` in the background, then `cd app && npm run e2e`. Expected failures come only from intentional markup changes. Fix each with the smallest selector change that keeps the same user-visible assertion, e.g. scoping the add-sheet submit to the dialog: `page.getByRole("dialog", { name: "מתכון חדש" }).getByRole("button", { name: "הוספה" })`. List every change in the report.

- [ ] **Step 2: Screenshot spec** — `app/e2e/screens.spec.ts`

```ts
import { expect, test } from "@playwright/test";
import { loginAs } from "./login";

const SIZES = [{ name: "phone", width: 390, height: 844 }, { name: "desktop", width: 1280, height: 800 }];
const THEMES = ["light", "dark"] as const;

test.skip(!process.env.SCREENS, "screenshots only when SCREENS=1");

for (const size of SIZES) {
  for (const theme of THEMES) {
    test(`screens ${size.name} ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.addInitScript((t) => { try { localStorage.setItem("theme-pref", t); } catch { /* */ } }, theme);
      await loginAs(page, "admin");
      const shot = (n: string) => page.screenshot({ path: `e2e/screenshots/${size.name}-${theme}-${n}.png` });
      await expect(page.getByRole("heading", { level: 1, name: "המתכונים" })).toBeVisible();
      await shot("feed");
      await page.getByRole("button", { name: "הגדרות" }).click();
      await shot("settings");
      await page.keyboard.press("Escape");
      await page.getByRole("link", { name: "הוספה" }).click();
      await shot("add");
      await page.keyboard.press("Escape");
      await page.locator('a[href^="/recipe/"]').first().click();
      await shot("recipe");
      await page.getByRole("link", { name: "התחילו לבשל" }).click();
      await shot("cooking");
      await page.goto("/admin");
      await shot("admin");
    });
  }
}
```

Use the real helper name/signature from `app/e2e/login.ts` (adapt the `loginAs` import/call; do not change the helper's behaviour). Add `e2e/screenshots/` to `app/.gitignore`. In `playwright.config.ts`, make the `pwa-preview` project ignore `screens.spec.ts` (it should only run under `dev`).

- [ ] **Step 3: Generate screenshots** — `cd app && SCREENS=1 npx playwright test e2e/screens.spec.ts --project=dev` → 4 tests pass, 24 PNGs in `e2e/screenshots/`. Open several (Read tool) and check against the spec: frosted tab bar with icons, large title + avatar, 2-column grid with captions, recipe photo + sheet + floating button, dark slate cooking mode, settings sheet with the segmented theme control, desktop shows the phone-width column with the tab bar inside it, dark mode is slate (not black). Fix anything that clearly contradicts the spec, re-run, and describe the final screenshots in the report.

- [ ] **Step 4: Full verification** — `cd app && npm test && npm run build && npm run e2e` (functions served) → all PASS; from repo root `npm run test:unit` → PASS (backend untouched). Stop `functions:serve`.

- [ ] **Step 5: Commit**

```bash
git add -A app
git commit -m "test(app): e2e selector updates and light/dark phone/desktop screenshot pass"
```
