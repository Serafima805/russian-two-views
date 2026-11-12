import { CAFE_STORY } from "./stories.js";

const MAX_QUESTIONS = 3;
const MAX_RECORD_MS = 15000;

const state = {
  story: structuredClone(CAFE_STORY),
  asked: { a: [], b: [] }, // [{ q, a, en }]
  seenTitles: [CAFE_STORY.title_en],
};

const $ = (sel, root = document) => root.querySelector(sel);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(child));
  }
  return node;
}

function toast(message, isError = false) {
  const t = $("#toast");
  t.textContent = message;
  t.className = `show${isError ? " error" : ""}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.className = ""), isError ? 6000 : 3000);
}

async function api(path, body, { raw = false, contentType } = {}) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": contentType || "application/json" },
    body: raw ? body : JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `Server error (${res.status}).`;
    try {
      message = (await res.json()).error || message;
    } catch {}
    throw new Error(message);
  }
  return res;
}

/* ---------- Audio (text-to-speech) ---------- */

const audioCache = new Map();
let player = null;
let playingButton = null;

function setPlaying(button, on) {
  if (!button) return;
  button.classList.toggle("playing", on);
  button.setAttribute("aria-pressed", on ? "true" : "false");
  const label = button.querySelector(".label");
  if (label) label.textContent = on ? button.dataset.stop : button.dataset.play;
}

function stopAudio() {
  if (player) player.pause();
  setPlaying(playingButton, false);
  playingButton = null;
}

async function speak(text, voice, button) {
  if (playingButton === button && player && !player.paused) return stopAudio();
  stopAudio();
  const key = `${voice}|${text}`;
  try {
    if (!audioCache.has(key)) {
      button?.classList.add("loading");
      const res = await api("/api/tts", { text, voice });
      audioCache.set(key, URL.createObjectURL(await res.blob()));
    }
    player = new Audio(audioCache.get(key));
    playingButton = button;
    setPlaying(button, true);
    player.addEventListener("ended", () => stopAudio(), { once: true });
    await player.play();
  } catch (err) {
    setPlaying(button, false);
    if (err.name !== "NotAllowedError") toast(err.message, true);
  } finally {
    button?.classList.remove("loading");
  }
}

function playButton(text, voice, { play = "Listen", stop = "Stop", small = false } = {}) {
  const b = el(
    "button",
    { type: "button", class: `btn play${small ? " small" : ""}`, "aria-pressed": "false" },
    el("span", { class: "icon", "aria-hidden": "true" }),
    el("span", { class: "label" }, play)
  );
  b.dataset.play = play;
  b.dataset.stop = stop;
  b.addEventListener("click", () => speak(text, voice, b));
  return b;
}

/* ---------- Recording (speech-to-text) ---------- */

function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return options.find((t) => MediaRecorder.isTypeSupported?.(t)) || "";
}

let recorder = null;

async function toggleRecording(id, micButton, input) {
  if (recorder && recorder.state === "recording") {
    recorder.stop();
    return;
  }
  const mimeType = pickMimeType();
  if (mimeType === null || !navigator.mediaDevices?.getUserMedia) {
    toast("Your browser cannot record audio. Please type your question.", true);
    return;
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    toast("Microphone is blocked. Allow the microphone in your browser, or type your question.", true);
    return;
  }
  stopAudio();
  const chunks = [];
  recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  const timer = setTimeout(() => recorder?.state === "recording" && recorder.stop(), MAX_RECORD_MS);
  micButton.classList.add("recording");
  micButton.setAttribute("aria-label", "Stop recording");
  micButton.querySelector(".label").textContent = "Stop";

  recorder.addEventListener("dataavailable", (e) => e.data.size && chunks.push(e.data));
  recorder.addEventListener(
    "stop",
    async () => {
      clearTimeout(timer);
      stream.getTracks().forEach((t) => t.stop());
      micButton.classList.remove("recording");
      micButton.setAttribute("aria-label", "Speak your question");
      micButton.querySelector(".label").textContent = "Speak";
      const type = (recorder.mimeType || mimeType || "audio/webm").split(";")[0];
      recorder = null;
      const blob = new Blob(chunks, { type });
      micButton.classList.add("loading");
      micButton.disabled = true;
      try {
        const res = await api("/api/transcribe", blob, { raw: true, contentType: type });
        const { text } = await res.json();
        if (!text) throw new Error("I could not hear a question. Try again, a little louder.");
        input.value = text;
        input.focus();
        toast("Check your question, then press Ask.");
      } catch (err) {
        toast(err.message, true);
      } finally {
        micButton.classList.remove("loading");
        micButton.disabled = state.asked[id].length >= MAX_QUESTIONS;
      }
    },
    { once: true }
  );
  recorder.start();
}

/* ---------- Rendering ---------- */

function renderHeader() {
  const s = state.story;
  $("#story-title").textContent = s.title_ru;
  $("#story-title-en").textContent = s.title_en;
  $("#scene").textContent = s.scene_en;
  document.title = `${s.title_ru} · Two Views — beginner Russian listening`;
}

function renderListen() {
  const wrap = $("#listen");
  wrap.replaceChildren();
  for (const id of ["a", "b"]) {
    const c = state.story.characters[id];
    const text = el("p", { class: "narrative", lang: "ru", hidden: true }, c.narrative_ru);
    const toggle = el("button", { type: "button", class: "btn ghost small", "aria-expanded": "false" }, "Show text");
    toggle.addEventListener("click", () => {
      text.hidden = !text.hidden;
      toggle.textContent = text.hidden ? "Show text" : "Hide text";
      toggle.setAttribute("aria-expanded", String(!text.hidden));
    });
    wrap.append(
      el(
        "article",
        { class: `card person person-${id}` },
        el(
          "div",
          { class: "who" },
          el("span", { class: "avatar", "aria-hidden": "true" }, c.emoji),
          el("div", {}, el("h3", { lang: "ru" }, c.name), el("p", { class: "muted" }, c.role_en))
        ),
        el("div", { class: "row" }, playButton(c.narrative_ru, c.voice, { play: `Listen to ${c.name}` }), toggle),
        text
      )
    );
  }
}

function renderAsk() {
  const wrap = $("#ask");
  wrap.replaceChildren();
  for (const id of ["a", "b"]) wrap.append(askPanel(id));
  updateExplainLock();
}

function askPanel(id) {
  const c = state.story.characters[id];
  const asked = state.asked[id];
  const left = MAX_QUESTIONS - asked.length;
  const done = left <= 0;

  const log = el("ul", { class: "log", "aria-live": "polite" });
  asked.forEach((turn) => log.append(...turnItems(id, turn)));

  const input = el("input", {
    type: "text",
    lang: "ru",
    maxlength: "200",
    placeholder: done ? "No questions left" : "Твой вопрос…",
    "aria-label": `Your question for ${c.name}, in Russian`,
    disabled: done,
    autocomplete: "off",
  });
  const mic = el(
    "button",
    { type: "button", class: "btn mic", "aria-label": "Speak your question", disabled: done },
    el("span", { class: "icon", "aria-hidden": "true" }, "🎤"),
    el("span", { class: "label" }, "Speak")
  );
  mic.addEventListener("click", () => toggleRecording(id, mic, input));
  const send = el("button", { type: "submit", class: "btn primary", disabled: done }, "Ask");

  const form = el("form", { class: "ask-form" }, input, mic, send);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    askQuestion(id, input.value, { form, input, send, mic, log });
  });

  const usedTexts = new Set(asked.map((t) => t.q));
  const chips = el(
    "div",
    { class: "chips" },
    c.suggested.map((s) =>
      el(
        "button",
        {
          type: "button",
          class: `chip${usedTexts.has(s.ru) ? " used" : ""}`,
          disabled: done,
          onclick: () => {
            input.value = s.ru;
            input.focus();
          },
        },
        el("span", { lang: "ru" }, s.ru),
        el("small", {}, s.en)
      )
    )
  );

  return el(
    "article",
    { class: `card person person-${id}`, "data-id": id },
    el(
      "div",
      { class: "who" },
      el("span", { class: "avatar", "aria-hidden": "true" }, c.emoji),
      el("h3", { lang: "ru" }, c.name),
      el(
        "span",
        { class: `counter${done ? " done" : ""}`, title: "Questions asked" },
        `${asked.length} / ${MAX_QUESTIONS}`
      )
    ),
    log,
    done
      ? el("p", { class: "hint" }, `You asked ${c.name} all ${MAX_QUESTIONS} questions.`)
      : [
          el("p", { class: "hint small" }, "Ideas — tap one, then say it or press Ask:"),
          chips,
          form,
        ]
  );
}

function turnItems(id, turn) {
  const c = state.story.characters[id];
  const en = el("p", { class: "en", hidden: true }, turn.en);
  const showEn = el("button", { type: "button", class: "btn ghost tiny", "aria-expanded": "false" }, "EN");
  showEn.addEventListener("click", () => {
    en.hidden = !en.hidden;
    showEn.setAttribute("aria-expanded", String(!en.hidden));
  });
  return [
    el("li", { class: "bubble me", lang: "ru" }, turn.q),
    el(
      "li",
      { class: `bubble them${turn.counted === false ? " retry" : ""}` },
      el("span", { class: "speaker", "aria-hidden": "true" }, c.emoji),
      el(
        "div",
        { class: "bubble-body" },
        el("p", { lang: "ru" }, turn.a),
        en,
        turn.counted === false ? el("p", { class: "small muted" }, "This one did not count. Try again!") : null,
        el("div", { class: "row" }, playButton(turn.a, c.voice, { play: "Play", stop: "Stop", small: true }), showEn)
      )
    ),
  ];
}

async function askQuestion(id, raw, ui) {
  const question = raw.replace(/\s+/g, " ").trim();
  if (!question) return toast("Type or speak a question first.");
  if (state.asked[id].length >= MAX_QUESTIONS) return;
  const c = state.story.characters[id];
  const other = state.story.characters[id === "a" ? "b" : "a"];

  ui.input.disabled = ui.send.disabled = ui.mic.disabled = true;
  const pending = el("li", { class: "bubble them pending" }, el("span", { class: "dots", "aria-label": `${c.name} is thinking` }, "…"));
  ui.log.append(el("li", { class: "bubble me", lang: "ru" }, question), pending);

  try {
    const res = await api("/api/ask", {
      character: { name: c.name, gender: c.gender, narrative_ru: c.narrative_ru },
      otherName: other.name,
      question,
      history: state.asked[id].map(({ q, a }) => ({ q, a })),
    });
    const data = await res.json();
    if (data.understood) {
      state.asked[id].push({ q: question, a: data.answer_ru, en: data.answer_en });
      renderAsk();
    } else {
      // Not counted: show the reply but keep the question slot.
      pending.replaceWith(...turnItems(id, { q: "", a: data.answer_ru, en: data.answer_en, counted: false }).slice(1));
      ui.input.disabled = ui.send.disabled = ui.mic.disabled = false;
      ui.input.select();
    }
    // Play the answer aloud. (Some browsers block this; the Play button still works.)
    const panel = document.querySelector(`#ask [data-id="${id}"]`);
    const buttons = panel?.querySelectorAll(".log .play");
    const last = buttons?.[buttons.length - 1];
    if (last) speak(data.answer_ru, c.voice, last);
  } catch (err) {
    pending.previousSibling?.remove();
    pending.remove();
    ui.input.disabled = ui.send.disabled = ui.mic.disabled = false;
    toast(err.message, true);
  }
}

