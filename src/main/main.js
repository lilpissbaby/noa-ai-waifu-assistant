// Waifu Desk — proceso principal de Electron.
import { app, BrowserWindow, ipcMain, protocol, net, screen, Tray, Menu, nativeImage, globalShortcut, dialog, session, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { loadConfig, patchConfig, saveConfig, getSecret, setSecret, hasSecret, secureStorageAvailable, userDir, uid, providerPresets, effectiveLocale } from './config.js';
import { t, tIn, setLocale, getLocale, localeTag, languageFromName, SUPPORTED, LANGUAGES } from '../shared/i18n/index.js';
import { runTurn } from './llm/agent.js';
import { listAnthropicModels } from './llm/anthropic.js';
import { listOpenAIModels } from './llm/openai.js';
import { buildToolbox } from './tools/index.js';
import { syncMcp, mcpStatus, closeAllMcp } from './tools/mcp.js';
import { testHermes } from './tools/hermes.js';
import { testPaperclip } from './tools/paperclip.js';
import { transcribe, synthesize, speakable, SentenceChunker } from './voice.js';
import { isBundleAllowed } from './bundle-allowed.js';
import { APP_ROOT, listSkins, getSkin, saveSkin, deleteSkin, fetchImage, segmentModelStatus, downloadSegmentModel, stageVrm, downloadVrm, saveVrmSkin, clearVrmTmp } from './skins.js';
import * as logger from './log.js';

process.on('uncaughtException', (e) => logger.error('uncaughtException', e));
process.on('unhandledRejection', (e) => logger.error('unhandledRejection', e));

const isWin = process.platform === 'win32';
const isLinux = process.platform === 'linux';
const PRELOAD = path.join(APP_ROOT, 'src', 'preload', 'preload.cjs');
const pageUrl = (name) => `app://local/bundle/src/renderer/${name}/${name}.html`;

if (isLinux) {
  app.commandLine.appendSwitch('enable-transparent-visuals');
}
// Solo en desarrollo (npm run smoke / screenshots): carpeta de datos aparte y un script que maneja la app.
const AUTOMATION = !app.isPackaged ? process.env.WAIFU_DESK_AUTOMATION : null;
if (!app.isPackaged && process.env.WAIFU_DESK_USER_DATA) app.setPath('userData', path.resolve(process.env.WAIFU_DESK_USER_DATA));
// La voz debe sonar sin que haya un clic previo en la ventana del avatar.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.setAppUserModelId('desk.waifu.app');

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true } },
]);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.wasm': 'application/wasm',
  '.onnx': 'application/octet-stream',
  '.vrm': 'model/gltf-binary',
  '.vrma': 'model/gltf-binary',
  '.glb': 'model/gltf-binary',
  '.woff2': 'font/woff2',
};

function registerAppProtocol() {
  protocol.handle('app', async (req) => {
    const u = new URL(req.url);
    const [, area, ...rest] = u.pathname.split('/');
    const rel = decodeURIComponent(rest.join('/'));
    const root = area === 'bundle' ? APP_ROOT : area === 'user' ? userDir() : null;
    if (!root || (area === 'bundle' && !isBundleAllowed(rel))) return new Response('Forbidden', { status: 403 });
    const file = path.normalize(path.join(root, rel));
    if (!file.startsWith(path.normalize(root) + path.sep)) return new Response('Forbidden', { status: 403 });
    let res;
    try {
      res = await net.fetch(pathToFileURL(file).toString());
    } catch {
      return new Response('Not found', { status: 404 });
    }
    if (!res.ok) return new Response('Not found', { status: 404 });
    return new Response(res.body, {
      status: 200,
      headers: {
        'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'cross-origin-opener-policy': 'same-origin',
        'cross-origin-embedder-policy': 'require-corp',
        'cross-origin-resource-policy': 'same-origin',
        'cache-control': 'no-cache',
      },
    });
  });
}

// ------------------------------------------------------------------ ventanas
const wins = { avatar: null, chat: null, settings: null, editor: null, 'vrm-editor': null };
let avatarSize = null; // tamaño deseado del avatar (para moverlo sin que cambie)
let tray = null;

const baseWebPrefs = { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false };

