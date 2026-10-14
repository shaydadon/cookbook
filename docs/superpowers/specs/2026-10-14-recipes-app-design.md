# Recipes App — Design Spec

**Date:** 2026-10-14
**Owner:** Shay Dadon
**Status:** Approved in brainstorming, pending written-spec review

## 1. Goal

A private, Hebrew, installable PWA recipe book that fills itself from the recipe links a WhatsApp group shares. Every shared link (recipe site, Instagram, TikTok, YouTube, Facebook) becomes a structured recipe whose text is **rewritten by AI in original Hebrew** (not copied) and whose photo is **AI-generated**. New recipes appear automatically and members get a push notification.

### Success criteria

- A link posted in the WhatsApp group appears as a published Hebrew recipe in the app within ~5 minutes, without anyone touching it.
- Links whose content can't be extracted never produce invented recipes; they land in an admin review queue.
- The group's historical links can be imported once from a chat export.
- Only allow-listed group members can sign in.
- The app installs to the home screen (Android and iOS), works RTL, and opened recipes are readable offline.

### Non-goals (v1)

Servings scaler, shopping list, comments/ratings, nutrition, member editing, bilingual content, public access.

## 2. Decisions made

| Topic | Decision |
|---|---|
| WhatsApp ingestion | Unofficial linked-device gateway (default: Green API; Whapi.Cloud is a drop-in alternative) on a **dedicated SIM** added to the group. Accepted risk: possible number ban, mitigated by read-only usage. |
| Orchestration | **Hybrid**: Make.com only routes (filter "has link" → POST to backend). All processing lives in our backend. |
| Backend | **Supabase**: Postgres, Auth, Storage, Edge Functions (Deno), pg_cron, pg_net. |
| Frontend hosting | Vercel (`*.vercel.app` until a domain is bought). |
| Text AI | Claude (`claude-sonnet-5-5`) via tool use with a strict JSON schema. |
| Image AI | OpenAI image model, one image per recipe. |
| Access | Private. Magic link or Google sign-in, gated by an allow-list. |
| Language | Hebrew only, RTL. All recipes rewritten into Hebrew regardless of source language. |
| Repo | New repo at `C:\xampp\htdocs\recipes-app`, separate from SDmarketing. |

## 3. Architecture

```
WhatsApp group
   │  gateway (Green API) linked to dedicated number
   ▼
Make scenario ── message contains URL? ──no──▶ drop
   │ yes: POST /ingest  {url, message_text, sender_name, sent_at}  + X-Ingest-Secret
   ▼
Edge Function `ingest`
   │ extract & normalize URL(s) → dedupe → upsert recipe (status=queued) + insert share
   │ fire-and-forget call to `process-recipe`
   ▼
Edge Function `process-recipe`  (also invoked by pg_cron every minute via pg_net)
   claims one row with FOR UPDATE SKIP LOCKED, runs the next pending step:
   fetching → rewriting → imaging → published
   ▼
Postgres (RLS) + Storage bucket `recipe-images`
   ▼
PWA (React/Vite/TS, RTL) on Vercel ── supabase-js reads directly
   ▲
   └─ Web Push (VAPID) sent by worker on publish
```

All entry points — Make, the in-app "add link" form, the OS share target, and the chat-export importer — call the same `ingest` function.

### 3.1 Edge Functions

| Function | Auth | Responsibility |
|---|---|---|
| `ingest` | `X-Ingest-Secret` header (Make) **or** member JWT (app) | Extract URLs from payload, normalize, dedupe, create recipe/share rows, kick the worker. Returns `{recipe_id, status, duplicate}` per URL. |
| `process-recipe` | Service role / cron secret | Claim one recipe and advance it exactly one step. Re-invokes itself if more work remains, so each invocation stays well inside Edge Function time limits. |
| `import-chat` | Admin JWT | Accept a WhatsApp `.txt` export, parse messages (Android + iOS formats, Hebrew/English date formats), call ingest logic for each link with original sender and date, `via='import'`. |
| `admin-action` | Admin JWT | `retry` (optionally with pasted `raw_content`), `regenerate-image`, `delete`. |
| `push-subscribe` | Member JWT | Store / remove a Web Push subscription. |

### 3.2 Processing pipeline

Statuses: `queued → fetching → rewriting → imaging → published`, plus terminal `needs_review` and `failed`. Each step persists its output before advancing, so retries resume rather than restart.

