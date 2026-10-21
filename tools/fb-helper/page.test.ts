import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { chromium } from "npm:playwright@1.64.1";
import { NotLoggedInError, readPost } from "./page.ts";

// A page shaped like a Facebook post: collapsed caption, comments that load on the Comment button,
// and an ad column outside [role=main].
const FIXTURE = `<!doctype html><meta charset="utf-8"><body>
<div role="complementary"><a href="https://ads.test/buy">ad</a><div dir="auto">פרסומת צד</div></div>
<div role="main">
  <div dir="auto" id="cap">מאפינס זיתים…</div><div role="button" id="more">See more</div>
  <div role="button" aria-label="Comment" id="c"></div><div id="comments"></div>
</div>
<script>
  more.onclick = () => { cap.textContent = "מאפינס זיתים: 2 כוסות קמח, כף שמן"; more.remove(); };
  c.onclick = () => { comments.innerHTML = '<div role="article"><div dir="auto">המתכון המלא</div><a href="https://bit.ly/x">bit.ly/x</a></div>'; };
</script>`;

async function withPage(loggedIn: boolean, fn: (url: string, ctx: import("npm:playwright@1.64.1").BrowserContext) => Promise<void>) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  await ctx.route("https://www.facebook.com/share/p/test/", (r) => r.fulfill({ contentType: "text/html", body: FIXTURE }));
  if (loggedIn) await ctx.addCookies([{ name: "c_user", value: "1", domain: ".facebook.com", path: "/" }]);
  try { await fn("https://www.facebook.com/share/p/test/", ctx); } finally { await browser.close(); }
}

Deno.test({
  name: "readPost expands the caption, opens comments, and ignores the ad column",
  sanitizeResources: false, sanitizeOps: false,
  fn: () => withPage(true, async (url, ctx) => {
    const post = await readPost(ctx, url);
    assertEquals(post.texts.includes("מאפינס זיתים: 2 כוסות קמח, כף שמן"), true);
    assertEquals(post.texts.includes("המתכון המלא"), true);
    assertEquals(post.texts.includes("פרסומת צד"), false);
    assertEquals(post.hrefs, ["https://bit.ly/x"]);
  }),
});

Deno.test({
  name: "readPost refuses to read when the profile is not logged in",
  sanitizeResources: false, sanitizeOps: false,
  fn: () => withPage(false, async (url, ctx) => {
    await assertRejects(() => readPost(ctx, url), NotLoggedInError);
  }),
});