function createAvatarWindow() {
  const cfg = loadConfig();
  const wa = screen.getPrimaryDisplay().workArea;
  const w = 260;
  const h = 400;
  let { x, y } = cfg.ui.position || {};
  if (x == null || !screen.getAllDisplays().some((d) => pointIn(d.workArea, x + w / 2, y + h / 2))) {
    x = wa.x + wa.width - w - 24;
    y = wa.y + wa.height - h;
  }
  const win = new BrowserWindow({
    x,
    y,
    width: w,
    height: h,
    transparent: true,
    frame: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    skipTaskbar: true,
    // En Windows, «toolbar» la saca también de Alt+Tab (como un widget de escritorio).
    ...(isWin ? { type: 'toolbar' } : {}),
    alwaysOnTop: cfg.ui.alwaysOnTop,
    backgroundColor: '#00000000',
    title: 'Waifu Desk',
    show: false,
    webPreferences: { ...baseWebPrefs, backgroundThrottling: false },
  });
  if (cfg.ui.alwaysOnTop) win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
  if (!isLinux) win.setIgnoreMouseEvents(true, { forward: true });
  win.loadURL(pageUrl('avatar'));
  win.once('ready-to-show', () => win.showInactive());
  win.on('closed', () => {
    wins.avatar = null;
  });
  wins.avatar = win;
  return win;
}

const pointIn = (r, px, py) => px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height;

function positionChatNearAvatar() {
  const a = wins.avatar;
  const c = wins.chat;
  if (!a || !c || a.isDestroyed() || c.isDestroyed()) return;
  const ab = a.getBounds();
  const cb = c.getBounds();
  const wa = screen.getDisplayMatching(ab).workArea;
  const leftSide = ab.x + ab.width / 2 > wa.x + wa.width / 2;
  let x = leftSide ? ab.x - cb.width + 20 : ab.x + ab.width - 20;
  let y = ab.y + ab.height - cb.height - 10;
  x = Math.max(wa.x + 4, Math.min(x, wa.x + wa.width - cb.width - 4));
  y = Math.max(wa.y + 4, Math.min(y, wa.y + wa.height - cb.height - 4));
  c.setPosition(Math.round(x), Math.round(y));
}

function createChatWindow() {
  const cfg = loadConfig();
  const win = new BrowserWindow({
    width: 420,
    height: 600,
    minWidth: 340,
    minHeight: 380,
    frame: false,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: false,
    alwaysOnTop: cfg.ui.alwaysOnTop,
    backgroundColor: '#15121c',
    title: t('chat.windowTitle', { name: cfg.assistant.name }),
    show: false,
    webPreferences: baseWebPrefs,
  });
  if (cfg.ui.alwaysOnTop) win.setAlwaysOnTop(true, 'floating');
  win.loadURL(pageUrl('chat'));
  win.on('closed', () => {
    wins.chat = null;
  });
  wins.chat = win;
  positionChatNearAvatar();
  return win;
}

// fromAvatar: al hacer clic en la waifu el foco pasa a su ventana, así que se alterna por visibilidad.
function toggleChat(forceShow = false, fromAvatar = false) {
  let c = wins.chat;
  if (!c || c.isDestroyed()) {
    c = createChatWindow();
    c.once('ready-to-show', () => {
      positionChatNearAvatar();
      c.show();
      c.focus();
    });
    return;
  }
  if (c.isVisible() && (fromAvatar || c.isFocused()) && !forceShow) c.hide();
  else {
    positionChatNearAvatar();
    c.show();
    c.focus();
  }
}

function openWindow(name, opts = {}) {
  if (name === 'chat') return toggleChat(true);
  const existing = wins[name];
  if (existing && !existing.isDestroyed()) {
    existing.show();
    existing.focus();
    if (opts.query) existing.webContents.send('win:query', opts.query);
    return existing;
  }
  const sizes = { settings: [960, 720], editor: [1180, 800], 'vrm-editor': [1180, 820] };
  const [width, height] = sizes[name] || [900, 700];
  const win = new BrowserWindow({
    width,
    height,
    minWidth: 760,
    minHeight: 560,
    backgroundColor: '#15121c',
    autoHideMenuBar: true,
    title: name === 'settings' ? t('settings.windowTitle') : name === 'vrm-editor' ? t('vrmEditor.windowTitle') : t('editor.windowTitle'),
    icon: appIcon(),
    show: false,
    webPreferences: baseWebPrefs,
  });
  win.setMenuBarVisibility(false);
  const q = opts.query ? `?${new URLSearchParams(opts.query)}` : '';
  win.loadURL(pageUrl(name) + q);
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => {
    wins[name] = null;
  });
  wins[name] = win;
  return win;
}

function broadcast(channel, payload) {
  for (const w of Object.values(wins)) if (w && !w.isDestroyed()) w.webContents.send(channel, payload);
}
const sendTo = (name, channel, payload) => {
  const w = wins[name];
  if (w && !w.isDestroyed()) w.webContents.send(channel, payload);
};

