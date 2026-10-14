import { extractFromHtml } from "./extract.ts";
import type { Platform } from "./types.ts";
import { BROWSER_HEADERS } from "./url.ts";

export const MAX_RAW_CONTENT = 15000;
export const MAX_HTML_BYTES = 2_000_000;
const MIN_USEFUL_CHARS = 40;

export interface SourceInput {
  url: string;
  platform: Platform;
  messageText: string | null;
}

const OEMBED: Partial<Record<Platform, string>> = {
  tiktok: "https://www.tiktok.com/oembed?url=",
  youtube: "https://www.youtube.com/oembed?format=json&url=",
};

export async function fetchSource(input: SourceInput, fetchFn: typeof fetch = fetch): Promise<string | null> {
  const parts: string[] = [];
  let networkError: Error | null = null;

  const oembed = OEMBED[input.platform];
  if (oembed) {
    try {
      const res = await fetchFn(oembed + encodeURIComponent(input.url));
      if (res.ok) {
        const j = await res.json();
        if (j.title) parts.push(`כיתוב הפוסט: ${j.title}`);
        if (j.author_name) parts.push(`יוצר: ${j.author_name}`);
      } else {
        await res.body?.cancel();
      }
    } catch (e) {
      networkError = e as Error;
    }
  }

  try {
    const res = await fetchFn(input.url, { headers: BROWSER_HEADERS, redirect: "follow" });
    if (res.ok && (res.headers.get("content-type") ?? "").includes("html")) {
      const html = (await res.text()).slice(0, MAX_HTML_BYTES);
      const ex = extractFromHtml(html);
      if (ex.jsonLdRecipe) {
        parts.push(`נתוני מתכון מובנים (JSON-LD):\n${JSON.stringify(ex.jsonLdRecipe)}`);
      } else if (input.platform === "web") {
        if (ex.title) parts.push(`כותרת: ${ex.title}`);
        if (ex.description) parts.push(`תיאור: ${ex.description}`);
        if (ex.text) parts.push(`תוכן העמוד:\n${ex.text}`);
      } else if (ex.description) {
        // social pages: the caption lives in og:description; the body is login-wall noise
        parts.push(`כיתוב הפוסט: ${ex.description}`);
      }
    } else {
      await res.body?.cancel();
    }
  } catch (e) {
    networkError = e as Error;
  }

  const fromSource = parts.join("\n\n").trim();
  const message = input.messageText?.trim() ?? "";

  if (fromSource.length < MIN_USEFUL_CHARS && message.length < MIN_USEFUL_CHARS) {
    if (networkError) throw networkError;
    return null;
  }

  const combined = [fromSource, message && `הודעת הוואטסאפ ששותפה עם הקישור:\n${message}`]
    .filter(Boolean)
    .join("\n\n");
  return combined.slice(0, MAX_RAW_CONTENT);
}
