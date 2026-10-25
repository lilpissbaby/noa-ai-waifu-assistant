<div align="center">

# Noa · Waifu Desk

**An AI assistant shaped like an anime character who lives floating on top of your desktop.**
Talk to her by text or voice and Claude (or the model you pick) answers. She reminds you of things, looks at
your screen, reads your documents and calendar, hands work to your Hermes agent on your VPS, creates and assigns
tasks to your Paperclip agents and tells you when they're done.

[![CI](https://github.com/lilpissbaby/noa-ai-waifu-assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/lilpissbaby/noa-ai-waifu-assistant/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/lilpissbaby/noa-ai-waifu-assistant?sort=semver&label=download)](https://github.com/lilpissbaby/noa-ai-waifu-assistant/releases/latest)
[![MIT licence](https://img.shields.io/badge/licence-MIT-ff4f9a)](LICENSE)
![Windows and Linux](https://img.shields.io/badge/Windows%20%C2%B7%20Linux-b69cff)

[Español](README.md) · English — the app speaks Spanish, English, Russian, Ukrainian and Chinese.

![Noa on the desktop: chat with Paperclip and Hermes](docs/screenshots/desktop.jpg)

</div>

## What it does

- **Lives on your desktop**: transparent, always on top, no window to open. She breathes, blinks, moves her
  mouth when she talks and turns her head to follow the mouse. Click for the chat, double-click to talk.
- **Any model**: Claude with your API key, Azure OpenAI or any OpenAI-compatible API (OpenAI, OpenRouter, Groq,
  Gemini, Ollama, LM Studio or Hermes itself). Streaming, tool use and images. Keys are stored encrypted.
- **Characters**: several of them, each with her own personality, voice and skin, plus per-topic content
  filters (including an 18+ mode with limits that can't be removed). Templates and SillyTavern cards.
- **Voice**: Whisper dictation (Groq has a free plan) that stops when you go quiet, and spoken replies with
  lip-sync: local **Piper** voices (free, offline, dozens of languages), system voices, OpenAI/Kokoro or
  ElevenLabs.
- **Productivity**: reminders and timers, memory and notes, "look at this" (she sees your screen), quick actions
  on what you copy, files, PDF and Word, calendar with a daily briefing, reading and searching the web.
- **Hermes Agent**: hands anything that must happen on the server to your VPS agent, in the background too.
- **Paperclip**: lists agents and projects, creates, assigns and comments on tasks, wakes agents up and tells
  you when a task is done or blocked.
- **Automations**: webhooks (n8n, Make, Home Assistant…), any **MCP** server and commands on your PC, always
  with your approval.
- **2D skins**: give her any drawing and she cuts out the background with an anime-trained AI model, locally.
  Eyes, mouth and neck are placed automatically and you fine-tune them with a live animated preview.
- **3D skins (VRM)**: import models from VRoid Hub, Booth or VRoid Studio. She moves according to what she's
  doing (thinks with her hand on her chin, types, waves, gestures while talking), makes faces to match the tone
  of the reply, and you can add `.vrma` or Mixamo motions.
- **VTuber avatars (Live2D)**: models from VTube Studio, Booth or nizima, driven by their `.vtube.json`.
- **Five languages**: Español, English, Русский, Українська and 中文. Follows the system language and switches
  instantly.

## Download

**[Releases](https://github.com/lilpissbaby/noa-ai-waifu-assistant/releases/latest)** has the executables of the
latest version, built by GitHub Actions:

| System | File | How to install |
| --- | --- | --- |
| Windows 10/11 | `WaifuDesk-Setup-X.Y.Z.exe` | Double-click. Installs for your user only, no admin needed. |
| Windows (portable) | `WaifuDesk-X.Y.Z-win-x64.zip` | Unzip and open `Waifu Desk.exe`. |
| Linux | `WaifuDesk-X.Y.Z-linux-x86_64.AppImage` | `chmod +x` and run it. |
| Debian / Ubuntu | `WaifuDesk-X.Y.Z-linux-amd64.deb` | `sudo apt install ./WaifuDesk-X.Y.Z-linux-amd64.deb` |

The Windows installer is not signed, so SmartScreen will warn you: **More info → Run anyway**. Every release
includes `SHA256SUMS.txt`.

## Getting started

You only need **a Claude key** to start. Everything lives in **Settings** (right-click Noa → Settings, or the
tray icon). There is no save button: every change is saved immediately.

| For | Key | Where to get it | Where it goes |
| --- | --- | --- | --- |
| Replies | Anthropic API key (`sk-ant-…`) | [platform.claude.com/settings/keys](https://platform.claude.com/settings/keys) | AI models → Claude Sonnet → API key |
| Talking to her | Groq API key | [console.groq.com](https://console.groq.com) → API Keys | Voice → Dictation → API key |
| Hermes | A key you make up | `openssl rand -hex 32` on the VPS | Hermes & Paperclip → API_SERVER_KEY |
| Paperclip | Board token, or none | `paperclipai token board create` | Hermes & Paperclip → Token |

The Anthropic API is billed separately from a claude.ai subscription. If you don't want to top up credit, add a
free profile (Gemini or Groq) in **AI models → Add profile**.

| Action | Result |
| --- | --- |
| Click the waifu | Open / close the chat |
| Double-click | She listens (stops on her own when you go quiet) |
| Drag | Move her around |
| Right-click | Menu: model, skin, size, language, always on top, settings… |
| `Ctrl+Alt+Space` | Open the chat from anywhere |
| `Ctrl+Alt+V` | Talk to her from anywhere |
| `Ctrl+Alt+S` | "Look at this": captures the screen and attaches it to the chat |
| `Ctrl+Alt+Q` | Quick actions on the copied text: translate, summarise, fix, explain, reply |
| Drop files on the chat | Images, text, code, PDF and Word as attachments (pasting works too) |

## Screenshots

**States**: idle, listening, thinking, working with a tool and talking.

![Avatar states](docs/screenshots/states.jpg)

**3D skin (VRM)**: idle, thinking, working, talking and two faces she makes to match the tone of the reply.

![3D skin states](docs/screenshots/states-3d.jpg)

**VTuber avatar (Live2D)** with Hiyori, Live2D's sample model: idle, thinking, talking, happy and following
the mouse.

![Live2D skin states](docs/screenshots/states-live2d.jpg)

**Notices**: a reminder shows up in the speech bubble and the chat, as a notification and, if you like, out loud.

![A reminder in the bubble and the chat](docs/screenshots/reminder.jpg)

**The same request in all five languages.** Both the interface and the reply follow the chosen language.

![Chat in Spanish, English, Russian, Ukrainian and Chinese](docs/screenshots/languages.jpg)

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/settings-general.png" alt="Settings: general and language" /></td>
    <td width="50%"><img src="docs/screenshots/settings-personas.png" alt="Settings: characters" /></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/settings-models.png" alt="Settings: AI models" /></td>
    <td><img src="docs/screenshots/settings-productivity.png" alt="Settings: productivity" /></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/settings-voice.png" alt="Settings: voice" /></td>
    <td><img src="docs/screenshots/settings-voice-piper.png" alt="Settings: Piper voices" /></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/settings-connectors.png" alt="Settings: Hermes and Paperclip" /></td>
    <td><img src="docs/screenshots/settings-automations.png" alt="Settings: automations" /></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/settings-skins.png" alt="Settings: skins" /></td>
    <td></td>
  </tr>
</table>

![Skin editor](docs/screenshots/skin-editor.png)

![3D skin editor](docs/screenshots/vrm-editor.png)

![Live2D model editor](docs/screenshots/live2d-editor.png)

(The settings screenshots are in Spanish; switch the language in Settings → General.)

## Languages

The interface is available in **Spanish, English, Russian, Ukrainian and Simplified Chinese**. It follows the
system language (English if it isn't one of those). Change it in **Settings → General → Interface language** or
right-click Noa → **Language**; menus, dialogs and every open window switch immediately.

- **Reply language**: empty = same as the interface. Type another one (e.g. “Español”) to get replies in that
  language with an English interface.
- The default personality and the dictation language follow the interface language unless you edited them.
- The Windows installer also follows the system language.

**Adding a language**: copy `src/shared/i18n/locales/en.js`, translate it and register it in
`src/shared/i18n/index.js` (`SUPPORTED` and `LANGUAGES`). `npm test` checks that no key or `{variable}` is
missing, and `npm run smoke` walks every window looking for untranslated strings.

## Characters

Settings → **Characters**. Each character has a personality, a scenario, a greeting, example dialogue, extra
instructions and, optionally, her own voice and skin. Switch from Noa's menu (**Character ▸**), from Settings, or
just ask ("switch to Rin", "be more serious from now on").

- **Templates**: professional, cheerful, tsundere, kuudere, sweet, sarcastic and romantic.
- **SillyTavern cards**: import the `.png` card (V2 or V3) or `.json`. Its picture can become a 2D skin in one click.
- **Content filters** per character (default in bold): strong language (avoid · **mild** · free), violence
  and dark topics (avoid · **moderate** · free), politics and religion (**neutral** · opinions), romance
  (off · **light** · on), sexual content (**off** · suggestive 18+ · explicit 18+). Asked by voice, she tightens
  her own filters without asking, but loosening them needs your confirmation.

**18+ content**: the suggestive and explicit levels only apply once you **unlock** them in Settings → Characters,
confirming you are an adult and that this content is legal where you live. You can lock it again.

- **Fixed limits**, always on and impossible to switch off: every character in romantic or sexual content is an
  adult; nothing sexual involving minors, characters who look like minors or real people; no encouraging
  self-harm or helping cause real harm.
- **It depends on the provider**: Claude (Anthropic) and OpenAI won't write explicit sexual content even if you
  unlock it. It works with local models (Ollama, LM Studio) or services that allow it; Azure OpenAI only with the
  modified content filter Microsoft approves on request.

**Azure OpenAI**: profile "Azure OpenAI", URL `https://RESOURCE.openai.azure.com/openai/v1`, the deployment name
as the model and the resource key. [`docs/azure/content-filters`](docs/azure/content-filters/README.md) has a
**Terraform** file that creates three content policies (`waifudesk-strict`, `waifudesk-standard`,
`waifudesk-relaxed`, plus a commented unfiltered one for approved accounts); in "From the character's
filters" mode the app sends the right one with each request (`x-policy-id`). When Azure blocks something, the
chat says which category blocked it.

## Productivity

Settings → **Productivity**. Ask by voice or text:

| Feature | Try saying | Notes |
| --- | --- | --- |
| Reminders and timers | "Remind me at 6 to call Ana", "set a 10-minute timer", "every Monday at 9, check the backups" | Daily, weekdays, weekly or monthly. If the app was closed, it tells you about the ones from the last 24 h. |
| Notices | — | Always in the bubble and the chat; notification and voice as you choose. |
| Memory | "Remember my dog is called Toby", "what do you know about me?", "forget the dog thing" | Goes into every conversation. Can be turned off and reviewed in Settings. |
| Notes | "Add to my *Ideas* note that…", "search my notes for the VPS" | Markdown files in a folder you choose. |
| Look at this | `Ctrl+Alt+S` or "what's on my screen?" | Captures the screen (without the waifu or the chat) for the model. Asks first. Needs a model that sees images. |
| Quick actions | Copy some text and press `Ctrl+Alt+Q` | Translate, summarise, fix, explain or reply; can copy the result back. Editable, and you can add your own. |
| Files | "What's in Downloads?", "find the flat contract", "summarise the invoice PDF" | Only inside the **folders you authorise**; writing asks first. Reads text, code, PDF and Word. |
| Calendar | "What's on today?", "when is the meeting with Marta?" | iCal links from Google Calendar or Outlook, or `.ics` files. Read-only. |
| Daily briefing | — | At the time and days you pick: agenda, reminders and what's pending. |
| Web | "Read me this article: https://…", "find the latest Postgres version" | Reading pages always works; searching uses SearXNG, Brave Search or Tavily. Local-network addresses ask first. |
| Agents | "Ask Hermes in the background to update the containers" | Tells you when a Paperclip task created or commented from here is done, blocked or in review, and when Hermes finishes. |

## Piper voices

Local neural voices: free, natural-sounding and **offline**, in dozens of languages. The first time, the engine
is downloaded (about 9 MB: espeak-ng in WebAssembly, GPL licence). Then pick voices from the
[rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices) **catalogue** (filtered by reply language)
or **import** your own: a `.onnx` with its `.onnx.json`, or a `.zip` with one or more voices (up to 300 MB per
voice). **Every voice has its own licence**, shown next to it (from its `MODEL_CARD`); many are CC BY 4.0, CC0 or MIT,
but check the one you pick. Each character can have her own voice.

## Connectors in short

- **Hermes Agent**: enable the API server on your VPS (`API_SERVER_ENABLED=true`, `API_SERVER_KEY=…` in
  `~/.hermes/.env`, then `hermes gateway`), publish it behind TLS or an SSH tunnel and paste the URL (ending in
  `/v1`) and key in Settings → Hermes & Paperclip. Never expose it without a key and TLS.
- **Paperclip**: paste your server root URL (`/api` is added automatically), a board token in `authenticated`
  mode, then **Test and list companies**. Actions that change things ask for confirmation.
- **Webhooks and MCP**: each webhook becomes a `webhook_<name>` tool (the description is what the AI reads);
  MCP servers can be stdio or Streamable HTTP.
- **Commands** (`run_command`): PowerShell on Windows, bash on Linux; every command needs your explicit approval.

## 3D skins (VRM)

Settings → Skins → **Import a 3D model (VRM)** (or right-click Noa → Skin → Import 3D model):

1. **Model**: a `.vrm` file (VRM 0.x or 1.0) or a direct link to one, up to 150 MB. Get them from
   [VRoid Hub](https://hub.vroid.com) (downloadable ones), [Booth](https://booth.pm), or make your own for free
   with [VRoid Studio](https://vroid.com/studio).
2. **License**: the app shows what the model's author declared (who may use it, commercial use, redistribution,
   modification, credit). **Only use it as it allows.**
3. **Framing**: full body, half body or bust, with zoom, turn, camera angle and height.
4. **Try her out**: states, faces and a wave.
5. **Motions**: import `.vrma` animations or Mixamo `.fbx` files ("Without Skin") and assign them to a state or
   gesture. They apply to every 3D skin; anything unassigned uses the built-in motions.
6. **Save and use**.

**Faces from the AI**: the model marks its tone with hidden tags (`<emo:happy>`, `<emo:sad>`…) that the app
strips from the text and turns into expressions. Turn it off in Settings → General.

The built-in 3D skin, **Noa 3D**, is pixiv's sample girl from the [three-vrm](https://github.com/pixiv/three-vrm)
repository (VRM 1.0, redistribution and modification allowed, no credit required; see
[`assets/skins/noa-3d/LICENSE.txt`](assets/skins/noa-3d/LICENSE.txt)). 3D needs a GPU: without acceleration
(virtual machines, remote desktop) it runs at a few frames per second, so use a 2D skin there.

## VTuber avatars (Live2D)

Settings → Skins → **Import a VTuber model (Live2D)**. **Cubism 3, 4 and 5** models (`.model3.json`) work, like
the ones for VTube Studio, [Booth](https://booth.pm) or [nizima](https://nizima.com); old Cubism 2 ones
(`.moc`, `model.json`) don't.

1. **Cubism Core**: Live2D's runtime is proprietary and isn't bundled. The first time, the app shows a summary
   of its licence (free for individuals and small businesses;
   [full licence](https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html)) and, if you
   accept, downloads it from Live2D's official SDK (5-r.4). You can also import the SDK `.zip` or
   `live2dcubismcore.min.js`. The Cubism 5.3 Core (SDK 5-r.5 or later) isn't supported by the engine yet, so
   models exported for Cubism 5.3 aren't either.
2. **Model**: a `.zip` or a folder (up to 300 MB and 2000 files). If it holds several models, pick one.
3. **Licence**: the app shows the terms files that come with the model. **Only use it as they allow.**
4. **VTube Studio settings**: with the model's `.vtube.json` she moves like in VTube Studio (same ranges,
   smoothing, breathing and hotkey expressions); without it, the standard Cubism parameters are used.
5. **Framing**, a **face** for each emotion (auto-assigned by expression name) and **sliders** to test every
   parameter.
6. **Save and use**.

There's no built-in Live2D model: the sample models' licences don't allow bundling them.

The [Spanish README](README.md) has the full guide (nginx config, Paperclip CLI, voice providers, layered skins).

## Development

Requires **Node.js 22.13+**.

```bash
git clone https://github.com/lilpissbaby/noa-ai-waifu-assistant.git
cd noa-ai-waifu-assistant
npm install
npm start
```

| Command | What it does |
| --- | --- |
| `npm start` | Run the app from source |
| `npm test` | Unit tests (translations, LLM adapters, agent loop, tools, voice, settings) |
| `npm run lint` | ESLint |
| `npm run smoke` | Launches the real app, walks every window in all 5 languages and runs a tool-calling conversation against a mock server (`xvfb-run -a npm run smoke` on headless Linux) |
| `npm run screenshots` | Regenerates `docs/screenshots` |
| `npm run dist:win` | Windows `.zip` + NSIS installer in `dist/`, from Windows, Linux or macOS without Wine (needs `makensis`) |
| `npm run dist:linux` | Linux AppImage + `.deb` |

The smoke test and screenshots also exercise Piper and Live2D when given `WAIFU_TEST_PIPER_VOICE=<folder with a
.onnx voice>` and `WAIFU_TEST_LIVE2D_DIR=<folder>` (prepare it with `node tools/fetch-live2d-fixtures.mjs <folder>`).
CI does both.

**CI** runs lint, tests and the smoke test on Linux and Windows for every push and pull request, and builds all
the executables. **Release**: when CI on `main` passes with a new `version` in `package.json`, it tags `vX.Y.Z`
and publishes a GitHub release with the executables and the matching `CHANGELOG.md` section. Versions with a
suffix (`0.4.0-beta.1`) are published as pre-releases.

## Licence

[MIT](LICENSE) © mupsim. Noa 3D is a sample model by pixiv Inc. ([licence](assets/skins/noa-3d/LICENSE.txt)).

Bundled: [three.js](https://threejs.org) and [three-vrm](https://github.com/pixiv/three-vrm) (MIT),
[pixi.js](https://pixijs.com) (MIT), [untitled-pixi-live2d-engine](https://github.com/Untitled-Story/untitled-pixi-live2d-engine)
(MIT), [onnxruntime-web](https://onnxruntime.ai) (MIT), [pdf.js](https://mozilla.github.io/pdf.js/) (Apache-2.0),
[Readability](https://github.com/mozilla/readability) (Apache-2.0), [linkedom](https://github.com/WebReflection/linkedom)
(ISC), [ical.js](https://github.com/kewisch/ical.js) (MPL-2.0) and the MCP SDK (MIT).

Downloaded separately, only if you use them, under their own licences: the `isnet-anime` cut-out model
(Apache-2.0); the Piper engine ([piper-wasm](https://www.npmjs.com/package/@diffusionstudio/piper-wasm), with
espeak-ng, GPL-3.0); each Piper voice (its own, shown in the app); and the **Live2D Cubism Core** (proprietary,
Live2D Inc., [licence](https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html)). The
Hiyori model in the screenshots is sample material © Live2D Inc.
([Free Material License](https://www.live2d.com/eula/live2d-free-material-license-agreement_en.html)) and is not
shipped with the app.