// ------------------------------------------------------------------ icono / bandeja
let iconCache = null;
function appIcon() {
  if (iconCache) return iconCache;
  const p = path.join(APP_ROOT, 'assets', 'icon.png');
  iconCache = fs.existsSync(p) ? nativeImage.createFromPath(p) : nativeImage.createEmpty();
  return iconCache;
}

function buildTray() {
  const icon = appIcon().isEmpty() ? appIcon() : appIcon().resize({ width: isWin ? 16 : 22, height: isWin ? 16 : 22 });
  tray = new Tray(icon);
  tray.setToolTip('Waifu Desk');
  tray.on('click', () => toggleAvatar());
  refreshTrayMenu();
}

function refreshTrayMenu() {
  if (!tray) return;
  const cfg = loadConfig();
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: t('tray.toggle', { name: cfg.assistant.name }), click: toggleAvatar },
      { label: t('tray.openChat'), click: () => toggleChat(true) },
      { label: t('menu.talk'), click: () => sendTo('avatar', 'voice:record-toggle') },
      { type: 'separator' },
      { label: t('menu.language'), submenu: languageMenu(cfg) },
      { label: t('tray.skins'), click: () => openWindow('settings', { query: { tab: 'skins' } }) },
      { label: t('menu.settings'), click: () => openWindow('settings') },
      { type: 'separator' },
      { label: t('menu.quit'), click: () => app.quit() },
    ]),
  );
}

// Submenú para cambiar el idioma de la interfaz desde la bandeja o el avatar.
function languageMenu(cfg) {
  const cur = cfg.ui.language || 'auto';
  return ['auto', ...SUPPORTED].map((code) => ({
    label: code === 'auto' ? t('settings.general.languageAuto') : LANGUAGES[code].native,
    type: 'radio',
    checked: cur === code,
    click: () => {
      patchConfig({ ui: { language: code } });
      applyUiConfig();
      broadcast('cfg:changed', publicConfig());
    },
  }));
}

function toggleAvatar() {
  const a = wins.avatar;
  if (!a || a.isDestroyed()) return createAvatarWindow();
  if (a.isVisible()) {
    a.hide();
    wins.chat?.hide();
  } else a.showInactive();
}

function avatarContextMenu() {
  const cfg = loadConfig();
  const profiles = cfg.profiles.map((p) => ({
    label: `${p.name}${p.model ? ` · ${p.model}` : ''}`,
    type: 'radio',
    checked: p.id === cfg.activeProfileId,
    click: () => {
      patchConfig({ activeProfileId: p.id });
      broadcast('cfg:changed', publicConfig());
    },
  }));
  const scales = [0.6, 0.8, 1, 1.25, 1.5, 2].map((s) => ({
    label: `${Math.round(s * 100)} %`,
    type: 'radio',
    checked: Math.abs((cfg.ui.scale || 1) - s) < 0.01,
    click: () => {
      patchConfig({ ui: { scale: s } });
      broadcast('cfg:changed', publicConfig());
    },
  }));
  const skins = listSkins().map((s) => ({
    label: s.name,
    type: 'radio',
    checked: s.id === cfg.ui.skinId,
    click: () => useSkin(s.id),
  }));
  Menu.buildFromTemplate([
    { label: t('menu.chat'), accelerator: cfg.ui.hotkeyChat, click: () => toggleChat(true) },
    { label: t('menu.talk'), accelerator: cfg.ui.hotkeyTalk, click: () => sendTo('avatar', 'voice:record-toggle') },
    { label: t('menu.stop'), click: stopEverything },
    { type: 'separator' },
    { label: t('menu.model'), submenu: profiles },
    { label: t('menu.skin'), submenu: [...skins, { type: 'separator' }, { label: t('menu.importImage'), click: () => openWindow('editor') }, { label: t('menu.importVrm'), click: () => openWindow('vrm-editor') }] },
    { label: t('menu.size'), submenu: scales },
    { label: t('menu.language'), submenu: languageMenu(cfg) },
    {
      label: t('menu.alwaysOnTop'),
      type: 'checkbox',
      checked: cfg.ui.alwaysOnTop,
      click: (item) => {
        patchConfig({ ui: { alwaysOnTop: item.checked } });
        applyUiConfig();
      },
    },
    { type: 'separator' },
    { label: t('menu.newChat'), click: newConversation },
    { label: t('menu.settings'), click: () => openWindow('settings') },
    { label: t('menu.hide'), click: toggleAvatar },
    { label: t('menu.quit'), click: () => app.quit() },
  ]).popup({ window: wins.avatar });
}