function updateExplainLock() {
  const ready = state.asked.a.length > 0 && state.asked.b.length > 0;
  $("#explain-lock").hidden = ready;
  for (const node of $("#explain-form").elements) node.disabled = !ready;
}

function renderFeedback(data) {
  const box = $("#feedback");
  const found = data.differences.filter((d) => d.found).length;
  const key = el(
    "ul",
    { class: "key", hidden: true },
    data.differences.map((d) =>
      el("li", { class: d.found ? "found" : "missed" }, el("span", { "aria-hidden": "true" }, d.found ? "✓" : "○"), " ", d.difference)
    )
  );
  const showKey = el("button", { type: "button", class: "btn ghost small" }, "Show all differences");
  showKey.addEventListener("click", () => {
    key.hidden = !key.hidden;
    showKey.textContent = key.hidden ? "Show all differences" : "Hide differences";
  });
  box.replaceChildren(
    el(
      "div",
      { class: "result" },
      el("p", { class: "score" }, `You found ${found} of ${data.differences.length} differences.`),
      el("p", {}, data.feedback_en),
      showKey,
      key
    )
  );
}

/* ---------- Actions ---------- */

function resetProgress() {
  stopAudio();
  state.asked = { a: [], b: [] };
  $("#explanation").value = "";
  $("#feedback").replaceChildren();
}

