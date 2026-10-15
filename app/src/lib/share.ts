const URL_RE = /https?:\/\/[^\s<>"'“”]+/i;

export function extractFirstUrl(text: string): string | null {
  return text.match(URL_RE)?.[0] ?? null;
}

export function prefillFromShare(params: URLSearchParams): { url: string; note: string } {
  const fields = ["url", "text", "title"].map((k) => params.get(k)?.trim() ?? "");
  const url = fields.map(extractFirstUrl).find(Boolean) ?? "";
  const note = [params.get("title"), params.get("text")]
    .map((s) => (s ?? "").replace(url, "").trim())
    .filter((s) => s && !extractFirstUrl(s))
    .join(" ")
    .trim();
  return { url, note };
}
