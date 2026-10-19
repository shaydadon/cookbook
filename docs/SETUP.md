# Setup

## 1. Supabase project
1. Create a project at https://supabase.com (region: closest to Israel, e.g. `eu-central-1`).
2. `npx supabase login` then `npx supabase link --project-ref <ref>`.
3. `npx supabase db push` (applies all migrations).
4. Authentication → Hooks → enable **Before User Created** → Postgres function `public.hook_before_user_created`.
5. Authentication → URL configuration: Site URL = your Vercel URL; add it to Redirect URLs.
6. Authentication → Providers → Google: create an OAuth client in Google Cloud Console (Web), paste client id/secret, add the Supabase callback URL shown there to Google's authorised redirect URIs.
7. SQL editor — seed yourself as admin and add the Vault secrets for the cron job:
   ```sql
   insert into public.allowed_emails (email, whatsapp_name, role) values ('shaydadon@gmail.com', 'שי', 'admin');
   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
   select vault.create_secret('<same value as WORKER_SECRET>', 'worker_secret');
   ```
   `WORKER_SECRET` must be a long random value (for example `openssl rand -hex 24`), never empty.

## 2. Function secrets
Generate VAPID keys once: `npx web-push generate-vapid-keys`.

`INGEST_SECRET` and `WORKER_SECRET` must be long random values, never empty. An empty or short secret leaves the endpoint open or guessable. Generate each one with `openssl rand -hex 24`, and use the same `WORKER_SECRET` value in the Vault (step 1.7).
```bash
npx supabase secrets set ANTHROPIC_API_KEY=... OPENAI_API_KEY=... OPENAI_IMAGE_MODEL=gpt-image-1 \
  INGEST_SECRET=$(openssl rand -hex 24) WORKER_SECRET=<same as vault worker_secret> \
  VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:shaydadon@gmail.com
npx supabase functions deploy
```
Never set `AI_FAKE` in production. (It is also honoured only for local URLs, but do not rely on that.)

### Verify the AI keys
The live Claude check has not been run yet. Put a real `ANTHROPIC_API_KEY` in `supabase/functions/.env` (copied from `.env.example`), then run this one smoke call (costs about 2 cents):
```bash
npx deno eval --node-modules-dir=auto --env-file=supabase/functions/.env 'import { Anthropic } from "./supabase/functions/_shared/npm.ts"; import { rewriteRecipe } from "./supabase/functions/_shared/rewrite.ts"; console.log(JSON.stringify(await rewriteRecipe("Pancakes: 1 cup flour, 1 egg, 1 cup milk. Whisk, fry 2 min per side.", new Anthropic()), null, 2));'
```
Expected: `{"kind":"ok","recipe":{"title":"<Hebrew>", ...}}` with Hebrew steps. If the API returns a 400 about `output_config.format` or `fallbacks`, stop and report the exact error. Do not switch to forced `tool_choice`.

## 3. WhatsApp gateway (Green API → whatsapp-webhook)
Green API posts straight to our `whatsapp-webhook` function; no Make in between. A personal number works on the
Business plan only (the free Developer plan forwards just 3 chats a month).
1. Create a Green API instance and link the WhatsApp number (Linked devices → scan the QR code); it must be in the recipes group.
2. Find the group id: console → All methods → getContacts → the entry with the group name (`…@g.us`).
3. Function secrets: `GREEN_API_WEBHOOK_TOKEN` (long random value) and `WHATSAPP_GROUP_IDS` (comma-separated group ids):
   `npx supabase secrets set GREEN_API_WEBHOOK_TOKEN=… WHATSAPP_GROUP_IDS=…@g.us`, then deploy `whatsapp-webhook`.
4. Instance settings → Webhooks:
   - Webhook Url: `https://<ref>.supabase.co/functions/v1/whatsapp-webhook`
   - Webhook authorization header: the same token (Green API sends it as `Authorization: Bearer <token>`)
   - On: incoming messages and files, messages sent from phone. Everything else off.
   - Off (instance settings): mark incoming messages read, mark read on reply.
5. Behaviour: links from the configured group (plain text, link preview, reply, photo/video caption) become recipes
   credited to the sender; every other chat and notification is answered 200 and dropped without logging its content.
   A temporary failure answers 500 and Green API redelivers after 60 s. Logs: Supabase → Edge Functions → whatsapp-webhook.

## 4. (Legacy) Make scenario
No longer used: point Green API at `whatsapp-webhook` instead (section 3). `ingest` still accepts `x-ingest-secret`
requests if a Make route is ever needed again.

## 5. Importing history
In WhatsApp: group → ⋮ → More → Export chat → **Without media**. Upload the `.txt` in the app's admin screen.

## 6. Local development
```bash
npm run db:start
cp supabase/functions/.env.example supabase/functions/.env   # AI_FAKE=1 by default
npm run functions:serve
npm run test:db && npm run test:unit && npm run test:integration
```
- To apply new migrations locally use `npm run db:reset`. `supabase stop` / `start` does not apply new migrations.
- The integration tests leave rows behind that break the counts in `rls.test.sql`. If integration tests ran first, run `npm run db:reset` before `npm run test:db`.
- The admin/push integration tests need `npm run functions:serve` running. CI excludes them with `--filter "/worker|variants|delivered|two links/"`.
- `process-recipe` answers 202 immediately and does the work in the background, so poll the row's `status` rather than expecting the result in the response.

For the local cron job, add Vault secrets with `project_url = http://host.docker.internal:54321` and `worker_secret = local-worker-secret` in Studio (http://127.0.0.1:54323).

## 7. CI/CD
`.github/workflows/deploy-backend.yml` runs on push to `main` (paths `supabase/**`): unit tests, local Supabase, DB tests, then the integration tests that do not need served functions, then `db push` and `functions deploy`. Add repository secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` and `SUPABASE_PROJECT_REF`; without them the deploy job skips with a warning.

## 8. PWA on Vercel
1. Import the GitHub repo in Vercel; set **Root Directory** = `app`.
2. Environment variables (Production): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Supabase → Settings → API), `VITE_VAPID_PUBLIC_KEY` (same public key as the function secret). Preview deployments need their URL added to Supabase Redirect URLs before sign-in works there.
3. Deploy. Copy the `https://<name>.vercel.app` URL into Supabase → Authentication → URL configuration (Site URL and Redirect URLs). No Google change is needed — sign-in redirects through the Supabase callback already added in step 1.6.
4. On Android Chrome: open the URL → "Install app". On iPhone Safari: Share → "Add to Home Screen" (needed for push).
5. Test the share sheet: install the app first (step 4); it appears in the share sheet only after installation. Then in Instagram/TikTok tap Share → the app → the Add screen opens with the link filled in.
