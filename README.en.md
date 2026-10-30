<div align="center">

# Noa · Waifu Desk

**An AI assistant shaped like an anime character who lives floating on top of your desktop.**
Talk to her by text or voice and Claude (or the model you pick) answers. She keeps your tasks and routines,
puts you in focus mode, looks at your screen, reads your documents and calendar, hands work to your Hermes agent
on your VPS, creates and assigns tasks to your Paperclip agents, watches your services and your GitHub CI,
drives your Home Assistant and pings your phone too.

[![CI](https://github.com/lilpissbaby/noa-ai-waifu-assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/lilpissbaby/noa-ai-waifu-assistant/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/lilpissbaby/noa-ai-waifu-assistant?sort=semver&label=download)](https://github.com/lilpissbaby/noa-ai-waifu-assistant/releases/latest)
[![MIT licence](https://img.shields.io/badge/licence-MIT-ff4f9a)](LICENSE)
![Windows and Linux](https://img.shields.io/badge/Windows%20%C2%B7%20Linux-b69cff)

[Español](README.md) · English — the app speaks Spanish, English, Russian, Ukrainian and Chinese.

![Noa on the desktop: chat with Paperclip and Hermes](docs/screenshots/desktop.jpg)

</div>

<details>
<summary><b>Contents</b></summary>

- [What it does](#what-it-does) · [New in 0.5.0](#new-in-050) · [Download](#download) · [Getting started](#getting-started) · [Screenshots](#screenshots)
- [Free models](#free-models) · [Languages](#languages) · [Characters](#characters) · [Productivity](#productivity) · [Organize](#organize) · [Info](#info-weather-news-clipboard-and-pc)
- [Connectors](#connectors) · [GitHub](#github) · [Home Assistant](#home-assistant) · [Phone notifications](#phone-notifications) · [Automations](#automations-mcp-catalog-and-service-monitor)
- [3D skins](#3d-skins-vrm) · [VTuber avatars](#vtuber-avatars-live2d) · [Model gallery](#free-model-gallery) · [Pet mode](#pet-mode) · [Usage and cost](#usage-and-cost)
- [All the tools](docs/herramientas.md) · [Development](#development) · [Licence](#licence)

</details>

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
  on what you copy, files, PDF and Word, calendar with a daily briefing, reading and searching the web, weather,
  RSS news, clipboard history and PC status.
- **Organize**: a to-do list, routines she runs on her own on schedule ("every Monday at 9, ask Hermes about the
  backups"), focus mode (Pomodoro) with "do not disturb" and break reminders.
- **Hermes Agent**: hands anything that must happen on the server to your VPS agent, in the background too.
- **Paperclip**: lists agents and projects, creates, assigns and comments on tasks, wakes agents up and tells
  you when a task is done or blocked.
- **GitHub**: notifications, issues, pull requests and CI; creates issues and comments, and tells you when CI fails.
- **Home Assistant**: ask about your home and have her switch things on and off.
- **Phone notifications** (ntfy, Telegram or Gotify): she sends things to your phone and forwards her notices.
- **Automations**: webhooks (n8n, Make, Home Assistant…), any **MCP** server (with a catalogue of 15 ready to
  add), a monitor that tells you when a site or service goes down, and commands on your PC, always with your
  approval.
- **2D skins**: give her any drawing and she cuts out the background with an anime-trained AI model, locally.
  Eyes, mouth and neck are placed automatically and you fine-tune them with a live animated preview.
- **3D skins (VRM)**: import models from VRoid Hub, Booth or VRoid Studio. She moves according to what she's
  doing (thinks with her hand on her chin, types, waves, gestures while talking), makes faces to match the tone
  of the reply, and you can add `.vrma` or Mixamo motions.
- **VTuber avatars (Live2D)**: models from VTube Studio, Booth or nizima, driven by their `.vtube.json`.
- **Free model gallery**: 26 3D and VTuber models, downloaded from their source with one click.
- **Pet mode**: she falls asleep when you're away and greets you when you're back.
- **Usage and cost**: how many tokens each model uses and what it costs you.
- **Five languages**: Español, English, Русский, Українська and 中文. Follows the system language and switches
  instantly.

## New in 0.5.0

- [Organize](#organize): **tasks**, scheduled **routines**, **focus mode** and **breaks**.
- [Info](#info-weather-news-clipboard-and-pc): **weather**, RSS **news**, **clipboard history** and **PC status**.
- New connectors: [GitHub](#github), [Home Assistant](#home-assistant) and [phone notifications](#phone-notifications).
- [Service monitor and MCP catalogue](#automations-mcp-catalog-and-service-monitor).
- [Free model gallery](#free-model-gallery), [pet mode](#pet-mode) and per-model [usage and cost](#usage-and-cost).
- [66 tools](docs/herramientas.md) documented straight from the code.

![She lists today's tasks, starts 25 minutes of focus and sends the VPS status to the phone](docs/screenshots/chat-organize.jpg)

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
| Hermes | A key you make up | `openssl rand -hex 32` on the VPS | Connectors → API_SERVER_KEY |
| Paperclip | Board token, or none | `paperclipai token board create` | Connectors → Token |

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
| Right-click → Focus | Starts a 25, 50 or 90-minute block (also from the tray) |
| Right-click → Tasks | Opens your to-do list (shows how many are open) |
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

**Pet mode and organize notices**: asleep, welcome back, end of a focus block, a break and a service down.

![Asleep, welcome back, focus, break and service down](docs/screenshots/pet.jpg)

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
    <td><img src="docs/screenshots/settings-connectors.png" alt="Settings: connectors" /></td>
    <td><img src="docs/screenshots/settings-automations.png" alt="Settings: automations" /></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/settings-skins.png" alt="Settings: skins" /></td>
    <td><img src="docs/screenshots/settings-gallery.png" alt="Settings: free model gallery" /></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/settings-organize.png" alt="Settings: tasks and focus" /></td>
    <td><img src="docs/screenshots/settings-routines.png" alt="Settings: routines" /></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/settings-info.png" alt="Settings: weather and news" /></td>
    <td><img src="docs/screenshots/settings-clipboard.png" alt="Settings: clipboard history" /></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/settings-connectors-more.png" alt="Settings: GitHub and Home Assistant" /></td>
    <td><img src="docs/screenshots/settings-phone.png" alt="Settings: phone notifications" /></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/settings-mcp-catalog.png" alt="Settings: MCP catalogue" /></td>
    <td><img src="docs/screenshots/settings-monitors.png" alt="Settings: service monitor" /></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/settings-usage.png" alt="Settings: usage and cost" /></td>
    <td><img src="docs/screenshots/settings-presence.png" alt="Settings: pet mode" /></td>
  </tr>
</table>

![Skin editor](docs/screenshots/skin-editor.png)

![3D skin editor](docs/screenshots/vrm-editor.png)

![Live2D model editor](docs/screenshots/live2d-editor.png)

(The settings screenshots are in Spanish; switch the language in Settings → General.)

## Free models

Every free anime-girl model we gathered, no account needed anywhere: **31 in 3D (VRM)** and **8 VTuber
(Live2D)**. The purple-labelled ones are in the app's [gallery](#free-model-gallery) and download with one click;
the pink ones ("solo local") are free but their licence doesn't allow redistributing them.

![All 39 free models: 31 VRM and 8 Live2D](docs/screenshots/models.jpg)

Full list with author, licence and source, plus more places to get models: [`docs/modelos.md`](docs/modelos.md)
(in Spanish).

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
| Tasks | "Note that I must renew the domain by Friday", "what's on for today?" | See [Organize](#organize). |
| Routines | "Every weekday at 8:30 tell me the weather, my tasks and the headlines" | She runs them on her own and reports back. |
| Focus | "Give me 50 minutes of focus for the report" | Pomodoro with "do not disturb". |
| Weather | "Will it rain tomorrow?", "what's the weather in Lisbon?" | Open-Meteo, free and keyless. |
| News | "What's new on Hacker News?" | Your RSS or Atom feeds. |
| Clipboard | "What did I copy before the link?" | Only if you turn the history on; memory only. |
| PC status | "How much disk space is left?", "what's eating the CPU?" | CPU, memory, disks, network and processes. |
| Open files | "Open the invoice PDF" | Only in authorised folders, asks first, never programs or scripts. |

## Organize

Settings → **Organize**, plus Focus and Tasks in her right-click menu and the tray.

![Settings: tasks and focus mode](docs/screenshots/settings-organize.png)

- **Tasks**: a to-do list with a **due date** (day, or day and time), **priority** and **project**. Ask out loud
  ("note that…", "what's pending?", "mark the domain one as done") or use the Open / Today / Done / All filters.
  Overdue tasks show in red, in the daily briefing and in pet mode's greeting. Tasks don't ring at a time: that's
  what reminders are for.
- **Routines**: requests she runs **on her own** at a time on chosen days, with whatever tools are enabled, and
  then reports back as a notice (and on your phone, if configured). Missed ones (app closed, another reply in
  progress) are caught up within 30 minutes. **Run now** fires one immediately and the last result stays below.
  Creating one by voice asks first, since routines use tools while you're away. They spend model tokens like any
  request.
- **Focus mode**: Pomodoro work blocks (25 min by default), short breaks (5) and a long one (15) every 4 blocks.
  With **Do not disturb**, other notices only go to the bubble and the chat while you work. Settings shows the
  clock, today's total and the week's chart.
- **Breaks**: if enabled, after a long stretch at the computer (50 min by default) she reminds you to drink
  water, stretch or rest your eyes (20-20-20). Stepping away resets the count; it stays quiet during focus mode.

## Info: weather, news, clipboard and PC

- **Weather**: set your city ("London, GB") and press **Find and save**. Uses [Open-Meteo](https://open-meteo.com):
  free, no account, no key. Current weather and up to 7 days, °C or °F; it goes into the daily briefing.
- **News**: add RSS or Atom feeds (blogs, newspapers, `https://github.com/user/repo/releases.atom`, subreddits…);
  they're tested when added. "What's new?" mixes them all by date.
- **Clipboard history**: off by default (it would also keep passwords you copy). When on, it remembers the last
  50 texts you copy while the app is open, **in memory only**.
- **PC status**: CPU, memory, disks, network, uptime, battery and, on request, the top processes. Read-only.

![Settings: weather and news](docs/screenshots/settings-info.png)


## Piper voices

Local neural voices: free, natural-sounding and **offline**, in dozens of languages. The first time, the engine
is downloaded (about 9 MB: espeak-ng in WebAssembly, GPL licence). Then pick voices from the
[rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices) **catalogue** (filtered by reply language)
or **import** your own: a `.onnx` with its `.onnx.json`, or a `.zip` with one or more voices (up to 300 MB per
voice). **Every voice has its own licence**, shown next to it (from its `MODEL_CARD`); many are CC BY 4.0, CC0 or MIT,
but check the one you pick. Each character can have her own voice.

## Connectors

- **Hermes Agent**: enable the API server on your VPS (`API_SERVER_ENABLED=true`, `API_SERVER_KEY=…` in
  `~/.hermes/.env`, then `hermes gateway`), publish it behind TLS or an SSH tunnel and paste the URL (ending in
  `/v1`) and key in Settings → Connectors. Never expose it without a key and TLS.
- **Paperclip**: paste your server root URL (`/api` is added automatically), a board token in `authenticated`
  mode, then **Test and list companies**. Actions that change things ask for confirmation.
- **Webhooks and MCP**: each webhook becomes a `webhook_<name>` tool (the description is what the AI reads);
  MCP servers can be stdio or Streamable HTTP.
- **Commands** (`run_command`): PowerShell on Windows, bash on Linux; every command needs your explicit approval.

### GitHub

Settings → Connectors → **GitHub**. Create a token in **GitHub → Settings → Developer settings → Fine-grained
tokens** with read access to Issues, Pull requests, Actions and Notifications (and write access to Issues to
create or comment), paste it and press **Test connection**. Ask "any GitHub notifications?", "which PRs are
waiting for my review?", "how's CI on noa-ai-waifu-assistant?", "open an issue in owner/repo…" (asks first).
**Watched repos**: every few minutes she checks their GitHub Actions runs and tells you when one fails and when
it's green again.

![Settings: GitHub and Home Assistant](docs/screenshots/settings-connectors-more.png)

### Home Assistant

Settings → Connectors → **Home Assistant**: the URL (`http://homeassistant.local:8123`) and a long-lived token
(**your profile → Security → Long-lived access tokens**). "What's the temperature in the living room?", "turn
off the living room light", "set the heating to 21". Every action asks first (or "Always allow"). Prefer Home
Assistant's own MCP server? It's in the MCP catalogue.

### Phone notifications

Settings → Connectors → **Phone notifications**: **ntfy** (install the app, subscribe to a long random topic,
paste it), **Telegram** (a bot from @BotFather plus your chat id) or **Gotify**. She can send you things ("send
the shopping list to my phone") and forward the app's notices: none, the important ones (reminders, routines,
services down, CI, agents) or all. **Send a test** checks it works. With public ntfy anyone who knows the topic
can read it: use a long random name or your own server with a token.

![Settings: phone notifications](docs/screenshots/settings-phone.png)

## Automations: MCP catalog and service monitor

- **MCP catalogue**: 15 well-known servers ready to add with one click (Filesystem, Git, Fetch, Time, Memory,
  Sequential Thinking, Playwright, Context7, official GitHub, Home Assistant, Notion, Obsidian, Brave Search,
  Firecrawl and Paperclip). They're added **disabled**: check the key or folder, enable and press "Reconnect".
  Node ones need Node.js (`npx`), Python ones need [uv](https://docs.astral.sh/uv/) (`uvx`).
- **Service monitor**: the URLs of your sites and services, optionally with text that must appear. Checked every
  5 minutes; you're told when one goes down (two failures in a row) and when it's back. She can also check it
  ("is everything fine on the VPS?") and the daily briefing mentions anything down.

![Settings: MCP catalogue](docs/screenshots/settings-mcp-catalog.png)

![Settings: service monitor](docs/screenshots/settings-monitors.png)

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

There's no built-in Live2D model: the sample models' licences don't allow bundling them (they're in the gallery,
though).

## Free model gallery

Settings → Skins → **Free model gallery** (or right-click Noa → Skin → Free model gallery): 26 free models, **18
in 3D (VRM)** and **8 VTuber (Live2D)**, with thumbnail, author and licence. Press **Use** and the app downloads
the model from its **original repository** (pinned to a commit) and opens it in the 3D or VTuber editor, where
you see its licence, adjust the framing and save it. Only models whose authors let anyone use and redistribute
them, or that come from the rights holder's own repository, are listed; no model is bundled, only the
thumbnails.

![Settings: free model gallery](docs/screenshots/settings-gallery.png)

## Pet mode

Settings → General → **Pet mode**. If you don't touch the keyboard or mouse for a while (10 min by default) she
falls asleep: eyes closed, slow breathing and a "Zzz…". When you come back she greets you, says how long you were
away and mentions overdue tasks or upcoming reminders. Bubble only, no voice or notification. She doesn't fall
asleep while thinking or talking, and wakes up with a click or any notice.

## Usage and cost

AI models → **Usage and cost**: input (↑) and output (↓) tokens and requests per model today, over 7 days and
this month. Under **Prices per model** enter what each one charges (dollars per million tokens, as published by
the provider) to get an estimated cost. Claude always reports usage; among OpenAI-compatible providers, usage is
requested from OpenAI, OpenRouter, Groq, Azure, Gemini, DeepSeek and Mistral.

![Settings: usage and cost](docs/screenshots/settings-usage.png)

## All the tools

She has **66 tools** (plus those of your MCP servers) and only sees the ones you've configured. The full list,
with what each does, its parameters, when it's available and which ones ask first, is generated from the code in
[`docs/herramientas.md`](docs/herramientas.md).

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
| `npm run docs:tools` | Regenerates `docs/herramientas.md` from the code |
| `npm run docs:models` | Regenerates `docs/modelos.md` |
| `npm run gallery:fetch -- <folder>` | Downloads every gallery model (and the extra ones in the README image) |
| `npm run gallery:render` | With `WAIFU_GALLERY_DIR=<folder>` and `WAIFU_LIVE2D_CORE=<Core or SDK>`, photographs each model with the app: `assets/gallery` thumbnails and `docs/screenshots/models.jpg` |
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

The thumbnails in `assets/gallery` and `docs/screenshots/models.jpg` are pictures of third-party models, each
with its own author and licence (see [`docs/modelos.md`](docs/modelos.md)); the models themselves are not in the
app or the repository.
