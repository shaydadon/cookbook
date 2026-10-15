# PWA follow-ups

Known, accepted gaps from the PWA build (final review: "can wait"). None block the first family rollout.

## Worth doing soon
- **Offline mid-session:** if the connection drops while the app is open, an uncached feed/search stays on "טוען…" (offlineFirst pauses retries). Fix: `retry: (n) => navigator.onLine && n < 1` in the QueryClient defaults, or treat `fetchStatus === "paused"` as offline in FeedPage.
- **Favourites offline:** `favorites` reads aren't cached by the SW, so hearts show empty offline.
- **Magic-link resend:** after "שלחנו קישור" there's no way to change the email or resend.
- **Google non-member message** is chosen by a regex on the auth error text — verify against the real Google + hook redirect on the first deploy.

## First-deploy smoke checklist (can't be tested locally)
- Android: share from Instagram/TikTok → the app appears in the share sheet → Add screen pre-filled.
- iPhone: Add to Home Screen → sign in inside the installed app (Safari and the home-screen app keep separate storage) → push prompt → notification click opens the recipe.
- Deep-link reload on `/recipe/<id>` (Vercel rewrite), `/sw.js` served with `Cache-Control: no-cache`.
- One update cycle after a redeploy: the open app reloads exactly once.

## Polish
- Cooking mode: step text isn't in a live region; dead-end screens have no back link; wake-lock re-acquire could leak a sentinel.
- Editor: tags aren't normalised (dedupe / max 5) on save; renaming a group header flattens that group's ingredients.
- Add page: a stray "." can remain in the note after URL punctuation stripping; balanced ")" is stripped.
- Signed-out share is lost: `/add?url=…` redirects to login and the link is dropped.
- `tsconfig.app.json` includes Node types (only one test needs them).
- Main bundle ~505 kB — optional vendor chunk for supabase-js; optional immutable caching for `/assets/*` on Vercel.

## Tests / tooling
- E2E: `pwa-preview` project builds on every `npm run e2e`; `reuseExistingServer` can hit a stale server; `functions:serve` first start sometimes fails ("must be a directory") — retry.
- Some unit tests still use arrow-form `beforeEach(() => x.mockReset())` (Vitest 5 treats the returned mock as teardown — benign today).
- Gaps: no-wakeLock branch, visibility re-acquire, route keys for feed vs favourites, user-switch cache clear.
