import { decodeBase64 } from "./npm.ts";

export const IMAGE_STYLE =
  "Professional food photography, natural window light, 45-degree angle, neutral linen and wood surface, shallow depth of field, appetizing, no text, no hands.";

export async function generateImage(
  prompt: string,
  opts: { apiKey: string; model: string; fetchFn?: typeof fetch },
): Promise<Uint8Array> {
  const fetchFn = opts.fetchFn ?? fetch;
  const res = await fetchFn("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model,
      prompt: `${prompt}. ${IMAGE_STYLE}`,
      size: "1024x1024",
      quality: "medium",
      output_format: "webp",
      n: 1,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI image ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (typeof b64 !== "string") throw new Error("OpenAI image: response had no image data");
  return decodeBase64(b64);
}
