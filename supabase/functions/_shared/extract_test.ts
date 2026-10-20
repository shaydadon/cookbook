import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { extractFromHtml, findRecipe, fullPostText } from "./extract.ts";

const RECIPE_LD = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebPage", name: "x" },
    { "@type": ["Recipe"], name: "Lemon Cake", recipeIngredient: ["2 eggs", "1 cup sugar"],
      recipeInstructions: [{ "@type": "HowToStep", text: "Mix." }] },
  ],
};

Deno.test("findRecipe walks @graph and type arrays", () => {
  assertEquals(findRecipe(RECIPE_LD)?.name, "Lemon Cake");
  assertEquals(findRecipe([{ "@type": "Organization" }]), null);
});

Deno.test("extractFromHtml prefers JSON-LD and reads meta tags", () => {
  const html = `<html><head><title>T</title>
    <meta property="og:title" content="עוגת לימון">
    <meta property="og:description" content="העוגה הכי טובה">
    <script type="application/ld+json">{ broken json </script>
    <script type="application/ld+json">${JSON.stringify(RECIPE_LD)}</script>
    </head><body><nav>תפריט</nav><article><p>מערבבים הכל</p></article><footer>©</footer></body></html>`;
  const ex = extractFromHtml(html);
  assertEquals(ex.jsonLdRecipe?.name, "Lemon Cake");
  assertEquals(ex.title, "עוגת לימון");
  assertEquals(ex.description, "העוגה הכי טובה");
  assertEquals(ex.text, "מערבבים הכל");
});

Deno.test("extractFromHtml falls back to <title> and body text", () => {
  const ex = extractFromHtml("<html><head><title>פשטידה</title></head><body><script>x()</script><p>3 ביצים</p></body></html>");
  assertEquals(ex.jsonLdRecipe, null);
  assertEquals(ex.title, "פשטידה");
  assertStringIncludes(ex.text, "3 ביצים");
});

// Israeli news/food sites (e.g. Israel Hayom) publish the recipe as a NewsArticle articleBody, not a Recipe.
Deno.test("extractFromHtml reads a JSON-LD article body when there is no Recipe", () => {
  const ld = {
    "@type": "NewsArticle", headline: "עוף קשיו",
    articleBody: "מצרכים: 200 גרם פרגיות, 1/2 כוס קשיו. אופן ההכנה: מטגנים את העוף, מוסיפים קשיו ומגישים.",
  };
  const html = `<html><head><script type="application/ld+json">${JSON.stringify(ld)}</script></head>
    <body><article>פרסומת: אסם-שדרות מנוע הצמיחה של הדרום</article></body></html>`;
  const ex = extractFromHtml(html);
  assertEquals(ex.jsonLdRecipe, null);
  assertStringIncludes(ex.articleBody ?? "", "200 גרם פרגיות");
});

Deno.test("fullPostText recovers the whole post from Facebook's truncated preview", () => {
  const full = "עוגת גבינה פירורים קלה להכנה\n\nמצרכים:\n2 וחצי כוסות קמח\n200 גרם חמאה\n\nהוראות הכנה:\nלשים בצק, אופים 40 דקות ב-180 מעלות.";
  // Facebook embeds post text as JSON with \uXXXX escapes for Hebrew
  const escaped = JSON.stringify(full).slice(1, -1)
    .replace(/[֐-׿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
  const html = `<html><head><meta property="og:description" content="עוגת גבינה פירורים קלה להכנה מצרכים: 2 וחצי כוסות קמח..." /></head>
    <body><script>{"story":{"message":{"text":"${escaped}"}},"other":"${"x".repeat(200)}"}</script></body></html>`;
  const out = fullPostText(html, "עוגת גבינה פירורים קלה להכנה מצרכים: 2 וחצי כוסות קמח...");
  assertStringIncludes(out ?? "", "הוראות הכנה");
  assertStringIncludes(out ?? "", "אופים 40 דקות");
});

Deno.test("fullPostText returns null when the page holds nothing beyond the preview", () => {
  const html = `<meta property="og:description" content="עוגת גבינה פירורים קלה להכנה מצרכים: 2 כוסות..." /><body>Log in</body>`;
  assertEquals(fullPostText(html, "עוגת גבינה פירורים קלה להכנה מצרכים: 2 כוסות..."), null);
});

// Israel Hayom recipe pages: an empty JSON-LD articleBody, a promo block in the only <article>, and the recipe in
// a separate post-content container. The text must come from the container that holds the recipe.
Deno.test("extractFromHtml takes the main content block, not a promo <article>", () => {
  const html = `<html><head><script type="application/ld+json">{"@type":"NewsArticle","articleBody":""}</script></head><body>
    <div class="single-post-content">מצרכים: 2 כוסות קמח תופח, 1 כוס יוגורט. אופן ההכנה: מערבבים, יוצרים בייגלים ואופים 25 דקות ב-200 מעלות.
      <p>מגישים חם עם שומשום.</p></div>
    <article style="position:relative">אסם-שדרות: מנוע הצמיחה של הדרום</article></body></html>`;
  const ex = extractFromHtml(html);
  assertEquals(ex.articleBody, null);
  assertStringIncludes(ex.text, "2 כוסות קמח תופח");
});

Deno.test("extractFromHtml still prefers a real <article> when it holds the content", () => {
  const html = `<html><body><nav>תפריט ראשי</nav><article><h1>עוגה</h1><p>${"מערבבים ואופים. ".repeat(20)}</p></article>
    <div class="related">כתבות נוספות</div></body></html>`;
  assertStringIncludes(extractFromHtml(html).text, "מערבבים ואופים");
});