1. **Fetch** (`fetching`) — produce `raw_content` (plain text, capped ~15k chars):
   1. Expand short links (follow redirects).
   2. HTML: if JSON-LD `@type: Recipe` exists, serialize it (best case).
   3. Else: OpenGraph/meta tags + main readable text.
   4. Instagram / TikTok / YouTube / Facebook: caption/description via oEmbed or meta tags.
   5. Append the WhatsApp `message_text` (often contains the recipe itself).
   6. If nothing usable remains → `needs_review` with reason.
2. **Rewrite** (`rewriting`) — Claude call (see §5). If the model returns `insufficient_content: true` → `needs_review`. On success, write structured fields.
3. **Image** (`imaging`) — OpenAI image call with Claude's `image_prompt` wrapped in the fixed house style; convert to WebP, upload to Storage, set `image_path`. If it fails after retries, publish anyway with a placeholder and record the error.
4. **Publish** — set `published_at`, send Web Push to all subscriptions (prune subscriptions that return 404/410).

**Retries:** each step up to 3 attempts with backoff (1 min, 5 min, 15 min, via `next_attempt_at`). After that → `failed` with `error`. Admin can retry from the UI.

### 3.3 URL normalization & dedupe

Lowercase host, strip `www.`, strip tracking params (`utm_*`, `fbclid`, `igshid`, `si`, `ref`, etc.), strip fragments and trailing slash, resolve short links (`bit.ly`, `vm.tiktok.com`, `youtu.be`, …) to canonical form. `source_url_normalized` is unique; a repeat share adds a `shares` row only.

## 4. Data model

```sql
members            (id uuid pk = auth.users.id, email text, display_name text,
                    whatsapp_name text, role text check (role in ('admin','member')),
                    created_at timestamptz)
allowed_emails     (email text pk, whatsapp_name text, role text default 'member')
recipes            (id uuid pk, status text, source_url text,
                    source_url_normalized text unique, source_platform text,
                    raw_content text, title text, description text,
                    ingredients jsonb,   -- [{group, name, amount, unit, note}]
                    steps jsonb,         -- [{text}]
                    prep_minutes int, cook_minutes int, servings int,
                    category text, tags text[], image_prompt text, image_path text,
                    search_text text,    -- generated: title + ingredient names + tags
                    error text, attempts int default 0, next_attempt_at timestamptz,
                    created_at timestamptz, updated_at timestamptz, published_at timestamptz)
shares             (id uuid pk, recipe_id uuid fk, shared_by_name text,
                    message_text text, shared_at timestamptz,
                    submitted_by uuid null fk members,  -- set when added from the app
                    via text check (via in ('whatsapp','app','import')))
favorites          (member_id uuid fk, recipe_id uuid fk, created_at, pk(member_id, recipe_id))
push_subscriptions (id uuid pk, member_id uuid fk, endpoint text unique,
                    p256dh text, auth text, created_at)
```

- **Search:** `pg_trgm` GIN index on `search_text` (Postgres has no Hebrew FTS dictionary; trigrams handle partial words).
- **Categories (fixed enum, Hebrew):** ארוחת בוקר, מנות עיקריות, תוספות, סלטים, מרקים, אפייה וקינוחים, לחמים ובצקים, משקאות, נשנושים.
- **Tags:** free-form, normalized (trimmed, deduped, lowercased where applicable).

### 4.1 Auth & RLS

- Sign-in: Supabase Auth magic link + Google OAuth.
- A `before user created` auth hook rejects emails not in `allowed_emails`; on success a trigger creates the `members` row with the role from `allowed_emails`.
- RLS:
  - `recipes`: members `select` where `status='published'` or they are `submitted_by` on one of its shares; admins `select` all and `update`/`delete`. No client inserts (only Edge Functions with service role).
  - `shares`: members `select` shares of published recipes.
  - `favorites`, `push_subscriptions`: members manage only their own rows.
  - `allowed_emails`, `members`: admins manage; members read own `members` row and display names.
- Storage bucket `recipe-images`: public read, unguessable UUID paths, writes by service role only.

## 5. AI prompts

### 5.1 Claude rewrite

- Model `claude-sonnet-5-5`, single forced tool call `save_recipe` with a JSON schema mirroring the recipe fields plus `insufficient_content: boolean`, `image_prompt: string` (English).
- System prompt rules:
  - Write natural, original Hebrew; do not translate or copy sentences verbatim.
  - Preserve ingredients and quantities exactly; convert to metric where sensible but keep cups/spoons common in Israeli home cooking.
  - Choose `category` only from the fixed list.
  - Never invent a recipe; if the content lacks ingredients or steps, return `insufficient_content: true`.
  - `image_prompt`: concise English description of the finished dish only (no text, no people).
