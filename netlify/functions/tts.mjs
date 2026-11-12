// POST /api/tts — turns Russian text into speech (MP3).
import { handler, readJson, cleanText, speech, VOICES } from "../lib/openai.mjs";

export default handler(async (req) => {
  const body = await readJson(req, 4000);
  const text = cleanText(body.text, 1500, "text");
  const voice = VOICES.includes(body.voice) ? body.voice : "coral";
  const audio = await speech({ text, voice });
  return new Response(audio, {
    status: 200,
    headers: { "content-type": "audio/mpeg", "cache-control": "no-store" },
  });
});

export const config = { path: "/api/tts" };
