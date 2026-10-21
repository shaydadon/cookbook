import { assertEquals } from "jsr:@std/assert@1";
import { buildRawContent, externalLinks, isRecipePage, pickPostText, recipeScore, recover, type RecoverDeps, shouldTry, videoText } from "./core.ts";

const RECIPE = "סלט חומוסים\nמרכיבים:\nקופסת חומוסים\nכפית פפריקה\nחצי כוס רימון\nכף שמן זית\nאופן הכנה: מערבבים";

Deno.test("recipeScore counts recipe words; chatter scores zero", () => {
  assertEquals(recipeScore(RECIPE) >= 4, true);
  assertEquals(recipeScore("מאיפה היו תבלינים כאלה בברית המועצות? אני כל החיים אכלתי את זה"), 0);
});

Deno.test("pickPostText takes the most recipe-like block and skips Messenger noise", () => {
  const texts = ["short", "Messages and calls are secured with end-to-end encryption " + RECIPE, "תגובה נחמדה מאוד על הסרטון הזה, תודה רבה!", RECIPE];
  assertEquals(pickPostText(texts), RECIPE);
});

Deno.test("pickPostText returns null when no block is a recipe", () => {
  assertEquals(pickPostText(["מתכון בתגובה הראשונה וגם בבלוג שלי, רוצו להכין!!!", "עוגת גבינה בחושה קלה – Yummy Barkil"]), null);
});

Deno.test("externalLinks unwraps Facebook redirects, drops Facebook/ad hosts and tracking params, dedupes", () => {
  const hrefs = [
    "https://l.facebook.com/l.php?u=https%3A%2F%2Fbit.ly%2F3Zjtptc%3Ffbclid%3Dabc&h=x",
    "https://bit.ly/3Zjtptc",
    "https://www.facebook.com/groups/123",
    "https://scontent.fbcdn.net/v/x.jpg",
    "https://www.meta.ai/",
    "https://media3.giphy.com/media/a/giphy.gif",
    "https://site.test/recipe?id=7&utm_source=fb",
    "not a url",
  ];
  assertEquals(externalLinks(hrefs), ["https://bit.ly/3Zjtptc", "https://site.test/recipe?id=7"]);
});

Deno.test("isRecipePage accepts structured recipes or recipe-like text, rejects other pages", () => {
  assertEquals(isRecipePage('נתוני מתכון מובנים (JSON-LD): {"@type":"Recipe","name":"עוגה"}'), true);
  assertEquals(isRecipePage(RECIPE), true);
  assertEquals(isRecipePage("כותרת: הופעות דניאל כהן – קומדי בר. כרטיסים להופעה הקרובה"), false);
});

Deno.test("buildRawContent joins the post text and linked recipe pages; null when empty", () => {
  const raw = buildRawContent("טקסט הפוסט", [{ url: "https://r.test/a", content: "עמוד המתכון" }]);
  assertEquals(raw, "טקסט הפוסט\n\nמתכון מלא מהקישור (https://r.test/a):\nעמוד המתכון");
  assertEquals(buildRawContent(null, []), null);
  assertEquals(buildRawContent("x".repeat(20000), [])!.length, 15000);
});


const PAGE = '{"@type":"Recipe","name":"מאפינס"} מצרכים: 2 כוסות קמח';
function deps(post: { texts: string[]; hrefs: string[] }, pages: Record<string, string | null>, seen: string[] = []): RecoverDeps {
  return {
    readPost: () => Promise.resolve(post),
    fetchPage: (url) => { seen.push(url); return Promise.resolve(pages[url] ?? null); },
  };
}

Deno.test("recover uses the post text when it is a recipe and also adds linked recipe pages", async () => {
  const raw = await recover("https://fb/p", deps({ texts: [RECIPE], hrefs: ["https://r.test/full"] }, { "https://r.test/full": PAGE }));
  assertEquals(raw, `${RECIPE}\n\nמתכון מלא מהקישור (https://r.test/full):\n${PAGE}`);
});

Deno.test("recover follows the first-comment link when the caption has no recipe, skipping non-recipe pages", async () => {
  const post = { texts: ["מאפינס זיתים וקוטג' קליל, זריז ומטריף! - Yummy Barkil"], hrefs: ["https://ad.test/show", "https://bit.ly/x"] };
  const raw = await recover("https://fb/p", deps(post, { "https://ad.test/show": "הופעות קומדי בר", "https://bit.ly/x": PAGE }));
  assertEquals(raw, `מתכון מלא מהקישור (https://bit.ly/x):\n${PAGE}`);
});

