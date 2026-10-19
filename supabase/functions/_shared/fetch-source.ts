import { extractFromHtml, fullPostText } from "./extract.ts";
import { isPublicHttpUrl, type SafeUrlOptions } from "./safe-url.ts";
import type { Platform } from "./types.ts";
import { BROWSER_HEADERS } from "./url.ts";

export const MAX_RAW_CONTENT = 15000;
export const MAX_HTML_BYTES = 2_000_000;
export const FETCH_TIMEOUT_MS = 15000;
const MIN_USEFUL_CHARS = 40;

/**
 * Facebook answers a cookie-less browser with HTTP 400, but serves crawlers the public post, including
 * the full caption (needed: og:description stops after ~200 characters, mid-ingredients).
 * Instagram likewise can serve a cookie-less browser a page with no caption, while crawlers get it.
 */
const CRAWLER_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
};
const HEADERS_FOR: Partial<Record<Platform, Record<string, string>>> = {
  facebook: CRAWLER_HEADERS,
  instagram: CRAWLER_HEADERS,
};

const LINK_RE = /https?:\/\/\S+/gi;

/** Reads at most maxBytes of the body, then cancels the stream. */
export async function readCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return (await res.text()).slice(0, maxBytes);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  const all = new Uint8Array(Math.min(total, maxBytes));
  let offset = 0;
  for (const c of chunks) {
    if (offset >= all.length) break;
    const piece = c.subarray(0, all.length - offset);
    all.set(piece, offset);
    offset += piece.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(all);
}

export interface SourceInput {
  url: string;
  platform: Platform;
  messageText: string | null;
}

const OEMBED: Partial<Record<Platform, string>> = {
  tiktok: "https://www.tiktok.com/oembed?url=",
  youtube: "https://www.youtube.com/oembed?format=json&url=",
};

export const MAX_REDIRECTS = 5;

/** The URL (or a redirect hop) points at a private/internal address: treat as "nothing usable", never retry. */
export class BlockedUrlError extends Error {
  constructor(detail = "") {
    super(detail ? `blocked url (${detail})` : "blocked url");
  }
}

/** Fetches with manual redirects, checking every hop against the SSRF guard. */
async function fetchPublic(
  url: string,
  init: RequestInit,
  fetchFn: typeof fetch,
  opts: SafeUrlOptions,
): Promise<Response> {
  let current = url;
  for (let hop = 0;; hop++) {
    if (!isPublicHttpUrl(current, opts)) throw new BlockedUrlError();
    const res = await fetchFn(current, { ...init, redirect: "manual" });
    const location = res.headers.get("location");
    if (res.status < 300 || res.status >= 400 || !location) return res;
    await res.body?.cancel();
    if (hop >= MAX_REDIRECTS) throw new BlockedUrlError("too many redirects");
    current = new URL(location, current).href;
  }
}

export async function fetchSource(
  input: SourceInput,
  fetchFn: typeof fetch = fetch,
  opts: SafeUrlOptions = {},
): Promise<string | null> {
  const parts: string[] = [];
  let networkError: Error | null = null;

  const oembed = OEMBED[input.platform];
  if (oembed) {
    try {
      const res = await fetchFn(oembed + encodeURIComponent(input.url), {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
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
    const res = await fetchPublic(input.url, {
      headers: HEADERS_FOR[input.platform] ?? BROWSER_HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    }, fetchFn, opts);
    if (res.status === 429 || res.status >= 500) {
      networkError = new Error(`HTTP ${res.status} from source`);
      await res.body?.cancel();
    } else if (res.ok && (res.headers.get("content-type") ?? "").includes("html")) {
      const html = await readCapped(res, MAX_HTML_BYTES);
      const ex = extractFromHtml(html);
      if (ex.jsonLdRecipe) {
        parts.push(`נתוני מתכון מובנים (JSON-LD):\n${JSON.stringify(ex.jsonLdRecipe)}`);
      } else if (input.platform === "web") {
        if (ex.title) parts.push(`כותרת: ${ex.title}`);
        if (ex.description) parts.push(`תיאור: ${ex.description}`);
        // the article body is the recipe itself; the first <article> on news sites is often a promo block
        if (ex.articleBody) parts.push(`תוכן הכתבה:\n${ex.articleBody}`);
        else if (ex.text) parts.push(`תוכן העמוד:\n${ex.text}`);
      } else if (ex.description) {
        // social pages: the caption lives in og:description (truncated) and in full in the page data;
        // the body is login-wall noise
        parts.push(`כיתוב הפוסט: ${fullPostText(html, ex.description) ?? ex.description}`);
      }
    } else {
      await res.body?.cancel();
    }
  } catch (e) {
    // A blocked URL is not a transient failure: fall through to the message text or null.
    if (!(e instanceof BlockedUrlError)) networkError = e as Error;
  }

  const fromSource = parts.join("\n\n").trim();
  const message = input.messageText?.trim() ?? "";

  // A message that is only the shared link carries no recipe; don't send it on as if it were content.
  const messageText = message.replace(LINK_RE, "").trim();
  if (fromSource.length < MIN_USEFUL_CHARS && messageText.length < MIN_USEFUL_CHARS) {
    if (networkError) throw networkError;
    return null;
  }

  const messagePart = message ? `הודעת הוואטסאפ ששותפה עם הקישור:\n${message}` : "";
  const sourcePart = fromSource.slice(0, Math.max(0, MAX_RAW_CONTENT - messagePart.length - 2));
  return [sourcePart, messagePart].filter(Boolean).join("\n\n").slice(0, MAX_RAW_CONTENT);
}
