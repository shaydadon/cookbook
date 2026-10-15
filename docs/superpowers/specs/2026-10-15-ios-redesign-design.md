# iOS Redesign — Design Spec

**Date:** 2026-10-15
**Owner:** Shay Dadon
**Status:** Approved in brainstorming (visual companion), pending written-spec review
**Applies to:** `app/` (PWA). No backend changes.

## 1. Goal

Make the PWA look and feel like a native iOS app instead of a web page, while keeping every existing behaviour, data flow and test intact. Approved choices: clean modern iOS style; orange accent; phone-shaped on desktop; photo-grid feed; photo + sheet recipe page; System/Light/Dark toggle with a soft matte slate dark theme.

### Success criteria
- On a phone, the app is indistinguishable in feel from a native iOS app: large titles, frosted bars, icon tab bar, sheets, press feedback, smooth transitions, safe-area aware.
- On desktop, the whole app (tab bar included) renders inside a centered phone-width column.
- Theme follows the phone by default; the user can force Light or Dark; the choice persists per device and never flashes the wrong theme on load.
- All existing unit and E2E tests pass (selectors updated where markup legitimately changed); `npm run build` passes.

### Non-goals
Backend/data changes, new features, new pages, i18n changes, changing copy except where a layout requires it.

## 2. Design tokens

All colours, radii and shadows are CSS custom properties defined in `app/src/index.css` (`@theme` for Tailwind + plain variables), with a light set on `:root` and a dark set on `:root[data-theme="dark"]`. Components use only tokens — no raw hex values in components.

| Token | Light | Dark (soft slate, matte) |
|---|---|---|
| `--bg` (app background) | `#F2F2F7` | `#1E242C` |
| `--surface` (cards, sheets, grouped rows) | `#FFFFFF` | `#283039` |
| `--fill` (search field, segmented, secondary buttons) | `rgba(118,118,128,.12)` | `#323B46` |
| `--bar` (frosted bars; used with backdrop-blur) | `rgba(249,249,249,.82)` | `rgba(34,41,49,.88)` |
| `--line` (hairlines/borders) | `rgba(60,60,67,.18)` | `rgba(255,255,255,.06)` |
| `--text` | `#000000` | `#E4E8EE` |
| `--text-2` (secondary) | `#8E8E93` | `#8D97A5` |
| `--accent` | `#FF9500` | `#FF9500` |
| `--accent-soft` (tinted chips/badges) | `#FFF4E5` | `rgba(255,149,0,.16)` |
| `--on-accent` (text on orange) | `#FFFFFF` | `#1B1206` |
| `--danger` | `#FF3B30` | `#FF6961` |
| `--success` | `#34C759` | `#30D158` |

- **Matte dark:** in dark mode, cards use a 1px `--line` border and no drop shadow; light mode uses a very subtle shadow (`0 1px 2px rgba(0,0,0,.04)`).
- **Radii:** cards 16px, sheets 16px (top corners), buttons 14px, inputs/search 10–12px, chips full.
- **Type:** Heebo (existing). Large title 30px/800, title 22px/800, headline 17px/700, body 17px/400 (16px min on inputs to stop iOS zoom), footnote 13px, caption 11–12px.
- **Spacing:** 16px page gutter; 8px grid.
- `<meta name="theme-color">` is set per theme (light `#F2F2F7`, dark `#1E242C`) and updated on toggle; `color-scheme` set accordingly.

## 3. Theme switching

- New `app/src/lib/theme.ts`: `type ThemePref = "system" | "light" | "dark"`; `getThemePref()`, `setThemePref(p)`, `resolveTheme(p, prefersDark): "light"|"dark"`, `applyTheme(resolved)` (sets `data-theme` on `<html>`, `color-scheme`, and the theme-color meta). Storage key `theme-pref` in `localStorage`, wrapped in try/catch (private mode → "system").
- `useTheme()` hook: current pref + setter; listens to `matchMedia("(prefers-color-scheme: dark)")` changes when pref is "system".
- **No flash:** a tiny inline script in `index.html` `<head>` reads `theme-pref` and the media query and sets `data-theme` before first paint.
- Cooking mode always renders with the dark token set (`data-theme="dark"` scoped on its root) regardless of the global theme.

## 4. App frame and navigation

- **Desktop frame:** at ≥ 600px viewport width, the app root becomes a centered column `max-width: 430px`, full height, with rounded outer corners (24px) and a soft shadow on a slightly darker page backdrop. The tab bar, sheets and fixed elements are positioned relative to this column, never the full window.
- **Large-title header** (new `components/ui/LargeTitleHeader.tsx`): page title 30px/800 at the top of scrollable content; when the user scrolls past it, a compact frosted bar (`--bar` + `backdrop-blur`) fades in with the title centred at 17px/600. Avatar button (initial on accent circle) at the inline-end side opens the Settings sheet. Feed and favourites put the search field and category chips under the large title.
- **Tab bar** (rewrite `components/Layout.tsx` nav): frosted, hairline top border, 4 items with SVG line icons + labels (בית, מועדפים, הוספה, ניהול for admins), active = accent, inactive = `--text-2`, height 49px + `env(safe-area-inset-bottom)`. **הוספה** opens the Add sheet instead of navigating (route `/add` still works and opens the sheet over the feed, so the share target keeps working).
- **Icons:** a small inline-SVG icon set in `components/ui/icons.tsx` (home, heart, heart-fill, plus-circle, gear, chevron, back, close, search, clock, users, check). No icon font, no new dependency.
- **Native feel (global CSS):** `-webkit-tap-highlight-color: transparent`; `user-select: none` on buttons/tabs; a press state (`active:scale-[.97]` + slight opacity) on cards, buttons, rows; `overscroll-behavior-y: none` on the app shell; route transitions: 200ms fade/slide via CSS on route change; all motion disabled under `prefers-reduced-motion`.
- **Safe areas:** `viewport-fit=cover` (already set) + insets on header and tab bar.

