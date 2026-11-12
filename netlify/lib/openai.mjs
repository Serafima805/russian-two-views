// Shared helpers for the Netlify functions.
// The OpenAI API key is read ONLY here, from the server environment.
// It is never sent to the browser.

const API = "https://api.openai.com/v1";

// Models can be changed in Netlify's environment variables without editing code.
export const MODELS = {
  chat: process.env.OPENAI_MODEL || "gpt-4o-mini",
  tts: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
  transcribe: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
};

export const VOICES = ["coral", "nova", "shimmer", "sage", "ash", "onyx", "echo", "verse"];

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function apiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new HttpError(
      500,
      "The server has no OpenAI key yet. Add OPENAI_API_KEY in Netlify (Site configuration → Environment variables), then redeploy."
    );
  }
  return key;
}

// Wraps a handler: POST only, friendly JSON errors, no stack traces to the browser.
export function handler(fn) {
  return async (req, context) => {
    if (req.method !== "POST") return json({ error: "Use POST." }, 405);
    try {
      return await fn(req, context);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error(err);
      return json({ error: "Something went wrong on the server. Please try again." }, 500);
    }
  };
}

export async function readJson(req, maxChars = 20000) {
  const text = await req.text();
  if (text.length > maxChars) throw new HttpError(413, "Request is too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Request is not valid JSON.");
  }
}

export function cleanText(value, max, field) {
  if (typeof value !== "string") throw new HttpError(400, `Missing ${field}.`);
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) throw new HttpError(400, `Missing ${field}.`);
  if (text.length > max) throw new HttpError(400, `${field} is too long.`);
  return text;
}

async function openAIError(res) {
  let detail = "";
  try {
    detail = (await res.json())?.error?.message || "";
  } catch {}
  console.error("OpenAI error", res.status, detail);
  if (res.status === 401) return new HttpError(502, "OpenAI did not accept the API key. Check OPENAI_API_KEY in Netlify.");
  if (res.status === 429) return new HttpError(429, "OpenAI is busy or the account is out of credit. Please wait and try again.");
  if (res.status === 404) return new HttpError(502, "The OpenAI model name was not found. Check the model settings in Netlify.");
  return new HttpError(502, "OpenAI could not answer right now. Please try again.");
}

// Calls Chat Completions and returns parsed JSON that matches `schema`.
export async function chatJSON({ messages, schema, name, maxTokens = 1200 }) {
  const res = await fetch(`${API}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODELS.chat,
      messages,
      max_completion_tokens: maxTokens,
      response_format: { type: "json_schema", json_schema: { name, strict: true, schema } },
    }),
  });
  if (!res.ok) throw await openAIError(res);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  try {
    return JSON.parse(content);
  } catch {
    throw new HttpError(502, "The AI reply was incomplete. Please try again.");
  }
}

export async function speech({ text, voice }) {
  const body = { model: MODELS.tts, voice, input: text, response_format: "mp3" };
  // Newer TTS models accept speaking instructions; the older tts-1 models do not.
  if (!MODELS.tts.startsWith("tts-1")) {
    body.instructions =
      "Speak Russian slowly and clearly for beginner learners. Short pauses between sentences. Warm, friendly tone.";
  } else {
    body.speed = 0.85;
  }
  const res = await fetch(`${API}/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await openAIError(res);
  return res.arrayBuffer();
}

export async function transcribe({ audio, mimeType }) {
  const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : mimeType.includes("wav") ? "wav" : "webm";
  const form = new FormData();
  form.append("file", new Blob([audio], { type: mimeType }), `question.${ext}`);
  form.append("model", MODELS.transcribe);
  form.append("language", "ru");
  form.append("response_format", "json");
  form.append("prompt", "Простой вопрос на русском языке от студента. Например: Во сколько ты пришла в кафе?");
  const res = await fetch(`${API}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}` },
    body: form,
  });
  if (!res.ok) throw await openAIError(res);
  const data = await res.json();
  return (data.text || "").trim();
}
