# Два взгляда · Two Views

A simple **information-gap listening game** for beginning learners of Russian.

Two people describe the same everyday event, but their versions don't match. The student:

1. **Listens** to both people (AI voices, slow and clear).
2. **Asks** each person up to **3 questions** in Russian, by speaking (🎤) or typing. Suggested questions are shown.
3. **Explains** the differences **in English** and gets friendly feedback.

The starter story is **«Встреча в кафе» (Meeting at the café)**. Anya and Maxim planned to meet, but there was a misunderstanding about the time. The **↻ New story** button asks the AI to write a new story at the same level.

---

## How the API key stays safe

```
Browser (public/)  ──►  Netlify Functions (netlify/functions/)  ──►  OpenAI
   no key here              reads OPENAI_API_KEY from Netlify
```

- The key is stored **only** in Netlify's environment variables.
- It is **never** in the code, in GitHub, or in the browser.
- The browser only talks to `/api/...` on your own site.

## Project files

| Path | What it does |
|---|---|
| `public/index.html`, `style.css`, `app.js` | The web page |
| `public/stories.js` | The built-in café story (text, suggested questions, answer key) |
| `netlify/functions/tts.mjs` | Text → Russian speech |
| `netlify/functions/transcribe.mjs` | Student's spoken question → text |
| `netlify/functions/ask.mjs` | A character answers in very simple Russian |
| `netlify/functions/feedback.mjs` | Checks the student's English explanation |
| `netlify/functions/story.mjs` | Writes a new story for the "New story" button |
| `netlify/lib/openai.mjs` | Shared code; the only place the key is read |
| `netlify.toml` | Netlify settings (no build step needed) |

There are no npm packages to install.

---

## Deploy: step by step

You need a free **GitHub** account, a free **Netlify** account, and an **OpenAI API key** (from platform.openai.com → API keys).

### Step 1. Put the project on GitHub
1. Unzip the download on your computer.
2. On github.com, click **+** (top right) → **New repository**.
3. Name it, for example `russian-two-views`. Choose **Public** or **Private**. Do **not** add a README. Click **Create repository**.
4. On the next page, click **uploading an existing file**.
5. Open the unzipped `russian-info-gap` folder. Select **everything inside it** (`public`, `netlify`, `netlify.toml`, `README.md`, …) and drag it onto the page.
6. Click **Commit changes**.

✅ Check: the repository's main page shows `netlify.toml` and the `public` and `netlify` folders at the top level (not inside another folder).

### Step 2. Connect GitHub to Netlify
1. Go to app.netlify.com → **Add new project** (or **Add new site**) → **Import an existing project**.
2. Choose **GitHub**, allow access, and pick your repository.
3. Leave the build settings as they are. `netlify.toml` already sets them (publish directory `public`, functions directory `netlify/functions`, no build command).

### Step 3. Add your OpenAI key in Netlify (not in the code)
1. On the same setup page, click **Add environment variables** (or after deploying: **Project configuration → Environment variables → Add a variable**).
2. Key: `OPENAI_API_KEY`. Value: your key (starts with `sk-`).
3. Click **Deploy**. If you added the key after the first deploy, go to **Deploys → Trigger deploy → Deploy site**.

### Step 4. Test
1. Open your site's `…netlify.app` address.
2. Press **Listen to Аня**. You should hear Russian.
3. Press 🎤, allow the microphone, ask a question, then press **Ask**.
4. Try **↻ New story**.

### Step 5 (recommended). Protect your OpenAI budget
On platform.openai.com → **Settings → Limits**, set a monthly budget. Anyone who finds your site address can use it, and that spending goes to your account.

---

## Optional settings (Netlify environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | *(required)* | Your OpenAI key |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model for answers, stories, and feedback |
| `OPENAI_TTS_MODEL` | `gpt-4o-mini-tts` | Voice model (`tts-1` also works) |
| `OPENAI_TRANSCRIBE_MODEL` | `gpt-4o-mini-transcribe` | Speech-to-text model (`whisper-1` also works) |

If OpenAI retires a model, change the variable and redeploy. You don't need to edit the code.

## Changing or adding stories

Edit `public/stories.js`. Each person has a `narrative_ru`, a `voice`, and `suggested` questions. The story also has a `differences_en` answer key, which the feedback uses.

## Troubleshooting

- **"The server has no OpenAI key yet"**: add `OPENAI_API_KEY` (Step 3) and redeploy.
- **"OpenAI did not accept the API key"**: the key is wrong or was revoked. Paste it again.
- **"out of credit"**: add billing credit on platform.openai.com.
- **Microphone doesn't work**: the site must be opened over `https://` (Netlify does this). Allow the microphone in the browser. Typing always works.
- **New story times out**: try again. Story writing is the slowest request.

## Run on your own computer (optional)

```bash
npm install -g netlify-cli
cp .env.example .env      # then put your key in .env (never commit it)
netlify dev
```