function useSkin(id) {
  patchConfig({ ui: { skinId: id } });
  broadcast('skin:changed', getSkin(id));
  broadcast('cfg:changed', publicConfig());
}

// ------------------------------------------------------------------ configuración pública
function secretFlags(cfg) {
  const refs = ['stt', 'tts', 'hermes', 'paperclip', ...cfg.profiles.map((p) => `profile:${p.id}`)];
  for (const w of cfg.connectors.webhooks || []) refs.push(`webhook:${w.id}`);
  for (const s of cfg.connectors.mcpServers || []) refs.push(`mcp:${s.id}`);
  return Object.fromEntries(refs.map((r) => [r, hasSecret(r)]));
}

function publicConfig() {
  const cfg = loadConfig();
  return {
    config: cfg,
    locale: getLocale(),
    secrets: secretFlags(cfg),
    secureStorage: secureStorageAvailable(),
    presets: providerPresets(),
    platform: process.platform,
    version: app.getVersion(),
  };
}

// Aplica el idioma de la interfaz al proceso principal (menús, diálogos, avisos) y a los títulos.
let localeApplied = false;
function applyLocale(cfg = loadConfig()) {
  const prev = getLocale();
  setLocale(effectiveLocale(cfg));
  const next = getLocale();
  const userChange = localeApplied;
  localeApplied = true;
  if (prev === next) return;
  if (userChange) adaptDefaultsToLocale(cfg, prev, next);
  if (wins.settings && !wins.settings.isDestroyed()) wins.settings.setTitle(t('settings.windowTitle'));
  if (wins.editor && !wins.editor.isDestroyed()) wins.editor.setTitle(t('editor.windowTitle'));
  if (wins.chat && !wins.chat.isDestroyed()) wins.chat.setTitle(t('chat.windowTitle', { name: cfg.assistant.name }));
}

// Al cambiar de idioma, lo que sigue con el valor por defecto del idioma anterior pasa al nuevo:
// la personalidad (si no la has tocado) y el idioma del dictado.
function adaptDefaultsToLocale(cfg, prev, next) {
  const patch = {};
  if (cfg.assistant.personality === tIn(prev, 'defaults.personality')) patch.assistant = { personality: tIn(next, 'defaults.personality') };
  if (cfg.voice.stt.language === prev) patch.voice = { stt: { language: next } };
  if (Object.keys(patch).length) patchConfig(patch);
}

function applyUiConfig() {
  const cfg = loadConfig();
  applyLocale(cfg);
  for (const name of ['avatar', 'chat']) {
    const w = wins[name];
    if (w && !w.isDestroyed()) w.setAlwaysOnTop(cfg.ui.alwaysOnTop, 'floating');
  }
  registerShortcuts();
  if (!isLinux) app.setLoginItemSettings({ openAtLogin: !!cfg.ui.startWithSystem });
  refreshTrayMenu();
  startCursorFollow();
}

function registerShortcuts() {
  globalShortcut.unregisterAll();
  const cfg = loadConfig();
  const tryReg = (acc, fn) => {
    if (!acc) return;
    try {
      if (!globalShortcut.register(acc, fn)) logger.warn(`Atajo ocupado por otra app: ${acc}`);
    } catch (e) {
      logger.warn(`Atajo inválido ${acc}: ${e.message}`);
    }
  };
  tryReg(cfg.ui.hotkeyChat, () => toggleChat());
  tryReg(cfg.ui.hotkeyTalk, () => sendTo('avatar', 'voice:record-toggle'));
}

// Seguimiento del cursor para que gire un poco la cabeza.
let cursorTimer = null;
let lastCursor = '';
function startCursorFollow() {
  clearInterval(cursorTimer);
  if (!loadConfig().ui.followCursor) {
    sendTo('avatar', 'avatar:cursor', null);
    return;
  }
  cursorTimer = setInterval(() => {
    const a = wins.avatar;
    if (!a || a.isDestroyed() || !a.isVisible()) return;
    const p = screen.getCursorScreenPoint();
    const b = a.getBounds();
    const key = `${p.x},${p.y},${b.x},${b.y}`;
    if (key === lastCursor) return;
    lastCursor = key;
    a.webContents.send('avatar:cursor', { x: p.x - b.x, y: p.y - b.y });
  }, 60);
}

