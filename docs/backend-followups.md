# Backend follow-ups

Known, accepted gaps from the backend build (final review: "can wait"). None block deploying for a family-size group.

## Before going public or growing the group
- **Prompt-injection hardening:** `rewrite.ts` strips `</?source>` in a single pass; nested tags (`</sou<source>rce>`) rebuild it. Loop the replace until stable.
- **SSRF:** `isPublicHttpUrl` checks literal IPs only. DNS names resolving to private IPs, some IPv6 forms (`::7f00:1`, NAT64, `fec0::/10`), multicast ranges, and `resolveUrl`'s follow-redirect for shorteners are not blocked. Submitters are authenticated members/Make only.
- **Free-plan wall clock:** Anthropic client uses `timeout: 120s, maxRetries: 1` → a call can run ~240 s. Set `maxRetries: 0` on the Supabase Free plan; the claim counter already stops a recipe after 3 killed runs.
- **Revoking access:** removing an `allowed_emails` row does not revoke an existing member. Delete the `members` row too (or add a delete trigger).
- Revoke EXECUTE on `is_member`/`is_admin`/`is_submitter` from `public, anon` (harmless today: they return false for anon).

## Robustness
- Re-delivery without `sent_at` is not idempotent — the Make scenario must always send `sent_at` (SETUP.md says so).
- No body-size / URL-count cap on `ingest`; no `content` size cap on `import-chat`; fractional `offset` → 500.
- Chat parser: invalid dates roll over; en-IL `pm` exports may parse month-first; system lines containing `:` can look like senders.
- `fetch-source`: removing `<form>` before picking the root can empty form-wrapped pages; WhatsApp text over 15k chars is truncated.
- Empty trimmed AI title is not treated as an error.
- Recipes ended by the claim counter (killed 3×) get no push; `imaging` ones are published without an image.

## Tests
- RLS tests lack anon / `allowed_emails` / push / role-escalation / shares cases.
- No tests for HTTP 405 / `withErrors` 500 paths, the member-JWT path of `ingest`, or post-system-line continuation in the chat parser.
- Integration tests leave rows behind: run `npm run db:reset` before `npm run test:db`.
- On Git Bash, prefix filtered test runs with `MSYS_NO_PATHCONV=1`.

## Cosmetic
- `supabase/.gitignore` duplicates root entries; CI `setup-deno` is redundant; deploy guard doesn't check `SUPABASE_DB_PASSWORD`.
