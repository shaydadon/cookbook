// Pure logic of the Facebook helper: deciding which text on a post is the recipe, which links may lead to it,
// and whether a linked page really is a recipe. The browser side (page.ts) only collects texts and hrefs.

const RECIPE_WORDS =
  /מצרכים|מרכיבים|רכיבים|אופן הכנה|הכנה:|כוס|כוסות|גרם|כף|כפות|כפית|כפיות|ingredients|instructions|cups?\b|tbsp|tsp|grams/gi;
// Facebook UI that sits in div[dir=auto] like post text (Messenger panel, obfuscated "sponsored" labels).
const NOISE = /͏|end-to-end|Message sent|participant/;
const MIN_SCORE = 3;
export const MAX_RAW = 15000;

export function recipeScore(text: string): number {
  return (text.match(RECIPE_WORDS) ?? []).length;
}

/** The most recipe-like text block on the post, or null when none looks like a recipe. */
export function pickPostText(texts: string[]): string | null {
  let best: string | null = null, bestScore = 0;
  for (const raw of texts) {
    const t = raw.trim();
    if (t.length < 40 || NOISE.test(t)) continue;
    const s = recipeScore(t);
    if (s > bestScore || (s === bestScore && best !== null && t.length > best.length)) { best = t; bestScore = s; }
  }
  return bestScore >= MIN_SCORE ? best : null;
}

const SKIP_HOSTS =
  /(^|\.)(facebook\.com|fbcdn\.net|fb\.me|fb\.watch|instagram\.com|messenger\.com|whatsapp\.com|meta\.ai|giphy\.com)$/;
const TRACKING = /^(fbclid|utm_.+|mibextid|rdid|share_url)$/;

/** Links out of Facebook, in page order: redirects unwrapped, tracking params dropped, duplicates removed. */
export function externalLinks(hrefs: string[]): string[] {
  const out = new Set<string>();
  for (const href of hrefs) {
    try {
      let u = new URL(href);
      if (u.hostname === "l.facebook.com" && u.searchParams.get("u")) u = new URL(u.searchParams.get("u")!);
      if (!/^https?:$/.test(u.protocol) || SKIP_HOSTS.test(u.hostname)) continue;
      for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
      u.hash = "";
      out.add(u.toString());
    } catch { /* not a URL */ }
  }
  return [...out];
}

/** fetchSource output for a linked page: a structured recipe, or text that reads like one. */
export function isRecipePage(content: string): boolean {
  return /"@type"\s*:\s*\[?\s*"Recipe"/.test(content) || recipeScore(content) >= 4;
}

export function buildRawContent(postText: string | null, pages: { url: string; content: string }[]): string | null {
  const parts = [postText, ...pages.map((p) => `מתכון מלא מהקישור (${p.url}):\n${p.content}`)].filter(Boolean);
  return parts.length ? parts.join("\n\n").slice(0, MAX_RAW) : null;
}

export interface RecoverDeps {
  /** Texts (post body, comments) and hrefs on a Facebook post, read in a logged-in browser. */
  readPost(url: string): Promise<{ texts: string[]; hrefs: string[] }>;
  /** fetchSource output for a linked page, or null. */
  fetchPage(url: string): Promise<string | null>;
  /** What the post's video shows and says: subtitles read from frames, and the speech transcript. */
  readVideo?(url: string): Promise<VideoContent>;
}
export interface VideoContent { onScreen: string; speech: string }
const MAX_LINKS = 4;

/** Recipe content for a Facebook post: its own text when that is a recipe, plus linked pages that are recipes.
 *  When neither has one, the recipe is often only in the video: its subtitles and speech are used instead. */
export async function recover(url: string, deps: RecoverDeps): Promise<string | null> {
  const post = await deps.readPost(url);
  const pages: { url: string; content: string }[] = [];
  for (const link of externalLinks(post.hrefs).slice(0, MAX_LINKS)) {
    const content = await deps.fetchPage(link).catch(() => null);
    if (content && isRecipePage(content)) pages.push({ url: link, content });
  }
  const written = buildRawContent(pickPostText(post.texts), pages);
  if (written || !deps.readVideo) return written;
  const video = videoText(await deps.readVideo(url).catch(() => ({ onScreen: "", speech: "" })));
  return video ? buildRawContent([caption(post.texts), video].filter(Boolean).join("\n\n"), []) : null;
}

/** The post's caption: the first real text block, since the caption comes before the comments on the page. */
function caption(texts: string[]): string | null {
  return texts.map((x) => x.trim()).find((x) => x.length >= 20 && !NOISE.test(x)) ?? null;
}

export function videoText(v: VideoContent): string | null {
  const parts: string[] = [];
  if (v.onScreen.trim() && v.onScreen.trim() !== "NONE") parts.push(`טקסט שמופיע בסרטון:\n${v.onScreen.trim()}`);
  if (v.speech.trim()) parts.push(`תמלול הדיבור בסרטון:\n${v.speech.trim()}`);
  return parts.length ? parts.join("\n\n") : null;
}

export interface TryState { tries: number; last: string }
const MAX_TRIES = 2;
const RETRY_AFTER_MS = 6 * 3600_000;

export function shouldTry(s: TryState | undefined, now: Date): boolean {
  if (!s) return true;
  return s.tries < MAX_TRIES && now.getTime() - new Date(s.last).getTime() >= RETRY_AFTER_MS;
}