function renderAll() {
  renderHeader();
  renderListen();
  renderAsk();
}

$("#explain-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const explanation = $("#explanation").value.trim();
  if (explanation.length < 10) return toast("Please write a little more in English.");
  const button = e.submitter || $("#explain-form button");
  button.disabled = true;
  button.textContent = "Checking…";
  try {
    const s = state.story;
    const res = await api("/api/feedback", {
      explanation,
      differences_en: s.differences_en,
      characters: {
        a: { name: s.characters.a.name, narrative_ru: s.characters.a.narrative_ru },
        b: { name: s.characters.b.name, narrative_ru: s.characters.b.narrative_ru },
      },
    });
    renderFeedback(await res.json());
  } catch (err) {
    toast(err.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "Check my answer";
  }
});

$("#restart").addEventListener("click", () => {
  resetProgress();
  renderAll();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

$("#new-story").addEventListener("click", async (e) => {
  const button = e.currentTarget;
  button.disabled = true;
  button.textContent = "Writing a new story…";
  try {
    const res = await api("/api/story", { avoidTitles: state.seenTitles.slice(-10) });
    const story = await res.json();
    state.story = story;
    state.seenTitles.push(story.title_en);
    resetProgress();
    renderAll();
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast("New story ready. Listen first!");
  } catch (err) {
    toast(err.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "↻ New story";
  }
});

renderAll();