// ------------------------------------------------------------------ conversación
const historyPath = () => path.join(userDir(), 'conversation.json');
let history = [];
function loadHistory() {
  try {
    history = JSON.parse(fs.readFileSync(historyPath(), 'utf8')).messages || [];
  } catch {
    history = [];
  }
}
function saveHistory() {
  try {
    fs.writeFileSync(historyPath(), JSON.stringify({ messages: history.slice(-400) }, null, 1));
  } catch (e) {
    logger.error("No se pudo guardar el historial", e);
  }
}

let current = null; // { ctrl, done }
// Cada evento del chat lleva un número de secuencia: si la ventana del chat se abre a mitad
// de una respuesta, pide una instantánea y descarta los eventos que ya incluye.
let chatSeq = 0;
let partialText = ''; // texto del paso que se está generando (aún no está en el historial)
const chatListeners = new Set(); // solo para tools/automation
function chatEvent(e) {
  e.seq = ++chatSeq;
  broadcast('chat:event', e);
  for (const fn of chatListeners) fn(e);
}
const pendingChatEvents = []; // avisos para cuando se abra el chat
let ttsGen = 0;
let ttsChain = Promise.resolve();
let assistantState = 'idle';

function setState(state, label = '') {
  assistantState = state;
  broadcast('avatar:state', { state, label });
}

function stopEverything() {
  current?.ctrl.abort();
  ttsGen++;
  ttsChain = Promise.resolve();
  sendTo('avatar', 'tts:stop');
  setState('idle');
}

function newConversation() {
  stopEverything();
  history = [];
  saveHistory();
  chatEvent({ type: 'reset' });
}

// Idioma en el que habla: el de «Idioma de respuesta» si se reconoce, si no el de la interfaz.
const speechLang = (cfg) => localeTag(languageFromName(cfg.assistant.language) || getLocale());

function enqueueSpeech(sentence) {
  const cfg = loadConfig();
  const text = speakable(sentence);
  if (!text || cfg.voice.tts.mode === 'off') return;
  const gen = ttsGen;
  const id = uid();
  if (cfg.voice.tts.mode === 'system') {
    ttsChain = ttsChain.then(() => {
      if (gen === ttsGen) sendTo('avatar', 'tts:say', { id, text, voice: cfg.voice.tts.systemVoice, rate: cfg.voice.tts.rate, pitch: cfg.voice.tts.pitch, lang: speechLang(cfg) });
    });
    return;
  }
  const audioP = synthesize(cfg, text).catch((e) => {
    chatEvent({ type: 'notice', level: 'warn', message: t('errors.voice', { message: e.message }) });
    return null;
  });
  ttsChain = ttsChain.then(async () => {
    const audio = await audioP;
    if (audio && gen === ttsGen) sendTo('avatar', 'tts:play', { id, audio });
  });
}

async function sendMessage(text, via = 'text') {
  text = String(text || '').trim();
  if (!text) return;
  if (current) {
    current.ctrl.abort();
    await current.done.catch(() => {});
  }
  ttsGen++;
  ttsChain = Promise.resolve();
  sendTo('avatar', 'tts:stop');

  const cfg = loadConfig();
  const profile = cfg.profiles.find((p) => p.id === cfg.activeProfileId) || cfg.profiles[0];
  const userMsg = { role: 'user', content: text, via, ts: Date.now() };
  history.push(userMsg);
  chatEvent({ type: 'user', message: userMsg });

  const apiKey = getSecret(`profile:${profile.id}`);
  if (!profile?.model || (profile.kind === 'anthropic' && !apiKey)) {
    const msg = !profile?.model ? t('errors.noModel', { name: profile?.name }) : t('errors.noApiKey', { name: profile.name });
    chatEvent({ type: 'error', message: msg });
    setState('error', t('state.missingConfig'));
    setTimeout(() => assistantState === 'error' && setState('idle'), 4000);
    return;
  }

  const speak = cfg.voice.speakReplies === 'always' || (cfg.voice.speakReplies === 'voice' && via === 'voice');
  const chunker = speak ? new SentenceChunker(enqueueSpeech) : null;
  const ctrl = new AbortController();
  const toolbox = buildToolbox(cfg, () => wins.chat || wins.avatar);
  setState('thinking');
  chatEvent({ type: 'assistant_start', profile: { name: profile.name, model: profile.model } });

  partialText = '';
  const emit = (e) => {
    if (ctrl.signal.aborted) return;
    if (e.type === 'step_end') {
      partialText = '';
      return;
    }
    if (e.type === 'emotion') {
      sendTo('avatar', 'avatar:emotion', e.name);
      return;
    }
    if (e.type === 'text') partialText += e.delta;
    chatEvent(e);
    if (e.type === 'text') {
      chunker?.push(e.delta);
      if (assistantState !== 'talking') setState('talking');
    } else if (e.type === 'tool_start') setState('working', prettyTool(e.name));
    else if (e.type === 'tool_progress') setState('working', e.message);
    else if (e.type === 'tool_end') setState('thinking');
  };

  const done = (async () => {
    try {
      await runTurn({ cfg, profile, apiKey, history, toolbox, emit, signal: ctrl.signal });
      chunker?.flush();
      chatEvent({ type: 'done' });
      setState('idle');
    } catch (e) {
      const aborted = ctrl.signal.aborted || e.name === 'AbortError';
      if (!aborted) logger.error('turno', e);
      chatEvent(aborted ? { type: 'done', aborted: true } : { type: 'error', message: e.message || String(e) });
      if (!aborted) {
        setState('error', t('state.failed'));
        setTimeout(() => assistantState === 'error' && setState('idle'), 4000);
      }
    } finally {
      saveHistory();
      if (current?.ctrl === ctrl) current = null;
    }
  })();
  current = { ctrl, done };
}

