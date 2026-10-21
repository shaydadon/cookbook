import { assertEquals } from "jsr:@std/assert@1";
import { audioUrl, mediaInfo } from "./video.ts";

const efg = (o: object) => encodeURIComponent(btoa(JSON.stringify(o)));
const AUDIO = `https://video.fbcdn.net/o1/v/t2/f2/m69/a.mp4?efg=${efg({ vencode_tag: "dash_ln_heaac_vbr3_audio", video_id: 1620022386371460 })}&oh=sig&bytestart=0&byteend=14440`;
const VIDEO = `https://video.fbcdn.net/o1/v/t2/f2/m69/v.mp4?efg=${efg({ vencode_tag: "dash_r2av1_q90", video_id: 1620022386371460 })}&bytestart=0&byteend=900`;
const OTHER = `https://video.fbcdn.net/o1/v/t2/f2/m69/o.mp4?efg=${efg({ vencode_tag: "dash_ln_heaac_vbr3_audio", video_id: 999 })}&bytestart=0&byteend=10`;

Deno.test("mediaInfo decodes the video id and encoding from efg; empty for other URLs", () => {
  assertEquals(mediaInfo(AUDIO), { videoId: "1620022386371460", tag: "dash_ln_heaac_vbr3_audio" });
  assertEquals(mediaInfo("https://example.com/x.mp4"), { videoId: "", tag: "" });
});

Deno.test("audioUrl picks this video's audio track (not another autoplaying video) and asks for the whole file", () => {
  const url = audioUrl([OTHER, VIDEO, AUDIO], "1620022386371460")!;
  assertEquals(new URL(url).pathname.endsWith("/a.mp4"), true);
  assertEquals(new URL(url).searchParams.has("bytestart"), false);
  assertEquals(new URL(url).searchParams.has("byteend"), false);
  assertEquals(new URL(url).searchParams.get("oh"), "sig");
  assertEquals(audioUrl([OTHER, VIDEO], "1620022386371460"), null);
});