## 5. Screens

1. **Feed / Favourites** (`FeedPage`, `RecipeCard`, `CategoryChips`, `SearchBar`):
   - 2-column grid, gap 10px; card = square photo, heart in a 28px frosted circle at the photo's top inline-start corner, title 13px/600 (2 lines max), one caption line "קטגוריה · זמן" in `--text-2`.
   - Search: iOS search field (`--fill`, magnifier icon, 10px radius). Chips: pill, `--surface` background, active = accent with `--on-accent` text.
   - Loading: 6 skeleton cards with a subtle shimmer (static under reduced motion) instead of "טוען…". Empty and error states: centred icon + text + (for error) a "נסו שוב" button, same copy as today.
   - Push prompt and iOS install hint restyled as inset rounded banners using tokens.
2. **Recipe** (`RecipePage`):
   - Full-bleed photo (no image → accent-soft panel with the dish emoji) ~ 40% of viewport height; round frosted back (chevron) and heart buttons over it, respecting the top safe area.
   - Content sheet overlaps the photo by 24px with top radius 24px, `--surface` background.
   - Title 22px/800; source + "שותף ע״י … ב-…" line; 3 stat tiles (time, servings, category) on `--fill`, hidden individually when missing.
   - "מרכיבים": grouped list, round check-circles (accent when checked, strike-through text). "אופן הכנה": numbered steps with accent-soft number badges.
   - Floating "התחילו לבשל" button (accent, 50px, 14px radius, soft accent shadow) pinned above the safe area; page content has bottom padding so nothing hides behind it.
3. **Cooking mode** (`CookingMode`): always dark tokens; segmented progress bars at the top (one per step, accent for done/current); "שלב X מתוך Y" + close (✕) in the top row; step text 26px/600 (smaller for long steps, existing rule); ingredient chips in accent-soft; bottom buttons: הבא (accent) / הקודם (`--fill`), 52px; existing swipe, keys, wake-lock behaviour unchanged.
4. **Add recipe** (`AddRecipePage` → rendered inside new `components/ui/Sheet.tsx`): bottom sheet with grabber, header row (ביטול · מתכון חדש), link field (LTR), note field, accent "הוספה" button, status cards below. Opened from the tab or `/add` (share target); closing returns to the previous screen (or `/`). Existing prefill, dedupe, realtime/polling logic unchanged.
5. **Settings sheet** (new `components/SettingsSheet.tsx`, opened from the avatar): account row (display name + email from session), "מראה" segmented control מערכת / בהיר / כהה, notifications toggle (reflects permission + subscription; turning on runs the existing opt-in flow), sign-out row in `--danger`.
6. **Admin** (`AdminPage` + admin components): segmented control instead of pill tabs; review queue / allow-list / editor as iOS grouped lists on `--surface`; inputs and buttons use tokens. Behaviour unchanged.
7. **Login / members-only / error screens**: centred card on `--bg`, app icon above the title, iOS-style fields and buttons using tokens.

## 6. Shared UI primitives (new, `app/src/components/ui/`)

`Sheet` (bottom sheet: backdrop, grabber, focus trap, Esc/backdrop to close, slide-up animation), `LargeTitleHeader`, `GroupedList` + `ListRow`, `Segmented`, `Button` (primary/secondary/danger, sizes), `IconButton` (frosted round), `Skeleton`, `icons.tsx`. Each is small, token-only, and has a focused unit test where it has logic (Sheet open/close/focus; Segmented selection; LargeTitleHeader collapse state via a scroll-position prop).

## 7. Accessibility

Keep: one h1 per page, labelled inputs, ≥ 44px targets, role/aria on tabs and sheets (`role="dialog"`, `aria-modal`, labelled by its title), visible focus ring in accent, contrast ≥ 4.5:1 for text in both themes (`--text-2` on `--bg`/`--surface` verified in both).

## 8. Testing and verification

- Existing unit tests and both Playwright projects stay green; update selectors only where markup changed (e.g. Add is now a dialog; admin tabs are a segmented control) and say so per change.
- New unit tests: `theme.ts` (resolve, persist, apply, storage failure), `useTheme` (system change listener), `Sheet`, `Segmented`, `LargeTitleHeader`, Settings sheet (theme switch applies `data-theme`, sign-out calls signOut).
- Visual check: Playwright screenshots of feed, recipe, cooking, add sheet, settings sheet, admin and login — in light and dark, at 390×844 and 1280×800 — saved to `app/e2e/screenshots/` (git-ignored) and reviewed before merge.
- Deploy: merge to `main` → Vercel redeploys automatically.
