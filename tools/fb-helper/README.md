# Facebook helper

Facebook hides most posts from servers: a login wall, or the recipe sits in the first comment as a link.
This helper runs on a PC, in a real Chromium browser logged into a **spare** Facebook account, and does what a
person would do: opens the post, expands "See more", opens the comments, and follows links to recipe sites.
Whatever it finds goes to the pipeline like an admin paste (`raw_content`, status `rewriting`).

It only touches Facebook recipes the server already failed on at least once, at most 5 per run, 20–40 s apart,
and gives up on a recipe after 2 tries 6 hours apart. Those stay in "needs review" for an admin to paste.

## Setup (once)

1. `tools/fb-helper/.env` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (gitignored).
2. `npm run fb-helper:login`: log in to the spare account in the window that opens, then close it.
3. Schedule it: `powershell -File tools/fb-helper/install-task.ps1` (every 15 minutes, hidden).

## Use

- `npm run fb-helper`: one pass (what the scheduled task runs).
- `npm run fb-helper -- --check <facebook url>`: try one post, no database writes.
- Log, state and browser profile: `%LOCALAPPDATA%\cookbook-fb-helper\`.
- If the log says "not logged in", run the login step again.
