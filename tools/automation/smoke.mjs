// Prueba de humo: arranca la app de verdad, recorre todas las ventanas en los cinco idiomas y hace
// una conversación completa (modelo -> herramienta -> respuesta) contra el servidor simulado.
// Falla si hay errores de consola, claves sin traducir o la conversación no termina.
// Uso: npm run smoke   (lo lanza tools/smoke.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { CATALOGS, SUPPORTED, tIn } from '../../src/shared/i18n/index.js';
import { startMockServer, mockConfigPatch } from './mock-server.mjs';
import { sleep, waitForWindow, waitForChat, setLanguage } from './common.mjs';
import { piperCheck } from './piper-check.mjs';
import { makePdf } from '../../test/helpers/pdf.mjs';
import { live2dFixtures, live2dCheck } from './live2d-check.mjs';

// Cualquier texto con forma de clave («chat.algo», «settings.x.y»), exista o no en el catálogo.
const NAMESPACES = [...new Set(Object.keys(CATALOGS.es).map((k) => k.split('.')[0]))].join('|');
const KEY_RE = `^(${NAMESPACES})\\.[A-Za-z0-9_.]+$`;
const TABS = ['general', 'personas', 'models', 'voice', 'productivity', 'organize', 'connectors', 'automations', 'skins'];
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
    api.openWindow('vrm-editor', { query: { kind: 'live2d' } });
    await sleep(300);
    await waitForWindow(api.wins['vrm-editor'], 'document.body.classList.contains("mode-live2d") && document.querySelector("#btnOpenZip").textContent.trim().length > 0');
    await check('editor Live2D', api.wins['vrm-editor'], locale);
    api.openWindow('vrm-editor', { query: {} });
    await sleep(300);
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
        const f0 = st.frames;
        await new Promise((ok) => setTimeout(ok, 1000));
        // Sin GPU cada fotograma tarda cientos de ms: se espera a que la máscara refleje la silueta.
        let alpha = -1;
        for (let i = 0; i < 40 && !(alpha > 40); i++) {
          const hh = r.headAnchorCss();
          alpha = hh ? r.alphaAtCss(hh[0], hh[1] + 25, 2) : -1;
          if (!(alpha > 40)) await new Promise((ok) => setTimeout(ok, 250));
        }
        return { alpha, ms: r.avgRenderMs(), running: st.running, fps: st.frames - f0, rects: r.shapeRects(6, 4).length };
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

  // Personajes: uno nuevo con skin 3D y saludo; al activarlo cambia la skin y saluda en el chat.
  if (hasGl) {
    const cfg0 = api.loadConfig();
    api.patchConfig({ personas: [...cfg0.personas, { id: 'smoke3d', name: 'Tres', personality: 'x', greeting: 'Hola, {{user}}', skinId: 'noa-3d', filters: {} }] });
    const greet = waitForChat(api, (e) => e.type === 'assistant_message');
    api.switchPersona('smoke3d');
    await waitForWindow(av, "window.__wd.renderer?.kind === 'vrm' && !!window.__wd.renderer.skin", 30000);
    const g = await greet;
    if (!/^Hola/.test(g.text)) problems.push(`personajes: saludo inesperado ${JSON.stringify(g.text)}`);
    const settingsWin = api.wins.settings;
    if (settingsWin && !settingsWin.isDestroyed()) {
      await settingsWin.webContents.executeJavaScript(`document.querySelector('[data-tab="personas"]').click()`);
      await sleep(500);
      const n = await settingsWin.webContents.executeJavaScript('document.querySelectorAll(".persona-row").length');
      if (n !== 2) problems.push(`personajes: la lista tiene ${n} filas`);
    }
    api.switchPersona(cfg0.activePersonaId, { greet: false });
    api.patchConfig({ personas: cfg0.personas });
    api.useSkin('default');
    await waitForWindow(av, "window.__wd.renderer?.kind === '2d'", 15000);
  }

  // Al cambiar de idioma, la personalidad por defecto sigue al idioma (acabamos en chino).
  if (api.loadConfig().personas[0].personality !== tIn(SUPPORTED.at(-1), 'defaults.personality')) problems.push('la personalidad por defecto no cambió de idioma');

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

  // Avisos de agentes: la tarea creada queda vigilada; cuando pasa a «done» llega un aviso.
  if (!api.watcher.list().some((w) => w.id === 'i7')) problems.push(`agentes: la tarea creada no se vigila ${JSON.stringify(api.watcher.list())}`);
  else {
    mock.issues[0].status = 'done';
    const doneNotice = waitForChat(api, (e) => e.type === 'announce' && /PAP-7/.test(e.text));
    const changes = await api.pollAgents();
    await doneNotice.catch(() => problems.push('agentes: no llegó el aviso de tarea terminada'));
    if (changes.length !== 1 || api.watcher.list().length) problems.push(`agentes: cambios inesperados ${JSON.stringify(changes)}`);
  }
  // Hermes en segundo plano: responde al momento y el resultado llega después al chat.
  const bg = waitForChat(api, (e) => e.type === 'assistant_message' && /12 containers/.test(e.text));
  const started = await api.runTool('hermes_task', { task: 'docker ps', background: true });
  if (!/background/.test(started)) problems.push(`hermes: no se lanzó en segundo plano (${started})`);
  await bg.catch(() => problems.push('hermes: el resultado en segundo plano no llegó al chat'));

  // Ver la pantalla: la herramienta captura (aprobada de antemano) y la imagen llega al modelo.
  api.patchConfig({ tools: { autoApprove: { screen_capture: true } } });
  const done3 = waitForChat(api, (e) => e.type === 'done' || e.type === 'error', 30000);
  await api.sendMessage('Mira mi pantalla, ¿qué ves?');
  const end3 = await done3;
  if (end3.type === 'error') problems.push(`pantalla: ${end3.message}`);
  if (!mock.images.length || !mock.images[0].startsWith('data:image/jpeg;base64,')) problems.push(`pantalla: el modelo no recibió la captura (${mock.images.length})`);
  else if (mock.images[0].length < 2000) problems.push('pantalla: la captura está vacía');
  await sleep(300);
  const shotDom = await api.wins.chat.webContents.executeJavaScript(`!!document.querySelector('.tool.ok .tool-shot')`);
  if (!shotDom) problems.push('pantalla: el chat no muestra la miniatura de la captura');

  // Archivos soltados en el chat: un .txt y un PDF llegan al modelo como texto.
  fs.writeFileSync(path.join(api.userDir(), 'lista.txt'), 'Comprar leche y pilas AA');
  fs.writeFileSync(path.join(api.userDir(), 'informe.pdf'), makePdf('Ventas del trimestre: 42'));
  const attached = await api.wins.chat.webContents.executeJavaScript(
    `wd.invoke('chat:attach-files', ${JSON.stringify([path.join(api.userDir(), 'lista.txt'), path.join(api.userDir(), 'informe.pdf')])})`,
  );
  if (attached.error || attached.attachments?.length !== 2) problems.push(`archivos: no se adjuntaron ${JSON.stringify(attached)}`);
  else {
    const done4 = waitForChat(api, (e) => e.type === 'done' || e.type === 'error');
    await api.wins.chat.webContents.executeJavaScript(`wd.invoke('chat:send', 'Resúmeme esto', 'text', ${JSON.stringify(attached.attachments)})`);
    await done4;
    const got = mock.files.join('\n');
    if (!got.includes('Comprar leche y pilas AA')) problems.push('archivos: el .txt no llegó al modelo');
    if (!got.includes('Ventas del trimestre: 42')) problems.push(`archivos: el PDF no llegó al modelo (${got.slice(0, 200)})`);
  }

  // Acción rápida «Traducir» sobre el portapapeles: se compone el mensaje y se copia la respuesta.
  await api.clipboard.writeText('Good morning team, the release went fine');
  const done5 = waitForChat(api, (e) => e.type === 'done' || e.type === 'error');
  const translate = (api.loadConfig().productivity.quickActions || (await import('../../src/shared/quick-actions.js')).defaultActions('es')).find((a) => a.id === 'translate');
  await api.runQuickAction(translate);
  await done5;
  await sleep(300);
  const lastUser = await api.wins.chat.webContents.executeJavaScript(`[...document.querySelectorAll('.msg.user')].at(-1)?.textContent || ''`);
  if (!lastUser.includes('Good morning team') || !lastUser.startsWith('Traduce')) problems.push(`acciones rápidas: mensaje inesperado ${JSON.stringify(lastUser.slice(0, 80))}`);
  await sleep(300);
  const copied = await api.clipboard.readText();
  if (!copied.startsWith('¡Hola! Soy Noa')) problems.push(`acciones rápidas: el portapapeles no tiene la respuesta (${copied.slice(0, 60)})`);

  // Agenda: un calendario .ics local con un evento de hoy; la herramienta lo devuelve.
  const d0 = new Date();
  const ymd = `${d0.getFullYear()}${String(d0.getMonth() + 1).padStart(2, '0')}${String(d0.getDate()).padStart(2, '0')}`;
  const ics = path.join(api.userDir(), 'agenda.ics');
  fs.writeFileSync(ics, ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:smoke@waifu', `DTSTART;VALUE=DATE:${ymd}`, 'SUMMARY:Revisión del smoke', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n'));
  api.patchConfig({ productivity: { calendars: [{ id: 'smoke', name: 'Smoke', file: ics }] } });
  const agenda = await api.runTool('calendar_events', {});
  if (!agenda?.events?.some((e) => e.title === 'Revisión del smoke')) problems.push(`agenda: no devuelve el evento de hoy ${JSON.stringify(agenda).slice(0, 200)}`);

  // Resumen diario: petición interna oculta; la respuesta sale en el chat y en el bocadillo.
  const done6 = waitForChat(api, (e) => e.type === 'done' || e.type === 'error');
  await api.runBriefing();
  await done6;
  await sleep(400);
  if (mock.briefings.length !== 1) problems.push(`resumen: el modelo recibió ${mock.briefings.length} peticiones`);
  const hiddenShown = await api.wins.chat.webContents.executeJavaScript(`[...document.querySelectorAll('.msg.user')].some((m) => m.textContent.includes('[Daily briefing]'))`);
  if (hiddenShown) problems.push('resumen: la petición interna se ve en el chat');
  const briefBubble = await api.wins.avatar.webContents.executeJavaScript(`document.querySelector('#bubble.announce:not(.hidden) #bubbleText')?.textContent || ''`);
  if (!briefBubble.startsWith('¡Hola!')) problems.push(`resumen: el bocadillo no lo anuncia (${briefBubble})`);
  api.patchConfig({ productivity: { calendars: [] } });

  // Web: buscar en un SearXNG simulado y leer el artículo (en la red local: aprobado de antemano).
  api.patchConfig({ productivity: { search: { provider: 'searxng', baseUrl: `${mock.base}/searx` } }, tools: { autoApprove: { web_fetch: true } } });
  const found = await api.runTool('web_search', { query: 'waifu desk' }).catch((e) => ({ error: e.message }));
  if (!Array.isArray(found) || found[0]?.title !== 'Waifu Desk') problems.push(`web: búsqueda inesperada ${JSON.stringify(found).slice(0, 200)}`);
  else {
    const page = await api.runTool('web_fetch', { url: found[0].url }).catch((e) => ({ error: e.message }));
    if (!/voces locales Piper/.test(page.text || '') || /NO|Menú/.test(page.text || '')) problems.push(`web: lectura inesperada ${JSON.stringify(page).slice(0, 200)}`);
  }
  api.patchConfig({ productivity: { search: { provider: 'none', baseUrl: '' } } });

  // Recordatorio de 1 s: llega como aviso al chat y al bocadillo del avatar.
  const announced = waitForChat(api, (e) => e.type === 'announce');
  const rem = await api.runTool('reminder_create', { text: 'Estirar las piernas', in_minutes: 1 / 60 });
  if (!rem?.id) problems.push(`recordatorios: no se creó ${JSON.stringify(rem)}`);
  const ann = await announced.catch((e) => ({ text: String(e) }));
  if (!/Estirar las piernas/.test(ann.text)) problems.push(`recordatorios: aviso inesperado ${JSON.stringify(ann.text)}`);
  await sleep(300);
  const remDom = await api.wins.chat.webContents.executeJavaScript(`[...document.querySelectorAll('.msg.notice-msg .body')].map((b) => b.textContent).join(' | ')`);
  if (!remDom.includes('Estirar las piernas')) problems.push(`recordatorios: no está en el chat (${remDom})`);
  const bubbleTxt = await api.wins.avatar.webContents.executeJavaScript(`document.querySelector('#bubble.announce:not(.hidden) #bubbleText')?.textContent || ''`);
  if (!bubbleTxt.includes('Estirar las piernas')) problems.push(`recordatorios: el bocadillo no lo muestra (${bubbleTxt})`);
  if (api.reminders.list().length) problems.push('recordatorios: el único sigue pendiente tras avisar');

  // 0.5.0 en la app real (también en Windows): tareas, concentración, estado del PC y modo mascota.
  const task = await api.runTool('task_add', { title: 'Prueba de humo', due: '2030-01-01', priority: 'high' }).catch((e) => ({ error: e.message }));
  if (!task?.id) problems.push(`tareas: no se creó ${JSON.stringify(task)}`);
  else {
    const listed = await api.runTool('task_list', {});
    if (!listed.tasks?.some((x) => x.id === task.id)) problems.push('tareas: no aparece en task_list');
    await api.runTool('task_delete', { id: task.id });
  }
  const focusOn = await api.runTool('focus_start', { minutes: 5, label: 'humo' }).catch((e) => ({ error: e.message }));
  if (focusOn.phase !== 'work') problems.push(`concentración: no empezó ${JSON.stringify(focusOn)}`);
  const focusOff = await api.runTool('focus_stop', {}).catch((e) => ({ error: e.message }));
  if (focusOff.phase !== 'off') problems.push(`concentración: no paró ${JSON.stringify(focusOff)}`);
  const pc = await api.runTool('system_status', { processes: true }).catch((e) => ({ error: e.message }));
  if (!(pc.cpu?.cores > 0) || !(pc.memory?.totalGB > 0) || !pc.disks?.length) problems.push(`estado del PC: incompleto ${JSON.stringify(pc).slice(0, 300)}`);
  if (!Array.isArray(pc.topProcesses) || !pc.topProcesses.length) problems.push('estado del PC: sin procesos');
  // Dormida: el «Zzz» sale cuando se va el aviso que haya en el bocadillo (el del recordatorio dura 12 s).
  api.sendTo('avatar', 'avatar:sleep', true);
  await waitForWindow(api.wins.avatar, `/Zzz/.test(document.querySelector('#bubble.sleep:not(.hidden) #bubbleText')?.textContent || '')`, 16000).catch(() => {});
  const zzz = await api.wins.avatar.webContents.executeJavaScript(`document.querySelector('#bubble.sleep:not(.hidden) #bubbleText')?.textContent || ''`);
  if (!/Zzz/.test(zzz)) problems.push(`modo mascota: no sale el «Zzz» (${zzz})`);
  api.sendTo('avatar', 'avatar:sleep', false);
  await sleep(200);

  // Live2D con el SDK oficial y Hiyori (CI: tools/fetch-live2d-fixtures.mjs → WAIFU_TEST_LIVE2D_DIR).
  const l2d = live2dFixtures(process.env.WAIFU_TEST_LIVE2D_DIR);
  if (l2d && hasGl) await live2dCheck(api, l2d, problems);

  // Voces locales Piper con una voz real (el CI la descarga de los releases de Piper).
  const piperVoice = process.env.WAIFU_TEST_PIPER_VOICE;
  if (piperVoice) await piperCheck(api, piperVoice, problems, check);

  problems.push(...consoleErrors);
  const result = {
    ok: problems.length === 0,
    locales: SUPPORTED,
    problems,
    message: `✓ Prueba de humo superada (${SUPPORTED.join(', ')})${piperVoice ? ' + voz Piper' : ' — sin voz Piper de prueba (WAIFU_TEST_PIPER_VOICE)'}${l2d && hasGl ? ' + Live2D' : ' — Live2D omitido (WAIFU_TEST_LIVE2D_DIR)'}`,
  };
  console.log(`SMOKE_RESULT ${JSON.stringify(result)}`);
  await mock.close();
  api.app.exit(result.ok ? 0 : 1);
}
