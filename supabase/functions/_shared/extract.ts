import { parseHTML } from "./npm.ts";

export interface Extracted {
  jsonLdRecipe: Record<string, unknown> | null;
  title: string | null;
  description: string | null;
  text: string;
}

export function findRecipe(node: unknown): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipe(n);
      if (r) return r;
    }
    return null;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const t = obj["@type"];
    const types = Array.isArray(t) ? t : [t];
    if (types.includes("Recipe")) return obj;
    if (obj["@graph"]) return findRecipe(obj["@graph"]);
  }
  return null;
}

export function extractFromHtml(html: string): Extracted {
  // linkedom's typings declare the return as Window & typeof globalThis, which lacks `document`
  // deno-lint-ignore no-explicit-any
  const { document } = parseHTML(html) as unknown as { document: any };

  let jsonLdRecipe: Record<string, unknown> | null = null;
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      jsonLdRecipe = findRecipe(JSON.parse(s.textContent ?? ""));
    } catch {
      // malformed JSON-LD is common; skip it
    }
    if (jsonLdRecipe) break;
  }

  const meta = (selector: string): string | null =>
    document.querySelector(selector)?.getAttribute("content")?.trim() || null;
  const title = meta('meta[property="og:title"]') ?? (document.querySelector("title")?.textContent?.trim() || null);
  const description = meta('meta[property="og:description"]') ?? meta('meta[name="description"]');

  for (const el of document.querySelectorAll("script,style,noscript,nav,header,footer,aside,form,iframe,svg")) {
    el.remove();
  }
  // linkedom's `document.body` throws on fragment HTML with no <html> element (e.g. only a <script>, now removed)
  const safeBody = () => {
    try {
      return document.body;
    } catch {
      return null;
    }
  };
  const root = document.querySelector("article") ?? document.querySelector("main") ?? safeBody();
  const text = (root?.textContent ?? "").replace(/\s+/g, " ").trim();

  return { jsonLdRecipe, title, description, text };
}
