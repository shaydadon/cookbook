import type { Platform } from "./types.ts";

export const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
  "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

const URL_RE = /https?:\/\/[^\s<>"'“”]+/gi;
const TRAILING_PUNCT_RE = /[.,!?;:)\]}»״׳'"]+$/u;

const TRACKING_PARAMS = [
  /^utm_/, /^fbclid$/, /^gclid$/, /^igshid$/, /^igsh$/, /^si$/, /^ref$/, /^ref_src$/,
  /^mibextid$/, /^share_id$/, /^_r$/, /^_t$/, /^feature$/, /^is_from_webapp$/, /^sender_device$/,
];

const SHORT_HOSTS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "vm.tiktok.com", "vt.tiktok.com", "fb.watch", "s.id", "rb.gy",
  // Google's share links (Android share sheet / Google app): plain redirects to the real page
  "share.google", "search.app", "images.app.goo.gl",
]);

export function extractUrls(text: string): string[] {
  const found = (text.match(URL_RE) ?? []).map((u) => u.replace(TRAILING_PUNCT_RE, ""));
  return [...new Set(found)];
}

function bareHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^(www|m|mobile)\./, "");
}

export function normalizeUrl(raw: string): string {
  const u = new URL(raw.trim()); // throws TypeError on garbage
  const host = bareHost(u.hostname);

  for (const key of [...new Set(u.searchParams.keys())]) {
    if (TRACKING_PARAMS.some((re) => re.test(key))) u.searchParams.delete(key);
  }
  u.searchParams.sort();

  if (host === "youtu.be") return `https://youtube.com/watch?v=${u.pathname.slice(1).replace(/\/+$/, "")}`;
  if (host === "youtube.com") {
    const shorts = u.pathname.match(/^\/shorts\/([^/]+)/);
    const id = shorts?.[1] ?? u.searchParams.get("v");
    if (id) return `https://youtube.com/watch?v=${id}`;
  }

  const path = u.pathname.replace(/\/+$/, "");
  const qs = u.searchParams.toString();
  const port = u.port ? `:${u.port}` : "";
  return `https://${host}${port}${path}${qs ? `?${qs}` : ""}`;
}

export function detectPlatform(url: string): Platform {
  const host = bareHost(new URL(url).hostname);
  if (host.endsWith("instagram.com")) return "instagram";
  if (host.endsWith("tiktok.com")) return "tiktok";
  if (host === "youtu.be" || host.endsWith("youtube.com")) return "youtube";
  if (host.endsWith("facebook.com") || host === "fb.watch") return "facebook";
  return "web";
}

export const RESOLVE_TIMEOUT_MS = 5000;

/**
 * Redirect wrappers around the real address: links copied from Google results (google.*\/url?url=|q=)
 * or out of the Facebook/Instagram apps (l.facebook.com/l.php?u=, l.instagram.com/?u=). Fetching the
 * wrapper returns a redirect page instead of the recipe, so read the target from the query string.
 */
export function unwrapRedirect(url: string): string {
  const u = new URL(url);
  const host = bareHost(u.hostname);
  let target: string | null = null;
  if (/^google\.[a-z.]+$/.test(host) && u.pathname === "/url") target = u.searchParams.get("url") ?? u.searchParams.get("q");
  else if ((host === "l.facebook.com" && u.pathname === "/l.php") || host === "l.instagram.com") target = u.searchParams.get("u");
  return target && /^https?:\/\//i.test(target) ? target : url;
}

export async function resolveUrl(input: string, fetchFn: typeof fetch = fetch): Promise<string> {
  const url = unwrapRedirect(input);
  if (!SHORT_HOSTS.has(bareHost(new URL(url).hostname))) return url;
  try {
    const res = await fetchFn(url, { redirect: "follow", headers: BROWSER_HEADERS, signal: AbortSignal.timeout(RESOLVE_TIMEOUT_MS) });
    await res.body?.cancel();
    return res.url || url;
  } catch {
    return url;
  }
}
