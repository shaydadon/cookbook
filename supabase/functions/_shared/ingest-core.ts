import type { SupabaseClient } from "./npm.ts";
import { isPublicHttpUrl, localFetchAllowed, type SafeUrlOptions } from "./safe-url.ts";
import { detectPlatform, extractUrls, normalizeUrl, resolveUrl } from "./url.ts";

export interface IngestInput {
  text: string;
  senderName: string | null;
  sentAt: string | null;
  via: "whatsapp" | "app" | "import";
  submittedBy: string | null;
}

export interface IngestResult { url: string; recipe_id: string; status: string; duplicate: boolean }

/** Fail-closed: without a configured INGEST_SECRET no request counts as coming from Make. */
export function isMakeRequest(req: Request, secret: string | undefined): boolean {
  return !!secret && req.headers.get("x-ingest-secret") === secret;
}

export async function ingest(
  db: SupabaseClient,
  input: IngestInput,
  resolve: (u: string) => Promise<string> = (u) => resolveUrl(u),
  opts: SafeUrlOptions = { allowLocal: localFetchAllowed() },
): Promise<IngestResult[]> {
  const results: IngestResult[] = [];
  const sharedAt = input.sentAt ?? new Date().toISOString();

  for (const raw of extractUrls(input.text)) {
    let normalized: string;
    try {
      if (!isPublicHttpUrl(raw, opts)) continue; // private/internal address
      const resolved = await resolve(raw);
      if (!isPublicHttpUrl(resolved, opts)) continue; // short link that expands to a private address
      normalized = normalizeUrl(resolved);
    } catch {
      continue; // not a valid URL
    }

    let recipe = (await db.from("recipes").select("id, status").eq("source_url_normalized", normalized).maybeSingle()).data;
    let duplicate = recipe !== null;
    if (!recipe) {
      const inserted = await db.from("recipes")
        .insert({ source_url: raw, source_url_normalized: normalized, source_platform: detectPlatform(normalized) })
        .select("id, status").single();
      if (inserted.error?.code === "23505") {
        recipe = (await db.from("recipes").select("id, status").eq("source_url_normalized", normalized).single()).data;
        duplicate = true;
      } else if (inserted.error) {
        throw new Error(`insert recipe: ${inserted.error.message}`);
      } else {
        recipe = inserted.data;
      }
    }

    const share = await db.from("shares").upsert({
      recipe_id: recipe!.id,
      shared_by_name: input.senderName,
      message_text: input.text,
      shared_at: sharedAt,
      via: input.via,
      submitted_by: input.submittedBy,
    }, { onConflict: "recipe_id,shared_by_name,shared_at", ignoreDuplicates: true });
    if (share.error) throw new Error(`insert share: ${share.error.message}`);

    results.push({ url: raw, recipe_id: recipe!.id, status: recipe!.status, duplicate });
  }
  return results;
}