function prettyTool(name) {
  if (name.startsWith('paperclip_')) return t('state.tool.paperclip');
  if (name.startsWith('hermes_')) return t('state.tool.hermes');
  if (name.startsWith('webhook_')) return t('state.tool.webhook');
  if (name.startsWith('mcp_')) return t('state.tool.mcp');
  if (name === 'run_command') return t('state.tool.command');
  return t('state.tool.other');
}

// ------------------------------------------------------------------ IPC
function registerIpc() {
  ipcMain.handle('cfg:get', () => publicConfig());
  ipcMain.handle('cfg:patch', async (_e, patch) => {
    patchConfig(patch);
    applyUiConfig();
    broadcast('cfg:changed', publicConfig());
    if (patch?.connectors?.mcpServers) await syncMcp(loadConfig());
    return publicConfig();
  });
  ipcMain.handle('cfg:replace', (_e, cfg) => {
    saveConfig(cfg);
    applyUiConfig();
    broadcast('cfg:changed', publicConfig());
    return publicConfig();
  });
  ipcMain.handle('cfg:set-secret', (_e, ref, value) => {
    setSecret(ref, value);
    broadcast('cfg:changed', publicConfig());
    return true;
  });
  ipcMain.handle('cfg:new-id', () => uid());

  ipcMain.handle('models:list', async (_e, profile) => {
    const key = getSecret(`profile:${profile.id}`);
    return profile.kind === 'anthropic' ? listAnthropicModels(profile, key) : listOpenAIModels(profile, key);
  });
  ipcMain.handle('test:hermes', () => testHermes(loadConfig().connectors.hermes));
  ipcMain.handle('test:paperclip', () => testPaperclip(loadConfig().connectors.paperclip));
  ipcMain.handle('mcp:sync', async () => {
    await syncMcp(loadConfig());
    return mcpStatus();
  });
  ipcMain.handle('mcp:status', () => mcpStatus());
  ipcMain.handle('tools:list', () => buildToolbox(loadConfig()).list.map((tool) => ({ name: tool.name, group: tool.group, description: tool.description })));

  ipcMain.handle('chat:history', () => ({ messages: history, seq: chatSeq, busy: !!current, partialText: current ? partialText : '' }));
  ipcMain.handle('chat:pending', () => pendingChatEvents.splice(0));
  ipcMain.handle('chat:send', (_e, text, via) => sendMessage(text, via));
  ipcMain.handle('chat:stop', () => stopEverything());
  ipcMain.handle('chat:new', () => newConversation());
  ipcMain.handle('chat:state', () => assistantState);

  ipcMain.handle('voice:transcribe', async (_e, bytes, mime) => {
    setState('thinking', t('state.transcribing'));
    try {
      const text = await transcribe(loadConfig(), bytes, mime);
      if (!text) {
        setState('idle');
        chatEvent({ type: 'notice', level: 'info', message: t('chat.heardNothing') });
        return '';
      }
      if (!wins.chat || !wins.chat.isVisible()) toggleChat(true);
      sendMessage(text, 'voice');
      return text;
    } catch (e) {
      logger.error('dictado', e);
      setState('error', t('state.dictationFailed'));
      const evt = { type: 'error', message: t('errors.dictation', { message: e.message }) };
      if (!wins.chat || wins.chat.isDestroyed() || !wins.chat.isVisible()) {
        pendingChatEvents.push(evt);
        toggleChat(true);
      } else chatEvent(evt);
      setTimeout(() => assistantState === 'error' && setState('idle'), 4000);
      return '';
    }
  });
  ipcMain.on('voice:toggle', () => sendTo('avatar', 'voice:record-toggle'));
  ipcMain.on('voice:status', (_e, st) => {
    broadcast('voice:status', st);
    if (st.recording) {
      stopSpeechOnly();
      setState('listening');
    } else if (assistantState === 'listening') setState('idle');
  });
  ipcMain.handle('voice:test-tts', (_e, text) => {
    ttsGen++;
    ttsChain = Promise.resolve();
    enqueueSpeech(text || t('voice.testDefault'));
  });

  ipcMain.handle('skin:get', (_e, id) => getSkin(id || loadConfig().ui.skinId));
  ipcMain.handle('skin:list', () => listSkins());
  ipcMain.handle('skin:save', (_e, payload) => {
    const m = saveSkin(payload);
    broadcast('skin:list-changed', listSkins());
    return m;
  });
  ipcMain.handle('skin:delete', (_e, id) => {
    deleteSkin(id);
    if (loadConfig().ui.skinId === id) useSkin('default');
    broadcast('skin:list-changed', listSkins());
    return true;
  });
  ipcMain.handle('skin:use', (_e, id) => useSkin(id));
  ipcMain.handle('skin:fetch-image', (_e, url) => fetchImage(url));
  ipcMain.handle('skin:open-image', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    const r = await dialog.showOpenDialog(win, {
      title: t('editor.pickImage'),
      filters: [{ name: t('editor.images'), extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }],
      properties: ['openFile'],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    const p = r.filePaths[0];
    const ext = path.extname(p).slice(1).toLowerCase().replace('jpg', 'jpeg');
    return { name: path.basename(p, path.extname(p)), dataUrl: `data:image/${ext};base64,${fs.readFileSync(p).toString('base64')}` };
  });
  ipcMain.handle('skin:open-vrm', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    const r = await dialog.showOpenDialog(win, { title: t('vrmEditor.pickVrm'), filters: [{ name: t('vrmEditor.vrmFiles'), extensions: ['vrm'] }], properties: ['openFile'] });
    if (r.canceled || !r.filePaths[0]) return null;
    return stageVrm(r.filePaths[0], path.basename(r.filePaths[0], path.extname(r.filePaths[0])));
  });
  ipcMain.handle('skin:fetch-vrm', (_e, url) => downloadVrm(url));
  ipcMain.handle('skin:save-vrm', (_e, payload) => {
    const m = saveVrmSkin(payload);
    broadcast('skin:list-changed', listSkins());
    if (loadConfig().ui.skinId === m.id) broadcast('skin:changed', m);
    return m;
  });
  ipcMain.handle('skin:model-status', () => segmentModelStatus());
  ipcMain.handle('skin:model-download', async (e) => {
    const sender = e.sender;
    return downloadSegmentModel((p) => !sender.isDestroyed() && sender.send('skin:model-progress', p));
  });

  ipcMain.handle('win:open', (_e, name, query) => {
    openWindow(name, { query });
  });
  ipcMain.on('win:close-self', (e) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (w === wins.chat) w.hide();
    else w?.close();
  });
  ipcMain.handle('app:open-external', (_e, url) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
  });
  ipcMain.handle('app:open-userdata', () => shell.openPath(userDir()));
  ipcMain.handle('app:open-log', () => logger.logPath() && shell.openPath(logger.logPath()));

  // --- avatar
  ipcMain.on('avatar:resize', (_e, { width, height }) => {
    const a = wins.avatar;
    if (!a) return;
    avatarSize = { width: Math.round(width), height: Math.round(height) };
    const b = a.getBounds();
    const w = Math.round(width);
    const h = Math.round(height);
    if (w === b.width && h === b.height) return;
    // ancla abajo-centro
    const nx = Math.round(b.x + b.width / 2 - w / 2);
    const ny = Math.round(b.y + b.height - h);
    a.setBounds({ x: nx, y: ny, width: w, height: h });
    positionChatNearAvatar();
  });
  ipcMain.handle('avatar:bounds', () => wins.avatar?.getBounds());
  ipcMain.on('avatar:move', (_e, { x, y }) => {
    const a = wins.avatar;
    if (!a) return;
    // setBounds con tamaño fijo: con escalado de pantalla ≠ 100 % en Windows, setPosition
    // puede hacer que una ventana transparente crezca un píxel en cada movimiento.
    const { width, height } = a.getContentBounds();
    a.setBounds({ x: Math.round(x), y: Math.round(y), width: avatarSize?.width || width, height: avatarSize?.height || height });
    if (wins.chat?.isVisible()) positionChatNearAvatar();
  });
  ipcMain.on('avatar:move-end', () => {
    const b = wins.avatar?.getBounds();
    if (b) patchConfig({ ui: { position: { x: b.x, y: b.y } } });
  });
  ipcMain.on('avatar:ignore-mouse', (_e, ignore) => {
    const a = wins.avatar;
    if (!a || isLinux) return;
    a.setIgnoreMouseEvents(!!ignore, { forward: true });
  });
  ipcMain.on('avatar:shape', (_e, rects) => {
    // En Linux no existe el reenvío de ratón: se recorta la ventana a la silueta.
    if (isLinux && wins.avatar && Array.isArray(rects) && rects.length) wins.avatar.setShape(rects);
  });
  ipcMain.on('avatar:click', () => toggleChat(false, true));
  ipcMain.on('avatar:context-menu', () => avatarContextMenu());
}

