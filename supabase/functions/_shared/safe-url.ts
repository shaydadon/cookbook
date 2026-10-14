// SSRF guard for URLs we fetch on behalf of users (shared links, redirects, push endpoints).

export interface SafeUrlOptions {
  /** Local dev only (AI_FAKE=1 against a local stack): allow the local fixture hosts on any port. */
  allowLocal?: boolean;
}

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "kong", "host.docker.internal"]);

/** True when `url` points at the local Supabase stack (never true for a hosted project). */
export function isLocal(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Local fetches are allowed only in fake-AI mode against a local stack. */
export function localFetchAllowed(): boolean {
  return Deno.env.get("AI_FAKE") === "1" && isLocal(Deno.env.get("SUPABASE_URL"));
}

const BLOCKED_NAMES = new Set(["localhost", "kong", "db"]);
const BLOCKED_SUFFIXES = [".internal", ".local", ".localhost"];

function isPrivateIpv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 127 || a === 10 || a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    (a === 100 && b >= 64 && b <= 127);
}

function isPrivateIpv6(host: string): boolean {
  // WHATWG URL already serialised it in canonical compressed form, e.g. "::1", "fd00::1", "::ffff:7f00:1".
  if (host === "::1" || host === "::") return true;
  const mapped = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mapped) {
    const hi = parseInt(mapped[1], 16), lo = parseInt(mapped[2], 16);
    return isPrivateIpv4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  const first = host.startsWith("::") ? 0 : parseInt(host.split(":")[0], 16);
  return (first & 0xfe00) === 0xfc00 || // fc00::/7 unique local
    (first & 0xffc0) === 0xfe80; //        fe80::/10 link local
}

export function isPublicHttpUrl(url: string, opts: SafeUrlOptions = {}): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (opts.allowLocal && LOCAL_HOSTS.has(host)) return true;
  if (u.port !== "" && u.port !== "80" && u.port !== "443") return false;
  if (!host) return false;
  if (BLOCKED_NAMES.has(host) || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) return false;
  if (host.startsWith("[")) return !isPrivateIpv6(host.slice(1, -1));
  return !isPrivateIpv4(host);
}
