// POST /api/story — creates a NEW two-perspective story for the "New story" button.
import { handler, readJson, chatJSON, json, HttpError } from "../lib/openai.mjs";

const character = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string", description: "Common Russian first name, nominative, e.g. Аня, Максим" },
    gender: { type: "string", enum: ["female", "male"] },
    emoji: { type: "string", description: "One person emoji, e.g. 👩 or 👨" },
    role_en: { type: "string", description: "Very short English role, e.g. 'a student'" },
    narrative_ru: { type: "string" },
    suggested: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { ru: { type: "string" }, en: { type: "string" } },
        required: ["ru", "en"],
      },
    },
  },
  required: ["name", "gender", "emoji", "role_en", "narrative_ru", "suggested"],
};

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title_ru: { type: "string" },
    title_en: { type: "string" },
    scene_en: { type: "string" },
    characters: {
      type: "object",
      additionalProperties: false,
      properties: { a: character, b: character },
      required: ["a", "b"],
    },
    differences_en: { type: "array", items: { type: "string" } },
  },
  required: ["title_ru", "title_en", "scene_en", "characters", "differences_en"],
};

const FEMALE = ["coral", "nova"];
const MALE = ["ash", "onyx"];

function check(story) {
  const ok = (s, max) => typeof s === "string" && s.trim().length > 0 && s.length <= max;
  const chars = story?.characters;
  if (!ok(story?.title_ru, 80) || !ok(story?.title_en, 80) || !ok(story?.scene_en, 300)) return false;
  for (const id of ["a", "b"]) {
    const c = chars?.[id];
    if (!c || !ok(c.name, 30) || !ok(c.narrative_ru, 1200) || !ok(c.role_en, 60)) return false;
    if (!Array.isArray(c.suggested) || c.suggested.length < 3) return false;
    c.suggested = c.suggested.slice(0, 5).filter((q) => ok(q.ru, 120) && ok(q.en, 120));
    if (c.suggested.length < 3) return false;
    c.emoji = ok(c.emoji, 8) ? c.emoji : c.gender === "male" ? "👨" : "👩";
  }
  if (!Array.isArray(story.differences_en) || story.differences_en.length < 3) return false;
  story.differences_en = story.differences_en.slice(0, 6).filter((d) => ok(d, 300));
  return story.differences_en.length >= 3;
}

export default handler(async (req) => {
  const body = await readJson(req, 4000);
  const avoid = Array.isArray(body.avoidTitles)
    ? body.avoidTitles.filter((t) => typeof t === "string").slice(0, 10).map((t) => t.slice(0, 80))
    : [];

  const system = `You write tiny listening stories for absolute beginners of Russian (CEFR A1).
Create ONE everyday event (shopping, a birthday, a bus trip, cooking, a lost item, a sports game, a visit to grandma, etc.) told by two people with DIFFERENT perspectives.
- Each narrative_ru: 8–11 very short sentences (3–8 words each), first person, past tense, high-frequency words only, no participles, no complex clauses. Start with "Привет! Меня зовут …" or "Привет! Я …".
- The two versions must share the same basic event but contain 4–5 concrete, checkable differences (times, places, numbers, food, colours, who did what, a misunderstanding).
- Each person only knows their own side.
- suggested: 4 simple questions per person in Russian (ты-form, correct gender), each with an English translation, that help discover the differences.
- differences_en: 4–5 short English sentences, each naming one difference and both versions.
- scene_en: one short English sentence that sets the scene without revealing the differences.
- Friendly, school-appropriate content. Characters a and b have different names.`;

  const user = avoid.length
    ? `Make a story different from these: ${avoid.join("; ")}.`
    : "Make a new story.";

  for (let attempt = 0; attempt < 2; attempt++) {
    const story = await chatJSON({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      schema,
      name: "two_view_story",
      maxTokens: 3000,
    });
    if (check(story)) {
      const a = story.characters.a;
      const b = story.characters.b;
      a.voice = (a.gender === "male" ? MALE : FEMALE)[0];
      b.voice = (b.gender === "male" ? MALE : FEMALE)[a.gender === b.gender ? 1 : 0];
      story.id = `gen-${Date.now()}`;
      return json(story);
    }
  }
  throw new HttpError(502, "The new story did not come out right. Please press the button again.");
});

export const config = { path: "/api/story" };