function stopSpeechOnly() {
  ttsGen++;
  ttsChain = Promise.resolve();
  sendTo('avatar', 'tts:stop');
}

// ------------------------------------------------------------------ arranque
app.on('web-contents-created', (_e, wc) => {
  wc.on('console-message', (ev) => {
    if (ev.level === 'error' || ev.level === 'warning') logger.log(ev.level === 'error' ? 'error' : 'warn', `[${(ev.sourceId || '').split('/').pop()}:${ev.lineNumber}] ${ev.message}`);
  });
  wc.on('render-process-gone', (_ev, d) => logger.error('renderer caído', d));
  wc.on('preload-error', (_ev, p, err) => logger.error('preload', p, err));
  wc.on('did-fail-load', (_ev, code, desc, url) => logger.error('no carga', code, desc, url));
});

app.on('second-instance', () => {
  wins.avatar?.showInactive();
  toggleChat(true);
});

app.whenReady().then(async () => {
  logger.info(`arranque v${app.getVersion()} · ${process.platform} ${process.arch} · Electron ${process.versions.electron} · datos: ${userDir()}`);
  const step = (name, fn) => {
    logger.info(`→ ${name}`);
    try {
      return fn();
    } catch (e) {
      logger.error(`fallo en «${name}»`, e);
      return null;
    }
  };
  step('idioma', () => applyLocale());
  step('protocolo', registerAppProtocol);
  // Micrófono permitido solo para nuestras páginas internas.
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb, details) => {
    const internal = (details?.requestingUrl || wc.getURL()).startsWith('app://local/');
    cb(internal && ['media', 'clipboard-sanitized-write', 'clipboard-read', 'notifications'].includes(permission));
  });
  session.defaultSession.setPermissionCheckHandler((wc, permission, origin) => origin?.startsWith('app://local') && permission === 'media');
  const firstRun = !fs.existsSync(path.join(userDir(), 'config.json'));
  if (firstRun) step('config inicial', () => patchConfig({}));
  step('historial', loadHistory);
  step('temporales 3D', clearVrmTmp);
  step('ipc', registerIpc);
  step('avatar', createAvatarWindow);
  step('bandeja', buildTray);
  step('ajustes de ventana', applyUiConfig);
  syncMcp(loadConfig()).catch((e) => logger.error('MCP', e));
  if (firstRun && !AUTOMATION) setTimeout(() => openWindow('settings', { query: { tab: 'models', welcome: '1' } }), 1200);
  logger.info('listo');
  if (AUTOMATION) runAutomation(AUTOMATION);
});

// Pruebas de humo y capturas del README (tools/automation/*.mjs). Nunca en la app empaquetada.
function runAutomation(file) {
  const api = {
    app,
    wins,
    logger,
    userDir,
    openWindow,
    toggleChat,
    sendMessage,
    newConversation,
    stopEverything,
    setState,
    useSkin,
    broadcast,
    publicConfig,
    loadConfig,
    patchConfig,
    setSecret,
    applyUiConfig,
    refreshTrayMenu,
    onChatEvent: (fn) => chatListeners.add(fn),
  };
  import(pathToFileURL(path.resolve(file)).href)
    .then((m) => m.default(api))
    .catch((e) => {
      logger.error('automatización', e);
      app.exit(1);
    });
}

app.on('window-all-closed', (e) => e.preventDefault?.());
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  closeAllMcp();
});
