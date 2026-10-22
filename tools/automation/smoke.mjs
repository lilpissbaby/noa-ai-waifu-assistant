// Prueba de humo: arranca la app de verdad, recorre todas las ventanas en los cinco idiomas y hace
// una conversación completa (modelo -> herramienta -> respuesta) contra el servidor simulado.
// Falla si hay errores de consola, claves sin traducir o la conversación no termina.
// Uso: npm run smoke   (lo lanza tools/smoke.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { CATALOGS, SUPPORTED, tIn } from '../../src/shared/i18n/index.js';
import { startMockServer, mockConfigPatch } from './mock-server.mjs';
import { sleep, waitForWindow, waitForChat, setLanguage } from './common.mjs';

// Cualquier texto con forma de clave («chat.algo», «settings.x.y»), exista o no en el catálogo.
const NAMESPACES = [...new Set(Object.keys(CATALOGS.es).map((k) => k.split('.')[0]))].join('|');
const KEY_RE = `^(${NAMESPACES})\\.[A-Za-z0-9_.]+$`;
const TABS = ['general', 'models', 'voice', 'connectors', 'automations', 'skins'];
// Busca en la página textos o atributos que sean una clave de traducción sin resolver.
const SCAN = `(() => {
  const re = new RegExp(${JSON.stringify(KEY_RE)});
  const keys = { has: (s) => re.test(s) };
  const raw = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) { const s = walker.currentNode.textContent.trim(); if (keys.has(s)) raw.push(s); }
  for (const el of document.querySelectorAll('[title],[placeholder],[aria-label]'))
    for (const a of ['title', 'placeholder', 'aria-label']) { const v = el.getAttribute(a); if (v && keys.has(v)) raw.push(a + '=' + v); }
  return { lang: document.documentElement.lang, title: document.title, raw };
})()`;

