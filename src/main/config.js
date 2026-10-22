// Configuración persistente + secretos cifrados (DPAPI en Windows, keyring en Linux).
import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const userDir = () => app.getPath('userData');
const configPath = () => path.join(userDir(), 'config.json');
const secretsPath = () => path.join(userDir(), 'secrets.json');

export const uid = () => crypto.randomBytes(5).toString('hex');

// Presets de proveedor que aparecen al crear un perfil.
export const PROVIDER_PRESETS = {
  anthropic: { kind: 'anthropic', name: 'Claude (Anthropic)', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-5-5', toolsEnabled: true },
  openai: { kind: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: '', toolsEnabled: true },
  openrouter: { kind: 'openai', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: '', toolsEnabled: true },
  groq: { kind: 'openai', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: '', toolsEnabled: true },
  gemini: { kind: 'openai', name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: '', toolsEnabled: true },
  ollama: { kind: 'openai', name: 'Ollama (local)', baseUrl: 'http://localhost:11434/v1', model: '', toolsEnabled: true },
  lmstudio: { kind: 'openai', name: 'LM Studio (local)', baseUrl: 'http://localhost:1234/v1', model: '', toolsEnabled: true },
  hermes: { kind: 'openai', name: 'Hermes Agent (VPS)', baseUrl: 'http://TU-VPS:8642/v1', model: 'hermes-agent', toolsEnabled: false },
  custom: { kind: 'openai', name: 'Personalizado (OpenAI-compatible)', baseUrl: 'http://localhost:8000/v1', model: '', toolsEnabled: true },
};

export function defaultConfig() {
  const claudeId = 'claude';
  return {
    version: 1,
    assistant: {
      name: 'Noa',
      userName: '',
      language: 'español',
      personality:
        'Alegre, ingeniosa y un pelín sarcástica, pero siempre útil y directa. Nada de relleno ni de frases de cortesía vacías.',
      extraInstructions: '',
    },
    profiles: [
      { id: claudeId, ...PROVIDER_PRESETS.anthropic, name: 'Claude Sonnet', maxTokens: 4096, temperature: null },
      { id: 'hermes', ...PROVIDER_PRESETS.hermes, maxTokens: 4096, temperature: null },
    ],
    activeProfileId: claudeId,
    voice: {
      stt: { provider: 'groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'whisper-large-v3-turbo', language: 'es' },
      tts: {
        mode: 'system', // system | openai | elevenlabs | off
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini-tts',
        voice: 'nova',
        elevenVoiceId: '',
        elevenModel: 'eleven_multilingual_v2',
        systemVoice: '',
        rate: 1.05,
        pitch: 1.25,
      },
      speakReplies: 'voice', // voice (solo si hablé yo) | always | never
      autoStopOnSilence: true,
    },
    connectors: {
      hermes: { enabled: false, baseUrl: 'http://TU-VPS:8642/v1', model: 'hermes-agent', timeoutSec: 900 },
      paperclip: { enabled: false, baseUrl: 'http://localhost:3100', companyId: '' },
      shell: { enabled: false },
      webhooks: [],
      mcpServers: [],
    },
    tools: { autoApprove: {} },
    ui: {
      skinId: 'default',
      scale: 1,
      position: null,
      alwaysOnTop: true,
      followCursor: true,
      hotkeyChat: 'Control+Alt+Space',
      hotkeyTalk: 'Control+Alt+V',
      startWithSystem: false,
    },
  };
}

function deepMerge(base, extra) {
  if (Array.isArray(base) || Array.isArray(extra)) return extra ?? base;
  if (base && typeof base === 'object' && extra && typeof extra === 'object') {
    const out = { ...base };
    for (const k of Object.keys(extra)) out[k] = k in base ? deepMerge(base[k], extra[k]) : extra[k];
    return out;
  }
  return extra === undefined ? base : extra;
}

let cache = null;

export function loadConfig() {
  if (cache) return cache;
  let saved = {};
  try {
    saved = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
  } catch {
    /* primera ejecución */
  }
  cache = deepMerge(defaultConfig(), saved);
  return cache;
}

export function saveConfig(next) {
  cache = next;
  fs.mkdirSync(userDir(), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(next, null, 2));
  return cache;
}

// Actualiza por "parche" profundo. Los arrays se sustituyen enteros.
export function patchConfig(patch) {
  return saveConfig(deepMerge(loadConfig(), patch));
}

// ---------- secretos ----------
let secrets = null;
function loadSecrets() {
  if (secrets) return secrets;
  try {
    secrets = JSON.parse(fs.readFileSync(secretsPath(), 'utf8'));
  } catch {
    secrets = {};
  }
  return secrets;
}

export const secureStorageAvailable = () => safeStorage.isEncryptionAvailable();

export function setSecret(ref, value) {
  const s = loadSecrets();
  if (!value) delete s[ref];
  else if (safeStorage.isEncryptionAvailable()) s[ref] = { enc: safeStorage.encryptString(value).toString('base64') };
  else s[ref] = { plain: Buffer.from(value, 'utf8').toString('base64') };
  fs.mkdirSync(userDir(), { recursive: true });
  fs.writeFileSync(secretsPath(), JSON.stringify(s, null, 2), { mode: 0o600 });
}

export function getSecret(ref) {
  const entry = loadSecrets()[ref];
  if (!entry) return '';
  try {
    if (entry.enc) return safeStorage.decryptString(Buffer.from(entry.enc, 'base64'));
    if (entry.plain) return Buffer.from(entry.plain, 'base64').toString('utf8');
  } catch {
    return '';
  }
  return '';
}

export const hasSecret = (ref) => Boolean(loadSecrets()[ref]);
export const secretRefs = () => Object.keys(loadSecrets());
