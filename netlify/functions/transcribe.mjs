// POST /api/transcribe — turns the student's spoken question into Russian text.
// The browser sends the raw recording as the request body.
import { handler, transcribe, json, HttpError } from "../lib/openai.mjs";

const MAX_BYTES = 3 * 1024 * 1024; // about 1–2 minutes of audio; questions are short
const ALLOWED = ["audio/webm", "audio/mp4", "audio/ogg", "audio/wav", "audio/x-wav", "audio/mpeg"];

export default handler(async (req) => {
  const mimeType = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED.includes(mimeType)) throw new HttpError(415, "This audio format is not supported.");
  const audio = await req.arrayBuffer();
  if (audio.byteLength < 500) throw new HttpError(400, "The recording was empty. Try again and speak a little longer.");
  if (audio.byteLength > MAX_BYTES) throw new HttpError(413, "The recording is too long. Please ask a short question.");
  const text = await transcribe({ audio, mimeType });
  return json({ text: text.slice(0, 200) });
});

export const config = { path: "/api/transcribe" };