export default async function smoke(api) {
  const problems = [];
  const consoleErrors = [];
  const watch = (name, win) =>
    win.webContents.on('console-message', (e) => {
      if (e.level === 'error') consoleErrors.push(`[${name}] ${e.message}`);
    });
  const mock = await startMockServer();
  api.patchConfig(mockConfigPatch(mock.base));
  api.applyUiConfig();
  api.broadcast('cfg:changed', api.publicConfig());

  watch('avatar', api.wins.avatar);
  await waitForWindow(api.wins.avatar, 'window.__wd?.renderer?.skin');

  const check = async (where, win, locale) => {
    const r = await win.webContents.executeJavaScript(SCAN);
    if (r.raw.length) problems.push(`${locale} ${where}: claves sin traducir ${r.raw.join(', ')}`);
    if (!r.lang.toLowerCase().startsWith(locale)) problems.push(`${locale} ${where}: lang=${r.lang}`);
    return r;
  };

  for (const locale of SUPPORTED) {
    await setLanguage(api, locale);
    const settings = api.openWindow('settings');
    if (!settings.__watched) watch('settings', settings), (settings.__watched = true);
    await waitForWindow(settings, 'document.querySelector("#view h1")');
    for (const tab of TABS) {
      await settings.webContents.executeJavaScript(`document.querySelector('[data-tab="${tab}"]').click()`);
      await sleep(tab === 'automations' || tab === 'skins' ? 500 : 150);
      await check(`ajustes/${tab}`, settings, locale);
    }
    const editor = api.openWindow('editor');
    if (!editor.__watched) watch('editor', editor), (editor.__watched = true);
    await waitForWindow(editor, 'document.querySelector("#btnOpen").textContent.trim().length > 0');
    await check('editor', editor, locale);
    const vrmEditor = api.openWindow('vrm-editor');
    if (!vrmEditor.__watched) watch('editor 3D', vrmEditor), (vrmEditor.__watched = true);
    await waitForWindow(vrmEditor, 'document.querySelector("#btnOpen").textContent.trim().length > 0');
    await check('editor 3D', vrmEditor, locale);
    api.toggleChat(true);
    await sleep(300);
    const chat = api.wins.chat;
    if (!chat.__watched) watch('chat', chat), (chat.__watched = true);
    await waitForWindow(chat, 'document.querySelector("#hint").textContent.length > 0');
    await check('chat', chat, locale);
    await check('avatar', api.wins.avatar, locale);
  }

  // Editor 3D con la skin de serie: carga el modelo y enseña su licencia.
  const av = api.wins.avatar;
  const hasGl = await av.webContents.executeJavaScript("!!document.createElement('canvas').getContext('webgl2')");
  if (hasGl) {
    api.openWindow('vrm-editor', { query: { id: 'noa-3d' } });
    const ed = api.wins['vrm-editor'];
    await sleep(500);
    await waitForWindow(ed, '!!window.__wdVrmEditor?.renderer?.vrm && document.querySelectorAll("#license dt").length >= 4', 30000);
    await check('editor 3D (noa-3d)', ed, SUPPORTED.at(-1));
    ed.close();
    await sleep(300);

    // Importar un VRM de principio a fin: preparar, ver, guardar y usar.
    const { stageVrm } = await import('../../src/main/skins.js');
    const staged = stageVrm(path.join(api.app.getAppPath(), 'assets/skins/noa-3d/model.vrm'), 'Importada');
    const ed2 = api.openWindow('vrm-editor');
    await waitForWindow(ed2, '!!window.__wdVrmEditor');
    await ed2.webContents.executeJavaScript(`window.__wdVrmEditor.fromStaged(${JSON.stringify(staged)})`);
    await waitForWindow(ed2, '!!window.__wdVrmEditor.renderer?.vrm', 30000);
    await ed2.webContents.executeJavaScript(`document.querySelector('[data-preset="bust"]').click(); document.getElementById('btnSave').click()`);
    await waitForWindow(ed2, 'document.getElementById("saveStatus").classList.contains("ok")', 30000);
    const used = api.loadConfig().ui.skinId;
    if (!/^vrm-/.test(used)) problems.push(`editor 3D: no se usó la skin importada (${used})`);
    await waitForWindow(av, `window.__wd.renderer?.kind === 'vrm' && window.__wd.renderer.skin?.id === ${JSON.stringify(used)}`, 30000);
    if (fs.existsSync(path.join(api.userDir(), 'tmp', `${staged.tmpId}.vrm`))) problems.push('editor 3D: quedó el archivo temporal');
    ed2.close();
    api.useSkin('default');
    await waitForWindow(av, "window.__wd.renderer?.kind === '2d'", 15000);
  }

  // Skin 3D: carga y dibuja; ida y vuelta 2D <-> 3D dos veces sin duplicar el bucle de animación.
  if (!hasGl) api.logger.warn('3D omitido: sin WebGL2');
  else {
    for (let round = 0; round < 2; round++) {
      api.useSkin('noa-3d');
      await waitForWindow(av, "window.__wd.renderer?.kind === 'vrm' && !!window.__wd.renderer.skin", 30000);
      await sleep(1500);
      const r = await av.webContents.executeJavaScript(`(async () => {
        const r = window.__wd.renderer, st = window.__wd.stage;
        const h = r.headAnchorCss();
        const f0 = st.frames;
        await new Promise((ok) => setTimeout(ok, 1000));
        return { alpha: h ? r.alphaAtCss(h[0], h[1] + 25, 2) : -1, ms: r.avgRenderMs(), running: st.running, fps: st.frames - f0, rects: r.shapeRects(6, 4).length };
      })()`);
      if (!(r.alpha > 40)) problems.push(`3D: la waifu no se ve bajo la cabeza (alfa ${r.alpha})`);
      if (!r.running) problems.push('3D: el bucle de animación no está en marcha');
      if (r.fps > 75) problems.push(`3D: ${r.fps} fotogramas/s, ¿bucle duplicado?`);
      if (!r.rects) problems.push('3D: la silueta está vacía');
      api.logger.info(`3D (vuelta ${round + 1}): render medio ${r.ms.toFixed(1)} ms, ${r.fps} fps`);
      api.useSkin('default');
      await waitForWindow(av, "window.__wd.renderer?.kind === '2d' && !!window.__wd.renderer.skin", 15000);
    }
    await sleep(300);
    const fps2d = await av.webContents.executeJavaScript('(async () => { const st = window.__wd.stage, f0 = st.frames; await new Promise((ok) => setTimeout(ok, 1000)); return st.frames - f0; })()');
    if (fps2d > 75) problems.push(`2D: ${fps2d} fotogramas/s tras volver del 3D, ¿bucle duplicado?`);
  }

  // Al cambiar de idioma, la personalidad por defecto sigue al idioma (acabamos en chino).
  if (api.loadConfig().assistant.personality !== tIn(SUPPORTED.at(-1), 'defaults.personality')) problems.push('la personalidad por defecto no cambió de idioma');

  // Conversación completa en español: llamada a herramienta + respuesta en streaming.
  await setLanguage(api, 'es');
  api.newConversation();
  const done = waitForChat(api, (e) => e.type === 'done' || e.type === 'error');
  await api.sendMessage('¿Qué hora es?');
  const end = await done;
  if (end.type === 'error') problems.push(`chat: ${end.message}`);
  await sleep(400);
  const chatDom = await api.wins.chat.webContents.executeJavaScript(
    `({ tool: document.querySelector('.tool .name')?.textContent, ok: !!document.querySelector('.tool.ok'), reply: document.querySelector('.msg.assistant .body')?.textContent })`,
  );
  if (chatDom.tool !== 'Mirar la hora' || !chatDom.ok) problems.push(`chat: chip de herramienta incorrecto ${JSON.stringify(chatDom)}`);
  if (!/^Son las \d/.test(chatDom.reply || '')) problems.push(`chat: respuesta inesperada ${JSON.stringify(chatDom.reply)}`);
  // La respuesta simulada empieza con <emo:happy>: no se ve en el chat y la waifu la recibe.
  if ((chatDom.reply || '').includes('<emo:')) problems.push('emociones: la etiqueta llegó al chat');
  const emo = await api.wins.avatar.webContents.executeJavaScript('window.__wd.behaviour.emotionAt(performance.now()).name');
  if (emo !== 'happy') problems.push(`emociones: el avatar no recibió «happy» (${emo})`);

  // Paperclip: crear tarea y despertar al agente (aprobación automática configurada).
  const done2 = waitForChat(api, (e) => e.type === 'done' || e.type === 'error');
  await api.sendMessage('Crea una tarea en Paperclip para el CTO');
  const end2 = await done2;
  if (end2.type === 'error') problems.push(`paperclip: ${end2.message}`);
  if (mock.issues[0]?.title !== 'Migrar Postgres a la 17') problems.push(`paperclip: no se creó la tarea ${JSON.stringify(mock.issues)}`);

  problems.push(...consoleErrors);
  const result = { ok: problems.length === 0, locales: SUPPORTED, problems };
  console.log(`SMOKE_RESULT ${JSON.stringify(result)}`);
  await mock.close();
  api.app.exit(result.ok ? 0 : 1);
}
