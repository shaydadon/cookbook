// Browser side of the Facebook helper: opens a post in the logged-in profile, expands the caption and the
// comments, and returns the raw texts and hrefs. Deciding what is a recipe happens in core.ts.
import type { BrowserContext } from "npm:playwright@1.64.1";

export class NotLoggedInError extends Error {
  constructor() { super("Facebook is not logged in in the helper profile — run: npm run fb-helper:login"); }
}

const SEE_MORE = /^(See more|עוד|ראה עוד|הצג עוד)$/;
const COMMENT_LABEL = /^(Comment|Leave a comment|תגובה|הגב|כתוב תגובה)/i;

export async function readPost(ctx: BrowserContext, url: string): Promise<{ texts: string[]; hrefs: string[] }> {
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(5000);
    if (!await isLoggedIn(ctx)) throw new NotLoggedInError();
    // Runs in the browser. Kept as a string so Deno does not type-check DOM code.
    const expand = `(() => { for (const b of document.querySelectorAll('[role=button]'))
      if (${SEE_MORE}.test(b.innerText.trim())) try { b.click() } catch {} })()`;
    await page.evaluate(expand);
    await page.waitForTimeout(1200);
    await page.evaluate(`(() => { const b = [...document.querySelectorAll('[role=button][aria-label]')]
      .find((b) => ${COMMENT_LABEL}.test(b.getAttribute('aria-label'))); if (b) b.click() })()`);
    await page.waitForTimeout(3500);
    await page.evaluate(expand);
    await page.waitForTimeout(800);
    // Only the post and its comments: the right-hand column holds ads and suggested pages. Reels open their
    // comments as [role=article] blocks outside [role=main].
    return await page.evaluate(`(() => {
      const main = [...document.querySelectorAll('[role=dialog], [role=main]')];
      const loose = [...document.querySelectorAll('[role=article]')]
        .filter((a) => !a.parentElement.closest('[role=dialog], [role=main], [role=article]'));
      const roots = [...main, ...loose];
      const scope = roots.length ? roots : [document.body];
      const texts = [], hrefs = [];
      for (const r of scope) {
        for (const e of r.querySelectorAll('div[dir=auto], span[dir=auto]')) texts.push(e.innerText);
        for (const a of r.querySelectorAll('a[href]')) hrefs.push(a.href);
      }
      return { texts, hrefs };
    })()`) as { texts: string[]; hrefs: string[] };
  } finally {
    await page.close();
  }
}

/** Facebook sets c_user only for a logged-in session. */
export async function isLoggedIn(ctx: BrowserContext): Promise<boolean> {
  const cookies = await ctx.cookies("https://www.facebook.com");
  return cookies.some((c) => c.name === "c_user");
}
