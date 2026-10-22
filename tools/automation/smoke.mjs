// Prueba de humo: arranca la app de verdad, recorre todas las ventanas en los cinco idiomas y hace
// una conversación completa (modelo -> herramienta -> respuesta) contra el servidor simulado.
// Falla si hay errores de consola, claves sin traducir o la conversación no termina.
// Uso: npm run smoke   (lo lanza tools/smoke.mjs)
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
    api.toggleChat(true);
    await sleep(300);
    const chat = api.wins.chat;
    if (!chat.__watched) watch('chat', chat), (chat.__watched = true);
    await waitForWindow(chat, 'document.querySelector("#hint").textContent.length > 0');
    await check('chat', chat, locale);
    await check('avatar', api.wins.avatar, locale);
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
