// Genera las capturas del README en docs/screenshots/ con la app real y el servidor simulado.
// Uso (en Linux sin pantalla):
//   xvfb-run -a -s "-screen 0 3840x2400x24" npm run screenshots
import fs from 'node:fs';
import path from 'node:path';
import { BrowserWindow } from 'electron';
import { SUPPORTED, tIn } from '../../src/shared/i18n/index.js';
import { startMockServer, mockConfigPatch } from './mock-server.mjs';
import { sleep, waitForWindow, waitForChat, setLanguage } from './common.mjs';
import { live2dFixtures } from './live2d-check.mjs';

// Cierra una ventana y espera a que desaparezca (si no, openWindow podría reutilizarla a medio cerrar).
const closed = (win) => new Promise((resolve) => (win.isDestroyed() ? resolve() : (win.once('closed', resolve), win.close())));

const OUT = path.resolve(import.meta.dirname, '..', '..', 'docs', 'screenshots');

// Mensajes de ejemplo en cada idioma (las palabras clave activan las respuestas del simulador).
const PROMPTS = {
  es: { paperclip: 'Crea una tarea en Paperclip para el CTO: migrar Postgres a la 17, prioridad alta, y despiértalo.', hermes: 'Pídele a Hermes que revise los contenedores del VPS' },
  en: { paperclip: 'Create a Paperclip task for the CTO: migrate Postgres to 17, high priority, and wake them up.', hermes: 'Ask Hermes to check the containers on the VPS' },
  ru: { paperclip: 'Создай задачу в Paperclip для CTO: перевести Postgres на 17, высокий приоритет, и разбуди его.', hermes: 'Попроси Hermes проверить контейнеры на VPS' },
  uk: { paperclip: 'Створи задачу в Paperclip для CTO: перевести Postgres на 17, високий пріоритет, і розбуди його.', hermes: 'Попроси Hermes перевірити контейнери на VPS' },
  zh: { paperclip: '在 Paperclip 里给 CTO 建个任务：把 Postgres 升级到 17，高优先级，然后唤醒它。', hermes: '让 Hermes 检查一下 VPS 上的容器' },
};

const png = async (win) => (await win.webContents.capturePage()).toPNG();
const dataUrl = (buf) => `data:image/png;base64,${buf.toString('base64')}`;
const save = (name, buf) => fs.writeFileSync(path.join(OUT, name), buf);

// Monta una imagen en un <canvas> (sin límite de tamaño de ventana y a resolución completa).
// Por defecto en JPEG: los degradados del fondo pesan mucho en PNG.
// layers: { wallpaper: true } | { img, x, y, w, h, radius, shadow } | { rect, x, y, w, h, radius, fill }
//         | { text, x, y, font, fill, align }
async function compose(width, height, layers, type = 'image/jpeg') {
  const w = new BrowserWindow({ width: 200, height: 200, show: false, webPreferences: { offscreen: true } });
  await w.loadURL('data:text/html,<body></body>');
  const prepared = layers.map((l) => (l.img ? { ...l, img: dataUrl(l.img) } : l));
  const out = await w.webContents.executeJavaScript(`(async () => {
    const W = ${width}, H = ${height};
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r || 0); };
    for (const l of ${JSON.stringify(prepared)}) {
      ctx.save();
      if (l.wallpaper) {
        const g = ctx.createLinearGradient(0, 0, W * 0.6, H);
        g.addColorStop(0, '#141026'); g.addColorStop(0.45, '#1c1438'); g.addColorStop(1, '#26123a');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        for (const [x, y, r, col] of [[0.78, 1.08, 0.62, 'rgba(255,79,154,0.36)'], [0.08, -0.1, 0.5, 'rgba(120,110,255,0.38)'], [0.45, 0.4, 0.4, 'rgba(60,200,255,0.09)']]) {
          const rg = ctx.createRadialGradient(x * W, y * H, 0, x * W, y * H, r * Math.max(W, H));
          rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
        }
      } else if (l.img) {
        const im = new Image(); im.src = l.img; await im.decode();
        const w = l.w ?? im.naturalWidth, h = l.h ?? im.naturalHeight;
        if (l.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = l.shadow; ctx.shadowOffsetY = l.shadow / 3; rr(l.x, l.y, w, h, l.radius); ctx.fillStyle = '#15121c'; ctx.fill(); ctx.shadowColor = 'transparent'; }
        if (l.radius) { rr(l.x, l.y, w, h, l.radius); ctx.clip(); }
        ctx.drawImage(im, l.x, l.y, w, h);
      } else if (l.rect) {
        rr(l.x, l.y, l.w, l.h, l.radius); ctx.fillStyle = l.fill; ctx.fill();
      } else if (l.text) {
        ctx.font = l.font; ctx.fillStyle = l.fill; ctx.textAlign = l.align || 'left'; ctx.fillText(l.text, l.x, l.y);
      }
      ctx.restore();
    }
    return c.toDataURL(${JSON.stringify(type)}, 0.9);
  })()`);
  w.destroy();
  return Buffer.from(out.split(',')[1], 'base64');
}