- Output validated against the schema with zod (`npm:zod` in Deno); invalid output counts as a failed attempt.

### 5.2 Image house style

`"{image_prompt}. Professional food photography, natural window light, 45-degree angle, neutral linen and wood surface, shallow depth of field, appetizing, no text, no hands."` — 1024×1024, stored as WebP.

## 6. PWA

**Stack:** React + Vite + TypeScript, `vite-plugin-pwa` (Workbox), Tailwind (RTL, `dir="rtl"`, `lang="he"`), TanStack Query, React Router, `supabase-js`, Heebo font.

**Screens:**
1. **Login** — magic link / Google; clear "group members only" error.
2. **Feed** — newest first, image cards (image, title, total time, ❤️), search bar, horizontally scrolling category chips. Infinite scroll.
3. **Recipe** — hero image, title, description, times/servings, grouped ingredients with tick-off checkboxes, numbered steps, attribution line ("מקור: {site} · שותף ע״י {name} ב-{date}"), "התחל לבשל" button.
4. **Cooking mode** — full-screen, one step at a time, large type, swipe/buttons, ingredients relevant to the step listed below, Screen Wake Lock API.
5. **Favorites** — feed filtered to the member's favorites.
6. **Add recipe** — paste link + optional note; also the PWA `share_target` (GET) pre-fills it. Shows a live status card via Supabase Realtime on the recipe row (RLS lets the submitter read their own non-published recipe, see §4.1).
7. **Admin** (role=admin) — review queue (`needs_review`/`failed`) with error, paste-content box and retry; edit/delete any recipe; regenerate image; chat-export upload; allow-list management.

**Push:** soft prompt after first sign-in (never on first paint); Web Push with VAPID; iOS requires home-screen install (16.4+), so show an install guide on iOS Safari.

**Offline:** Workbox caches app shell; runtime cache (stale-while-revalidate) for viewed recipes' API responses and images. Writes require connectivity.

## 7. Error handling summary

| Failure | Behaviour |
|---|---|
| Missing/invalid ingest secret | 401, nothing stored |
| Message has no URL | Dropped in Make; `ingest` returns 400 as a second check |
| Duplicate URL | New `shares` row only; returns `duplicate: true` |
| Fetch blocked / empty | Retry ×3, then `needs_review` |
| Claude says insufficient | `needs_review` immediately (no retry) |
| Claude invalid JSON / API error | Retry ×3, then `failed` |
| Image failure | Retry ×3, then publish with placeholder |
| Concurrent workers | `FOR UPDATE SKIP LOCKED` row claim |
| Dead push subscription | Deleted on 404/410 |

## 8. Testing

- **Unit (Deno test for functions, Vitest for app):** URL normalization/dedupe; chat-export parser (Android + iOS fixtures, Hebrew dates, multi-line messages); JSON-LD and meta extraction on saved HTML fixtures; AI output schema validation; ingredient/step rendering helpers.
- **Integration:** local Supabase (`supabase start`) with Claude/OpenAI/HTTP fetch mocked; covers the full status machine, retries/backoff, dedupe, and RLS (member cannot write recipes, non-allow-listed email cannot sign up, member cannot read non-published recipes).
- **E2E (Playwright, mobile viewport, RTL):** sign-in (test user), feed, search, category filter, recipe page, cooking mode, favorite toggle, add-link flow, admin retry.

## 9. Costs (estimate per recipe)

Claude ≈ 1–3¢; OpenAI image ≈ 4–8¢ depending on quality; Supabase & Vercel free tiers (free Supabase projects pause after ~1 week of inactivity — new recipes keep it active); WhatsApp gateway free–$40/month depending on provider and plan; Make within free tier. Prices to be verified at setup time.

## 10. Manual setup (owner)

A step-by-step `SETUP.md` will cover: creating the Supabase project and secrets (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `INGEST_SECRET`, VAPID keys); Google OAuth credentials; Vercel project; gateway account + dedicated SIM joined to the group; Make scenario (Gateway webhook → filter URL → HTTP POST to `ingest`); seeding `allowed_emails` with the owner as admin.

## 11. Project layout

```
recipes-app/
  app/                    # React PWA (Vite)
  supabase/
    migrations/           # SQL schema, RLS, cron
    functions/
      _shared/            # normalize-url, extract, claude, openai-image, push, db
      ingest/  process-recipe/  import-chat/  admin-action/  push-subscribe/
  e2e/                    # Playwright
  docs/superpowers/specs/
  SETUP.md
```
