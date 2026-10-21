// Reads a Facebook video for recipes that exist only inside it: the subtitles and on-screen text (frames read
// by Claude) and the speech (the post's own audio stream transcribed by OpenAI).
import type { BrowserContext } from "npm:playwright@1.64.1";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import type { VideoContent } from "./core.ts";

const FRAME_EVERY_MS = 2500;
const MAX_FRAMES = 36;
const VISION_MODEL = "claude-sonnet-5-5";
const TRANSCRIBE_MODEL = "gpt-4o-transcribe";

export interface VideoKeys { anthropic: string; openai: string }

/** Facebook media URLs carry their video id and encoding in the base64 JSON `efg` parameter. */
export function mediaInfo(url: string): { videoId: string; tag: string } {
  try {
    const efg = new URL(url).searchParams.get("efg") ?? "";
    const j = JSON.parse(atob(efg.replace(/-/g, "+").replace(/_/g, "/")));
    return { videoId: String(j.video_id ?? ""), tag: String(j.vencode_tag ?? "") };
  } catch {
    return { videoId: "", tag: "" };
  }
}

/** The whole audio file of a video, from the byte-range requests the player made for it. */
export function audioUrl(requested: string[], videoId: string): string | null {
  const hit = requested.find((u) => { const m = mediaInfo(u); return m.videoId === videoId && /audio/.test(m.tag); });
  if (!hit) return null;
  const u = new URL(hit);
  u.searchParams.delete("bytestart");
  u.searchParams.delete("byteend");
  return u.toString();
}

// Runs in the browser: the largest video on screen is the one being watched.
const MAIN_VIDEO = `[...document.querySelectorAll('video')].sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0]`;

export async function readVideo(ctx: BrowserContext, url: string, keys: VideoKeys): Promise<VideoContent> {
  const page = await ctx.newPage();
  const requested: string[] = [];
  page.on("request", (r) => { if (/fbcdn\.net/.test(r.url()) && /\.mp4/.test(r.url())) requested.push(r.url()); });
  const frames: Uint8Array[] = [];
  let videoId = "";
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(5000);
    const final = new URL(page.url());
    videoId = final.searchParams.get("v") ?? final.pathname.match(/(?:reel|videos)\/(\d+)/)?.[1] ?? "";
    const duration = Number(await page.evaluate(`(() => { const v = ${MAIN_VIDEO};
      if (!v) return 0; v.muted = true; v.currentTime = 0; v.play(); return v.duration; })()`)) || 60;
    const n = Math.min(MAX_FRAMES, Math.ceil((duration * 1000) / FRAME_EVERY_MS));
    for (let i = 0; i < n; i++) {
      try {
        frames.push(await page.locator("video").filter({ visible: true }).first().screenshot({ type: "jpeg", quality: 60, timeout: 3000 }));
      } catch { /* frame skipped */ }
      await page.waitForTimeout(FRAME_EVERY_MS);
    }
  } finally {
    await page.close();
  }
  const audio = videoId ? audioUrl(requested, videoId) : null;
  const [onScreen, speech] = await Promise.all([
    // one source failing must not lose the other
    frames.length ? readFrames(frames, keys.anthropic).catch(() => "NONE") : Promise.resolve("NONE"),
    audio ? transcribe(audio, keys.openai).catch(() => "") : Promise.resolve(""),
  ]);
  return { onScreen, speech };
}

async function readFrames(frames: Uint8Array[], key: string): Promise<string> {
  const content = [
    ...frames.map((f) => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: encodeBase64(f) } })),
    {
      type: "text",
      text: "These are frames, in order, from a cooking video. Write out all on-screen text (subtitles, captions, " +
        "ingredient lists) in reading order, in its original language, without repeating text that stays on screen " +
        "across frames. Leave out the page name, buttons and the post caption. If there is no such text, answer exactly: NONE",
    },
  ];
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: VISION_MODEL, max_tokens: 3000, messages: [{ role: "user", content }] }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`frames: ${res.status} ${j?.error?.message ?? ""}`);
  return j.content?.find((b: { type: string }) => b.type === "text")?.text ?? "NONE";
}

async function transcribe(url: string, key: string): Promise<string> {
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "audio/mp4" }), "audio.m4a");
  form.append("model", TRANSCRIBE_MODEL);
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form,
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`transcribe: ${res.status} ${j?.error?.message ?? ""}`);
  return typeof j.text === "string" ? j.text : "";
}
