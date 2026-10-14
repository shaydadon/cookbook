import { getMember } from "../_shared/auth.ts";
import { parseChatExport } from "../_shared/chat-export.ts";
import { serviceClient } from "../_shared/db.ts";
import { background, json, preflight, withErrors } from "../_shared/http.ts";
import { ingest } from "../_shared/ingest-core.ts";
import { extractUrls } from "../_shared/url.ts";
import { kickWorker } from "../_shared/worker.ts";

const BATCH = 100;
const TIME_BUDGET_MS = 90_000;

Deno.serve(withErrors(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const db = serviceClient();
  const member = await getMember(req, db);
  if (member?.role !== "admin") return json({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => null) as { content?: unknown; offset?: unknown } | null;
  if (typeof body?.content !== "string") return json({ error: "content_required" }, 400);
  const offset = typeof body.offset === "number" && body.offset >= 0 ? body.offset : 0;

  const withLinks = parseChatExport(body.content).filter((m) => extractUrls(m.text).length > 0);
  const started = Date.now();
  let i = offset, created = 0, duplicates = 0;

  for (; i < withLinks.length && i < offset + BATCH && Date.now() - started < TIME_BUDGET_MS; i++) {
    const m = withLinks[i];
    const res = await ingest(db, { text: m.text, senderName: m.sender, sentAt: m.sentAt, via: "import", submittedBy: null });
    for (const r of res) r.duplicate ? duplicates++ : created++;
  }

  if (created > 0) background(kickWorker());
  return json({ total: withLinks.length, next_offset: i < withLinks.length ? i : null, created, duplicates });
}));
