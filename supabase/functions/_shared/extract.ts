import { parseHTML } from "./npm.ts";

export interface Extracted {
  jsonLdRecipe: Record<string, unknown> | null;
  title: string | null;
  description: string | null;
  /** JSON-LD Article/NewsArticle/BlogPosting body: news and food sites often publish the recipe this way. */
  articleBody: string | null;
  text: string;
}

const ARTICLE_TYPES = ["Article", "NewsArticle", "BlogPosting", "ReportageNewsArticle"];

function findByType(node: unknown, wanted: string[]): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findByType(n, wanted);
      if (r) return r;
    }
    return null;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const t = obj["@type"];
    const types = Array.isArray(t) ? t : [t];
    if (types.some((x) => wanted.includes(x as string))) return obj;
    if (obj["@graph"]) return findByType(obj["@graph"], wanted);
  }
  return null;
}

export function findRecipe(node: unknown): Record<string, unknown> | null {
  return findByType(node, ["Recipe"]);
}

const MIN_ARTICLE_BODY = 40;

const decodeEntities = (s: string) =>
  s.replace(/&#x([0-9a-f]+);/gi, (_, x) => String.fromCodePoint(parseInt(x, 16)))
    .replace(/&#(\d+);/g, (_, x) => String.fromCodePoint(Number(x)))
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Social pages show only a truncated caption in og:description ("…"), but the full post text is usually
 * embedded elsewhere in the page (JSON data or attributes). Returns the longest text in the page that
 * starts like the preview, or null when the page holds nothing longer than the preview itself.
 */
export function fullPostText(html: string, preview: string): string | null {
  const head = squash(decodeEntities(preview)).replace(/(\.\.\.|…)$/u, "");
  const probe = head.slice(0, 40);
  if (probe.length < 20) return null;
  let best = "";
  const consider = (s: string) => {
    const at = s.indexOf(probe);
    if (at >= 0 && s.length - at > best.length) best = s.slice(at);
  };
  for (const m of html.matchAll(/"((?:[^"\\\n]|\\.){80,})"/g)) {
    try {
      consider(squash(decodeEntities(JSON.parse(`"${m[1]}"`))));
    } catch {
      // not a JSON string literal (e.g. an attribute value with a stray backslash)
    }
  }
  for (const m of html.matchAll(/(?:content|title|aria-label)="([^"]{80,})"/g)) consider(squash(decodeEntities(m[1])));
  const stripped = best.replace(/(\.\.\.|…)$/u, "");
  return stripped.length > head.length + 20 ? stripped : null;
}

export function extractFromHtml(html: string): Extracted {
  // linkedom's typings declare the return as Window & typeof globalThis, which lacks `document`
  // deno-lint-ignore no-explicit-any
  const { document } = parseHTML(html) as unknown as { document: any };

  let jsonLdRecipe: Record<string, unknown> | null = null;
  let articleBody: string | null = null;
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const ld = JSON.parse(s.textContent ?? "");
      jsonLdRecipe = findRecipe(ld);
      const body = findByType(ld, ARTICLE_TYPES)?.articleBody;
      if (!articleBody && typeof body === "string" && body.trim().length >= MIN_ARTICLE_BODY) articleBody = body.trim();
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

  return { jsonLdRecipe, title, description, articleBody, text };
}
