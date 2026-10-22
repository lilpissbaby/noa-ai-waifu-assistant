<div align="center">

# Noa · Waifu Desk

**An AI assistant shaped like an anime character who lives floating on top of your desktop.**
Talk to her by text or voice and Claude (or the model you pick) answers. She hands work to your Hermes agent
on your VPS, creates and assigns tasks to your Paperclip agents and runs your automations.

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
- **Any model**: Claude with your API key or any OpenAI-compatible API (OpenAI, OpenRouter, Groq, Gemini,
  Ollama, LM Studio or Hermes itself). Streaming and tool use. Keys are stored encrypted.
- **Voice**: Whisper dictation (Groq has a free plan) that stops when you go quiet, and spoken replies with
  lip-sync (system voices, OpenAI/Kokoro or ElevenLabs).
- **Hermes Agent**: hands anything that must happen on the server to your VPS agent.
- **Paperclip**: lists agents and projects, creates, assigns and comments on tasks, and wakes agents up.
- **Automations**: webhooks (n8n, Make, Home Assistant…), any **MCP** server and commands on your PC, always
  with your approval.
- **Skins**: give her any drawing and she cuts out the background with an anime-trained AI model, locally.
  Eyes, mouth and neck are placed automatically and you fine-tune them with a live animated preview.
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

## Screenshots

**States**: idle, listening, thinking, working with a tool and talking.

![Avatar states](docs/screenshots/states.jpg)

**The same request in all five languages.** Both the interface and the reply follow the chosen language.

![Chat in Spanish, English, Russian, Ukrainian and Chinese](docs/screenshots/languages.jpg)

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/settings-general.png" alt="Settings: general and language" /></td>
    <td width="50%"><img src="docs/screenshots/settings-models.png" alt="Settings: AI models" /></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/settings-connectors.png" alt="Settings: Hermes and Paperclip" /></td>
    <td><img src="docs/screenshots/settings-voice.png" alt="Settings: voice" /></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/settings-automations.png" alt="Settings: automations" /></td>
    <td><img src="docs/screenshots/settings-skins.png" alt="Settings: skins" /></td>
  </tr>
</table>

![Skin editor](docs/screenshots/skin-editor.png)

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

## Connectors in short

- **Hermes Agent**: enable the API server on your VPS (`API_SERVER_ENABLED=true`, `API_SERVER_KEY=…` in
  `~/.hermes/.env`, then `hermes gateway`), publish it behind TLS or an SSH tunnel and paste the URL (ending in
  `/v1`) and key in Settings → Hermes & Paperclip. Never expose it without a key and TLS.
- **Paperclip**: paste your server root URL (`/api` is added automatically), a board token in `authenticated`
  mode, then **Test and list companies**. Actions that change things ask for confirmation.
- **Webhooks and MCP**: each webhook becomes a `webhook_<name>` tool (the description is what the AI reads);
  MCP servers can be stdio or Streamable HTTP.
- **Commands** (`run_command`): PowerShell on Windows, bash on Linux; every command needs your explicit approval.

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

**CI** runs lint, tests and the smoke test on Linux and Windows for every push and pull request, and builds all
the executables. **Release**: when CI on `main` passes with a new `version` in `package.json`, it tags `vX.Y.Z`
and publishes a GitHub release with the executables and the matching `CHANGELOG.md` section. Versions with a
suffix (`0.3.0-beta.1`) are published as pre-releases.

## Licence

[MIT](LICENSE) © mupsim.