Deno.test("recover returns null when neither the post nor any link holds a recipe", async () => {
  assertEquals(await recover("https://fb/p", deps({ texts: ["סרטון יפה מאוד, תודה רבה על השיתוף!!"], hrefs: [] }, {})), null);
});

Deno.test("recover checks at most 4 links and survives a failing fetch", async () => {
  const seen: string[] = [];
  const hrefs = ["https://a.test/1", "https://a.test/2", "https://a.test/3", "https://a.test/4", "https://a.test/5"];
  const d = deps({ texts: [], hrefs }, {}, seen);
  const failing: RecoverDeps = { ...d, fetchPage: (u) => u.endsWith("/1") ? Promise.reject(new Error("boom")) : d.fetchPage(u) };
  assertEquals(await recover("https://fb/p", failing), null);
  assertEquals(seen, ["https://a.test/2", "https://a.test/3", "https://a.test/4"]);
});

Deno.test("shouldTry allows 2 tries per recipe, at least 6 hours apart", () => {
  const now = new Date("2026-10-21T12:00:00Z");
  assertEquals(shouldTry(undefined, now), true);
  assertEquals(shouldTry({ tries: 1, last: "2026-10-21T09:00:00Z" }, now), false);
  assertEquals(shouldTry({ tries: 1, last: "2026-10-21T05:00:00Z" }, now), true);
  assertEquals(shouldTry({ tries: 2, last: "2026-10-01T00:00:00Z" }, now), false);
});



Deno.test("videoText labels on-screen text and speech, dropping NONE and empty parts", () => {
  assertEquals(videoText({ onScreen: "מוסיף חופן צנובר", speech: "מוסיף שמן זית" }),
    "טקסט שמופיע בסרטון:\nמוסיף חופן צנובר\n\nתמלול הדיבור בסרטון:\nמוסיף שמן זית");
  assertEquals(videoText({ onScreen: "NONE", speech: "add two cups of pineapple juice" }),
    "תמלול הדיבור בסרטון:\nadd two cups of pineapple juice");
  assertEquals(videoText({ onScreen: "NONE", speech: "  " }), null);
});

const VIDEO = { onScreen: "NONE", speech: "מוסיפים כוס וחצי מיץ אננס ושתי כפות סויה, מבשלים רבע שעה" };

Deno.test("recover falls back to the video when neither the post nor its links hold a recipe", async () => {
  const d: RecoverDeps = { ...deps({ texts: ["אל תטגנו את העוף, רתחו אותו במיץ אננס! התוצאה מדהימה"], hrefs: [] }, {}), readVideo: () => Promise.resolve(VIDEO) };
  assertEquals(await recover("https://fb/v", d), `אל תטגנו את העוף, רתחו אותו במיץ אננס! התוצאה מדהימה\n\n${videoText(VIDEO)}`);
});

Deno.test("recover does not open the video when the post already has the recipe", async () => {
  let opened = false;
  const d: RecoverDeps = { ...deps({ texts: [RECIPE], hrefs: [] }, {}), readVideo: () => { opened = true; return Promise.resolve(VIDEO); } };
  assertEquals(await recover("https://fb/v", d), RECIPE);
  assertEquals(opened, false);
});

Deno.test("recover returns null when the video has nothing either, and survives a failing video read", async () => {
  const empty: RecoverDeps = { ...deps({ texts: [], hrefs: [] }, {}), readVideo: () => Promise.resolve({ onScreen: "NONE", speech: "" }) };
  assertEquals(await recover("https://fb/v", empty), null);
  const failing: RecoverDeps = { ...deps({ texts: [], hrefs: [] }, {}), readVideo: () => Promise.reject(new Error("no video")) };
  assertEquals(await recover("https://fb/v", failing), null);
});

Deno.test("recover keeps the post caption (first on the page), not a longer comment, with the video text", async () => {
  const texts = ["אל תטגנו את העוף, רתחו אותו במיץ אננס!", "אחרי כל זה הייתי זורק אותם על הגריל והם היו אפילו יותר מדהימים, ממליץ בחום לכולם"];
  const d: RecoverDeps = { ...deps({ texts, hrefs: [] }, {}), readVideo: () => Promise.resolve(VIDEO) };
  assertEquals(await recover("https://fb/v", d), `${texts[0]}\n\n${videoText(VIDEO)}`);
});
