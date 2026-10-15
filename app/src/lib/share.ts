const URL_RE = /https?:\/\/[^\s<>"'“”]+/i;

export function extractFirstUrl(text: string): string | null {
  // Trailing punctuation is always stripped, including a closing ")" even if balanced (wiki-style "(x)" URLs lose it).
  const m = text.match(URL_RE)?.[0];
  return m ? m.replace(/[.,;:!?)\]}»"']+$/, "") : null;
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