async function conversation(api, text) {
  const done = waitForChat(api, (e) => e.type === 'done' || e.type === 'error', 30000);
  await api.sendMessage(text);
  const end = await done;
  if (end.type === 'error') throw new Error(end.message);
  await sleep(500);
}

export default async function screenshots(api) {
  fs.mkdirSync(OUT, { recursive: true });
  const mock = await startMockServer();
  api.patchConfig(mockConfigPatch(mock.base));
  api.patchConfig({ ui: { alwaysOnTop: false }, voice: { stt: { language: 'es' } } });
  api.applyUiConfig();
  api.broadcast('cfg:changed', api.publicConfig());
  const avatar = api.wins.avatar;
  await waitForWindow(avatar, 'window.__wd?.renderer?.skin');
  const dpr = await avatar.webContents.executeJavaScript('devicePixelRatio');
  const px = (n) => Math.round(n * dpr);
  const written = [];
  const shot = (name, buf) => {
    save(name, buf);
    written.push(name);
  };

  // ------------------------------------------------ 1. escritorio: avatar + chat con Paperclip y Hermes
  await setLanguage(api, 'es');
  api.toggleChat(true);
  await sleep(500);
  const chat = api.wins.chat;
  await waitForWindow(chat, 'document.querySelector("#hint").textContent.length > 0');
  chat.setSize(440, 700);
  api.newConversation();
  await conversation(api, PROMPTS.es.paperclip);
  await conversation(api, PROMPTS.es.hermes);
  await chat.webContents.executeJavaScript('document.activeElement?.blur(); const l = document.getElementById("log"); l.scrollTop = l.scrollHeight;');
  api.setState('talking');
  await avatar.webContents.executeJavaScript('window.__wd.behaviour.fakeTalkUntil = performance.now() + 60000; window.__wd.behaviour.cursor = { x: 30, y: 80 };');
  await sleep(800);
  const avatarPng = await png(avatar);
  const chatPng = await png(chat);
  await avatar.webContents.executeJavaScript('window.__wd.behaviour.fakeTalkUntil = 0');
  api.setState('idle');
  const a = imageSize(avatarPng);
  const c = imageSize(chatPng);
  {
    const W = px(1400);
    const H = px(860);
    const bar = px(48);
    const icons = ['Proyectos', 'VPS', 'Notas'].flatMap((name, i) => [
      { rect: true, x: px(40), y: px(30 + i * 92), w: px(46), h: px(38), radius: px(9), fill: '#f0b54b' },
      { text: name, x: px(63), y: px(30 + i * 92 + 58), font: `${px(12)}px "Segoe UI", system-ui, sans-serif`, fill: '#d9d3ea', align: 'center' },
    ]);
    shot(
      'desktop.jpg',
      await compose(W, H, [
        { wallpaper: true },
        ...icons,
        { img: chatPng, x: W - a.width - c.width - px(16), y: H - bar - c.height - px(18), radius: px(12), shadow: px(40) },
        { img: avatarPng, x: W - a.width - px(24), y: H - bar - a.height },
        { rect: true, x: 0, y: H - bar, w: W, h: bar, fill: 'rgba(18,14,30,0.85)' },
      ]),
    );
  }

  // ------------------------------------------------ 2. estados del avatar
  const states = [
    ['idle', ''],
    ['listening', ''],
    ['thinking', ''],
    ['working', 'Paperclip…'],
    ['talking', ''],
  ];
  const statePngs = [];
  for (const [st, label] of states) {
    api.setState(st, label);
    if (st === 'listening') await avatar.webContents.executeJavaScript(`(() => { const m = document.getElementById('mic'); m.classList.remove('hidden'); m.style.setProperty('--lvl', '0.6'); })()`);
    else await avatar.webContents.executeJavaScript(`document.getElementById('mic').classList.add('hidden')`);
    if (st === 'talking') await avatar.webContents.executeJavaScript('window.__wd.behaviour.fakeTalkUntil = performance.now() + 60000');
    await sleep(st === 'talking' ? 900 : 600);
    statePngs.push(await png(avatar));
    await avatar.webContents.executeJavaScript('window.__wd.behaviour.fakeTalkUntil = 0');
  }
  api.setState('idle');
  await avatar.webContents.executeJavaScript(`document.getElementById('mic').classList.add('hidden')`);
  {
    const pad = px(20);
    const W = a.width * states.length + pad * 2;
    const H = a.height + px(40);
    shot(
      'states.jpg',
      await compose(W, H, [
        { wallpaper: true },
        ...statePngs.map((b, i) => ({ img: b, x: pad + i * a.width, y: px(4) })),
        ...states.map(([st], i) => ({ text: st, x: pad + i * a.width + a.width / 2, y: H - px(12), font: `600 ${px(12)}px ui-monospace, monospace`, fill: '#b7aecb', align: 'center' })),
      ]),
    );
  }

  // ------------------------------------------------ 2b. skin 3D (VRM): estados, caras y editor
  api.useSkin('noa-3d');
  await waitForWindow(avatar, "window.__wd.renderer?.kind === 'vrm' && !!window.__wd.renderer.skin", 60000);
  await sleep(2500);
  const shots3d = [
    ['idle', '', ''],
    ['thinking', '', ''],
    ['working', 'Paperclip…', ''],
    ['talking', '', ''],
    ['idle', '', 'happy'],
    ['idle', '', 'surprised'],
  ];
  const pngs3d = [];
  for (const [st, label, emo] of shots3d) {
    api.setState(st, label);
    if (st === 'talking') await avatar.webContents.executeJavaScript('window.__wd.behaviour.fakeTalkUntil = performance.now() + 60000');
    if (emo) await avatar.webContents.executeJavaScript(`window.__wd.behaviour.setEmotion('${emo}', performance.now())`);
    // Sin GPU (Xvfb) el 3D va a pocos fotogramas por segundo: hay que darle tiempo al fundido.
    await sleep(emo ? 2500 : 5000);
    pngs3d.push(await png(avatar));
    await avatar.webContents.executeJavaScript("window.__wd.behaviour.fakeTalkUntil = 0; window.__wd.behaviour.setEmotion('neutral', performance.now())");
    await sleep(1500);
  }
  api.setState('idle');
  {
    const a3 = imageSize(pngs3d[0]);
    const pad = px(20);
    const W = a3.width * shots3d.length + pad * 2;
    const H = a3.height + px(40);
    shot(
      'states-3d.jpg',
      await compose(W, H, [
        { wallpaper: true },
        ...pngs3d.map((b, i) => ({ img: b, x: pad + i * a3.width, y: px(4) })),
        ...shots3d.map(([st, , emo], i) => ({ text: emo || st, x: pad + i * a3.width + a3.width / 2, y: H - px(12), font: `600 ${px(12)}px ui-monospace, monospace`, fill: '#b7aecb', align: 'center' })),
      ]),
    );
  }
  const vrmEditor = api.openWindow('vrm-editor', { query: { id: 'noa-3d' } });
  vrmEditor.setSize(1180, 820);
  await waitForWindow(vrmEditor, '!!window.__wdVrmEditor?.renderer?.vrm && document.querySelectorAll("#license dt").length >= 4', 60000);
  await vrmEditor.webContents.executeJavaScript(`document.querySelector('[data-state="thinking"]').click()`);
  vrmEditor.show();
  vrmEditor.focus();
  await sleep(6000);
  shot('vrm-editor.png', await png(vrmEditor));
  await closed(vrmEditor);

  // ------------------------------------------------ 2c. VTuber (Live2D) con el modelo de muestra Hiyori, si hay fixtures
  const l2d = live2dFixtures(process.env.WAIFU_TEST_LIVE2D_DIR);
  if (l2d) {
    api.live2d.importCore(l2d.core);
    const staged = api.live2d.stageLive2d(l2d.model);
    // Como el usuario: por el editor (así la skin lleva su miniatura).
    const l2new = api.openWindow('vrm-editor', { query: { kind: 'live2d' } });
    await waitForWindow(l2new, '!!window.__wdVrmEditor && document.body.classList.contains("mode-live2d")', 20000);
    await l2new.webContents.executeJavaScript(`window.__wdVrmEditor.fromStagedLive2d(${JSON.stringify(staged)})`);
    await waitForWindow(l2new, "window.__wdVrmEditor.renderer?.kind === 'live2d' && !!window.__wdVrmEditor.renderer.skin", 60000);
    await sleep(1500);
    await l2new.webContents.executeJavaScript(`document.querySelector('[data-preset="half"]').click(); document.getElementById('btnSave').click()`);
    await waitForWindow(l2new, 'document.getElementById("saveStatus").classList.contains("ok")', 30000);
    await closed(l2new);
    const l2skin = { id: api.loadConfig().ui.skinId };
    await waitForWindow(avatar, "window.__wd.renderer?.kind === 'live2d' && !!window.__wd.renderer.skin", 60000);
    await sleep(3000);
    const shotsL2d = [
      ['idle', '', '', null],
      ['thinking', '', '', null],
      ['talking', '', '', null],
      ['idle', '', 'happy', null],
      ['idle', '', '', { x: -2000, y: 120 }],
    ];
    const pngsL2d = [];
    for (const [st, label, emo, cursor] of shotsL2d) {
      api.setState(st, label);
      if (st === 'talking') await avatar.webContents.executeJavaScript('window.__wd.behaviour.fakeTalkUntil = performance.now() + 60000');
      if (emo) await avatar.webContents.executeJavaScript(`window.__wd.behaviour.setEmotion('${emo}', performance.now())`);
      await avatar.webContents.executeJavaScript(`window.__wd.behaviour.cursor = ${JSON.stringify(cursor)}`);
      await sleep(3500);
      pngsL2d.push(await png(avatar));
      await avatar.webContents.executeJavaScript("window.__wd.behaviour.fakeTalkUntil = 0; window.__wd.behaviour.setEmotion('neutral', performance.now()); window.__wd.behaviour.cursor = null");
      await sleep(1200);
    }
    api.setState('idle');
    const al = imageSize(pngsL2d[0]);
    const pad = px(20);
    const W = al.width * shotsL2d.length + pad * 2;
    const H = al.height + px(40);
    const labels = ['idle', 'thinking', 'talking', 'happy', 'look'];
    shot(
      'states-live2d.jpg',
      await compose(W, H, [
        { wallpaper: true },
        ...pngsL2d.map((b, i) => ({ img: b, x: pad + i * al.width, y: px(4) })),
        ...labels.map((l, i) => ({ text: l, x: pad + i * al.width + al.width / 2, y: H - px(12), font: `600 ${px(12)}px ui-monospace, monospace`, fill: '#b7aecb', align: 'center' })),
      ]),
    );
    const l2ed = api.openWindow('vrm-editor', { query: { id: l2skin.id } });
    l2ed.setSize(1180, 820);
    await waitForWindow(l2ed, "window.__wdVrmEditor?.renderer?.kind === 'live2d' && !!window.__wdVrmEditor.renderer.skin", 60000);
    await l2ed.webContents.executeJavaScript(`document.getElementById('paramBox').open = true`);
    l2ed.show();
    l2ed.focus();
    await sleep(5000);
    shot('live2d-editor.png', await png(l2ed));
    await closed(l2ed);
  } else api.logger.warn('capturas: Live2D omitido (WAIFU_TEST_LIVE2D_DIR)');

  api.useSkin('default');
  await waitForWindow(avatar, "window.__wd.renderer?.kind === '2d' && !!window.__wd.renderer.skin", 30000);

  // ------------------------------------------------ 2d. un recordatorio: bocadillo + aviso en el chat
  api.patchConfig({ productivity: { notify: 'silent' } });
  api.newConversation();
  await sleep(300);
  api.announce({ kind: 'reminder', text: tIn('es', 'reminders.fire', { text: 'Llamar a Ana por lo del viaje (sale a las 19:30)' }) });
  await sleep(900);
  {
    const avatarR = await png(avatar);
    const chatR = await png(chat);
    const ar = imageSize(avatarR);
    const cr = imageSize(chatR);
    const W = px(1040);
    const H = px(760);
    shot(
      'reminder.jpg',
      await compose(W, H, [
        { wallpaper: true },
        { img: chatR, x: W - ar.width - cr.width - px(48), y: H - cr.height - px(30), radius: px(12), shadow: px(40) },
        { img: avatarR, x: W - ar.width - px(24), y: H - ar.height - px(10) },
      ]),
    );
  }

  // ------------------------------------------------ 3. ajustes (con valores de ejemplo en vez de los del simulador)
  const realistic = mockConfigPatch(mock.base);
  realistic.profiles[0] = { ...realistic.profiles[0], kind: 'anthropic', baseUrl: 'https://api.anthropic.com' };
  realistic.profiles[1] = { ...realistic.profiles[1], baseUrl: 'https://hermes.example.com/v1' };
  realistic.connectors.hermes = { ...realistic.connectors.hermes, baseUrl: 'https://hermes.example.com/v1', timeoutSec: 900 };
  realistic.connectors.paperclip = { ...realistic.connectors.paperclip, baseUrl: 'http://localhost:3100', companyId: '3f6c2a9e-8d41-4b7a-9c35-1e2f7a6b0d54' };
  realistic.voice = { stt: { provider: 'groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'whisper-large-v3-turbo', language: 'es' }, tts: { mode: 'system' } };
  api.patchConfig(realistic);
  for (const ref of ['profile:mock', 'hermes', 'stt']) api.setSecret(ref, 'example-secret');
  api.broadcast('cfg:changed', api.publicConfig());
  const settings = api.openWindow('settings');
  await waitForWindow(settings, 'document.querySelector("#view h1")');
  settings.setSize(1000, 760);
  // La ventana tiene que estar delante: Chromium no repinta las ventanas tapadas.
  const settingsShot = async (tab, name, wait = 300) => {
    settings.show();
    settings.focus();
    // El aviso de «sin almacén seguro» solo sale aquí porque Xvfb no tiene llavero; en Windows no aparece.
    await settings.webContents.executeJavaScript(
      `document.querySelector('[data-tab="${tab}"]').click(); document.getElementById('view').scrollTop = 0; document.getElementById('storageNote').style.visibility = 'hidden'`,
    );
    await sleep(wait);
    shot(name, await png(settings));
  };
  // Personajes de ejemplo: la de serie, una tsundere y una profesional.
  const { personaFromTemplate } = await import('../../src/shared/personas.js');
  const cfg0 = api.loadConfig();
  api.patchConfig({ personas: [...cfg0.personas, personaFromTemplate('tsundere', 'es'), personaFromTemplate('profesional', 'es')] });
  // Productividad con datos de ejemplo.
  const at = (d, h, m = 0) => {
    const x = new Date();
    x.setDate(x.getDate() + d);
    x.setHours(h, m, 0, 0);
    return x;
  };
  api.reminders.add({ text: 'Llamar a Ana por lo del viaje', due: at(0, 19, 30) > new Date() ? at(0, 19, 30) : at(1, 19, 30) });
  api.reminders.add({ text: 'Revisar las copias de seguridad del VPS', due: at(1, 9), repeat: 'weekdays' });
  const { saveMemory } = await import('../../src/main/productivity/memory.js');
  saveMemory('Su perro se llama Toby');
  saveMemory('Trabaja con Paperclip y un Hermes en su VPS');
  api.patchConfig({
    productivity: {
      notify: 'speak',
      calendars: [{ id: 'cal-1', name: 'Trabajo', url: 'https://calendar.google.com/calendar/ical/ejemplo%40gmail.com/private-0123456789abcdef/basic.ics' }],
      briefing: { enabled: true, time: '08:30', days: [1, 2, 3, 4, 5] },
      search: { provider: 'searxng', baseUrl: 'https://searx.example.com' },
      folders: [api.app.getPath('documents')],
    },
  });
  // Voz con Piper si hay voz y motor de prueba (CI/local); el catálogo de ejemplo de los tests.
  const piperVoice = process.env.WAIFU_TEST_PIPER_VOICE;
  if (piperVoice) {
    const { installPiperRuntime, downloadPiperRuntime } = await import('../../src/main/piper-runtime.js');
    if (process.env.WAIFU_TEST_PIPER_RUNTIME) installPiperRuntime(fs.readFileSync(process.env.WAIFU_TEST_PIPER_RUNTIME));
    else await downloadPiperRuntime().catch(() => {});
    const { importVoiceFiles } = await import('../../src/main/voices.js');
    const [voice] = await importVoiceFiles(fs.readdirSync(piperVoice).filter((f) => f.endsWith('.onnx')).map((f) => path.join(piperVoice, f)));
    fs.copyFileSync(path.resolve(import.meta.dirname, '..', '..', 'test', 'fixtures', 'piper', 'voices-sample.json'), path.join(api.userDir(), 'voices', 'catalog.json'));
    api.patchConfig({ voice: { tts: { mode: 'piper', piperVoice: voice.key } } });
  }
  api.broadcast('cfg:changed', api.publicConfig());
  for (const tab of ['general', 'personas', 'models', 'voice', 'productivity', 'connectors']) await settingsShot(tab, `settings-${tab}.png`, tab === 'voice' || tab === 'productivity' ? 900 : 300);
  // La pestaña de voz enseña la parte de Piper (más abajo).
  if (piperVoice) {
    await settings.webContents.executeJavaScript(`document.querySelector('[data-tab="voice"]').click()`);
    await sleep(900);
    await settings.webContents.executeJavaScript(`document.querySelector('.piper')?.scrollIntoView({ block: 'start' }); document.getElementById('view').scrollTop -= 110; document.getElementById('storageNote').style.visibility = 'hidden'`);
    await sleep(300);
    shot('settings-voice-piper.png', await png(settings));
  }
  await settingsShot('automations', 'settings-automations.png', 700);

  // ------------------------------------------------ 4. editor de skins con un dibujo de fondo liso
  const editor = api.openWindow('editor');
  await waitForWindow(editor, 'document.querySelector("#btnOpen").textContent.trim().length > 0');
  editor.setSize(1180, 800);
  await editor.webContents.executeJavaScript(`(async () => {
    const img = new Image();
    img.src = 'app://local/bundle/assets/skins/default/base.svg';
    await img.decode();
    const c = document.createElement('canvas');
    c.width = 900; c.height = 1100;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#cfe8ff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 50, 60, 800, 1000);
    await window.__wdEditor.load(c.toDataURL('image/png'), 'Noa');
    document.getElementById('btnKey').click();
  })()`);
  await sleep(1500);
  shot('skin-editor.png', await png(editor));
  await editor.webContents.executeJavaScript(`document.getElementById('name').value = 'Noa (azul)'; document.getElementById('btnSaveOnly').click()`);
  await sleep(800);
  editor.close();
  await sleep(300);
  await settingsShot('skins', 'settings-skins.png', 900);
  settings.close();

  // ------------------------------------------------ 5. la misma conversación en los cinco idiomas
  api.patchConfig(mockConfigPatch(mock.base));
  api.broadcast('cfg:changed', api.publicConfig());
  chat.setSize(400, 600);
  chat.show();
  const chats = [];
  for (const locale of SUPPORTED) {
    await setLanguage(api, locale);
    api.newConversation();
    await sleep(300);
    await conversation(api, PROMPTS[locale].paperclip);
    await chat.webContents.executeJavaScript('document.activeElement?.blur()');
    await sleep(300);
    chats.push(await png(chat));
  }
  {
    const ci = imageSize(chats[0]);
    const gap = px(20);
    const W = ci.width * chats.length + gap * (chats.length + 1);
    const H = ci.height + gap * 2;
    shot('languages.jpg', await compose(W, H, [{ wallpaper: true }, ...chats.map((b, i) => ({ img: b, x: gap + i * (ci.width + gap), y: gap, radius: px(12), shadow: px(30) }))]));
  }

  await setLanguage(api, 'es');
  await mock.close();
  console.log(`SMOKE_RESULT ${JSON.stringify({ ok: true, message: `✓ ${written.length} capturas en docs/screenshots: ${written.join(', ')}`, problems: [], locales: SUPPORTED })}`);
  api.app.exit(0);
}

// Tamaño de un PNG leyendo su cabecera IHDR.
function imageSize(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}
