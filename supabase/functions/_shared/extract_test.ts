import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { extractFromHtml, findRecipe } from "./extract.ts";

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
