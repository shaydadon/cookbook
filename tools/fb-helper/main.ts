// Facebook helper: recovers recipes the server could not read from Facebook (login wall, or the recipe sits in
// the first comment / a linked site) using a real browser logged into a spare Facebook account on this PC.
//
//   npm run fb-helper:login   one-time: opens a browser window, log in to the spare account, close the window
//   npm run fb-helper         one pass (Task Scheduler runs this every 15 minutes)
//
// Needs tools/fb-helper/.env with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (never committed).
import { load } from "jsr:@std/dotenv@0.225";
import { chromium } from "npm:playwright@1.64.1";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { fetchSource } from "../../supabase/functions/_shared/fetch-source.ts";
import { recover, shouldTry, type TryState } from "./core.ts";
import { isLoggedIn, NotLoggedInError, readPost } from "./page.ts";

const HOME = `${Deno.env.get("LOCALAPPDATA") ?? Deno.env.get("HOME")}/cookbook-fb-helper`;
const PROFILE = `${HOME}/profile`;
const STATE = `${HOME}/state.json`;
const LOG = `${HOME}/helper.log`;
const PER_RUN = 5;

Deno.mkdirSync(HOME, { recursive: true });
const log = (msg: string) => {
  const line = `${new Date().toISOString()} ${msg}`;
  console.log(line);
  Deno.writeTextFileSync(LOG, line + "\n", { append: true });
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const launch = (headless: boolean) =>
  chromium.launchPersistentContext(PROFILE, { headless, channel: "chrome", locale: "he-IL", viewport: { width: 1280, height: 900 } });

if (Deno.args.includes("--login")) {
  const ctx = await launch(false);
  const page = ctx.pages()[0] ?? await ctx.newPage();
  await page.goto("https://www.facebook.com/login");
  console.log("Log in to the spare Facebook account in the window, then close the window.");
  await new Promise((r) => ctx.on("close", r));
  Deno.exit(0);
}

// Try one post without touching the database: npm run fb-helper -- --check <facebook url>
const check = Deno.args[Deno.args.indexOf("--check") + 1];
if (Deno.args.includes("--check") && check) {
  const ctx = await launch(true);
  try {
    if (!await isLoggedIn(ctx)) throw new NotLoggedInError();
    const raw = await recover(check, {
      readPost: (url) => readPost(ctx, url),
      fetchPage: (url) => fetchSource({ url, platform: "web", messageText: null }),
    });
    console.log(raw ? `RECIPE (${raw.length} chars):\n${raw.slice(0, 600)}` : "no recipe found");
  } finally {
    await ctx.close();
  }
  Deno.exit(0);
}

const env = { ...await load({ envPath: new URL("./.env", import.meta.url).pathname.replace(/^\/(\w:)/, "$1") }), ...Deno.env.toObject() };
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let state: Record<string, TryState> = {};
try { state = JSON.parse(Deno.readTextFileSync(STATE)); } catch { /* first run */ }

// Facebook links the server already failed on: needs_review (even with a short caption saved, which proved
// insufficient), or queued for an automatic refetch.
const { data: rows, error } = await db.from("recipes")
  .select("id, source_url, status")
  .eq("source_platform", "facebook")
  .or("status.eq.needs_review,and(status.eq.queued,fetch_retries.gte.1,raw_content.is.null)")
  .order("created_at", { ascending: false });
if (error) { log(`query failed: ${error.message}`); Deno.exit(1); }
const now = new Date();
// --all: one manual sweep over every failed Facebook recipe, ignoring the per-run and per-recipe limits.
const todo = Deno.args.includes("--all") ? rows! : rows!.filter((r) => shouldTry(state[r.id], now)).slice(0, PER_RUN);
log(`${todo.length} of ${rows!.length} failed Facebook recipes to try`);
if (!todo.length) Deno.exit(0);

const ctx = await launch(true);
if (!await isLoggedIn(ctx)) { log(new NotLoggedInError().message); await ctx.close(); Deno.exit(1); }
const deps = {
  readPost: (url: string) => readPost(ctx, url),
  fetchPage: (url: string) => fetchSource({ url, platform: "web", messageText: null }),
};
try {
  for (const [i, r] of todo.entries()) {
    if (i > 0) await sleep(20_000 + Math.random() * 20_000); // a person's pace, not a crawler's
    state[r.id] = { tries: (state[r.id]?.tries ?? 0) + 1, last: new Date().toISOString() };
    Deno.writeTextFileSync(STATE, JSON.stringify(state, null, 1));
    try {
      const raw = await recover(r.source_url, deps);
      if (!raw) { log(`no recipe  ${r.id} ${r.source_url}`); continue; }
      const { data: updated, error: upErr } = await db.from("recipes").update({
        raw_content: raw, title: null, status: "rewriting", fetch_retries: 3, attempts: 0, claims: 0, error: null,
        next_attempt_at: new Date().toISOString(), locked_until: null,
      }).eq("id", r.id) // still failed, and not claimed by the server's worker meanwhile
        .or(`status.eq.needs_review,and(status.eq.queued,raw_content.is.null,` +
          `or(locked_until.is.null,locked_until.lt.${new Date().toISOString()}))`).select("id");
      if (upErr) log(`update failed ${r.id}: ${upErr.message}`);
      else log(`${updated?.length ? "recovered" : "skipped (busy)"} ${r.id} ${raw.length} chars ${r.source_url}`);
    } catch (e) {
      if (e instanceof NotLoggedInError) { log(e.message); break; }
      log(`error ${r.id}: ${(e as Error).message}`);
    }
  }
} finally {
  await ctx.close();
}
