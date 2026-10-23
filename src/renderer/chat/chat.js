import { renderMarkdown, escapeHtml } from '../shared/md.js';
import { icons } from '../shared/icons.js';
import { t, tHtml, setLocale, getLocale, CATALOGS } from '../../shared/i18n/index.js';
import { applyDom } from '../../shared/i18n/dom.js';
import { assistantName } from '../../shared/personas.js';

const wd = window.wd;
const $ = (id) => document.getElementById(id);
const log = $('log');
const input = $('input');
const btnSend = $('btnSend');
const btnMic = $('btnMic');
const profileSel = $('profile');
const empty = $('empty');
const attachBar = $('attachments');

// Imágenes y archivos adjuntos (guardados en userData/attachments/ por el proceso principal).
const attUrl = (a) => `app://local/user/attachments/${encodeURIComponent(a.file)}`;
function attachmentsView(list, onRemove) {
  const box = document.createElement('div');
  box.className = 'atts';
  list.forEach((a, i) => {
    const item = document.createElement('div');
    item.className = `att ${a.kind}`;
    item.title = a.name;
    if (a.kind === 'image') {
      const img = document.createElement('img');
      img.src = attUrl(a);
      img.alt = a.name;
      img.onclick = () => wd.invoke('chat:open-attachment', a.file);
      item.append(img);
    } else {
      item.innerHTML = `${icons.file}<span></span>`;
      item.querySelector('span').textContent = a.name;
    }
    if (onRemove) {
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'x';
      x.innerHTML = icons.close;
      x.title = t('chat.removeAttachment');
      x.onclick = () => onRemove(i);
      item.append(x);
    }
    box.append(item);
  });
  return box;
}

let pending = [];
function renderPending() {
  attachBar.innerHTML = '';
  attachBar.classList.toggle('hidden', !pending.length);
  if (pending.length)
    attachBar.append(
      attachmentsView(pending, (i) => {
        pending.splice(i, 1);
        renderPending();
      }),
    );
}
function addPending(att) {
  if (!att) return;
  pending.push(att);
  renderPending();
  input.focus();
}
wd.on('chat:attach', addPending);

$('btnNew').innerHTML = icons.plus;
$('btnSettings').innerHTML = icons.settings;
$('btnClose').innerHTML = icons.close;
btnMic.innerHTML = icons.mic;
btnSend.innerHTML = icons.send;

let cfg = null;
let busy = false;
let current = null; // mensaje del asistente en curso

// Nombre legible de cada herramienta en los chips del chat (claves en tools.*).
// Nombre legible de la herramienta si el catálogo lo tiene; si no, el técnico.
const toolLabel = (n) => (CATALOGS.en[`tools.${n}`] ? t(`tools.${n}`) : n.replace(/^webhook_/, 'Webhook · ').replace(/^mcp_/, 'MCP · '));

// ---------------------------------------------------------------- utilidades de vista
const atBottom = () => log.scrollHeight - log.scrollTop - log.clientHeight < 60;
function scrollDown(force = false) {
  if (force || atBottom()) requestAnimationFrame(() => (log.scrollTop = log.scrollHeight));
}

function updateEmpty() {
  empty.classList.toggle('hidden', log.children.length > 0);
}

function addUser(m) {
  const el = document.createElement('div');
  el.className = 'msg user';
  if (m.attachments?.length) el.append(attachmentsView(m.attachments));
  if (m.content) el.append(document.createTextNode(m.content));
  if (m.via === 'voice') el.insertAdjacentHTML('beforeend', '<span class="via">🎙</span>');
  log.append(el);
  updateEmpty();
  scrollDown(true);
}

function newAssistant() {
  const el = document.createElement('div');
  el.className = 'msg assistant';
  el.innerHTML = '<div class="tools"></div><div class="body"></div>';
  log.append(el);
  updateEmpty();
  const obj = { el, text: '', tools: new Map(), body: el.querySelector('.body'), toolsEl: el.querySelector('.tools') };
  return obj;
}

let renderQueued = false;
function paint(obj, final) {
  const stick = atBottom();
  if (!obj.text && !final) obj.body.innerHTML = obj.tools.size ? '' : '<span class="thinking-dots"><i></i><i></i><i></i></span>';
  else {
    obj.body.innerHTML = renderMarkdown(obj.text);
    if (!final) obj.body.lastElementChild?.classList.add('caret');
  }
  if (stick) log.scrollTop = log.scrollHeight;
}
function renderCurrent(final = false) {
  const obj = current;
  if (!obj) return;
  if (final) return paint(obj, true); // síncrono: el mensaje se cierra justo después
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    if (current === obj) paint(obj, false);
  });
}

function addTool(obj, { id, name, input: inp }, state = 'run', result = '') {
  const el = document.createElement('div');
  el.className = `tool ${state}`;
  const sub = summarizeInput(name, inp);
  el.innerHTML = `<button type="button"><span class="ico">${state === 'run' ? icons.sparkle : state === 'ok' ? icons.check : icons.alert}</span><span class="name">${escapeHtml(
    toolLabel(name),
  )}</span><span class="sub">${escapeHtml(sub)}</span><span class="chev">${icons.chevron}</span></button><pre></pre>`;
  el.querySelector('pre').textContent = `${JSON.stringify(inp ?? {}, null, 2)}${result ? `\n\n→ ${result}` : ''}`;
  el.querySelector('button').onclick = () => el.classList.toggle('open');
  obj.toolsEl.append(el);
  obj.tools.set(id, { el, inp, name });
  return el;
}

function summarizeInput(name, inp = {}) {
  if (name === 'hermes_task') return inp.task || '';
  if (name === 'run_command') return inp.command || '';
  if (name === 'paperclip_create_issue') return inp.title || '';
  if (name === 'open_url') return inp.url || '';
  const first = Object.values(inp || {}).find((v) => typeof v === 'string');
  return first || '';
}

function addNotice(text, level = 'info') {
  const el = document.createElement('div');
  el.className = `notice ${level}`;
  el.textContent = text;
  log.append(el);
  updateEmpty();
  scrollDown();
}

function addError(message) {
  const el = document.createElement('div');
  el.className = 'msg error';
  el.innerHTML = `${icons.alert}<div><div class="txt"></div><div class="err-actions"><button class="btn"></button></div></div>`;
  el.querySelector('.err-actions .btn').textContent = t('chat.openSettings');
  el.querySelector('.txt').textContent = message;
  el.querySelector('button').onclick = () => wd.invoke('win:open', 'settings', { tab: 'models' });
  log.append(el);
  updateEmpty();
  scrollDown(true);
}

function setBusy(v) {
  busy = v;
  btnSend.classList.toggle('stop', v);
  btnSend.innerHTML = v ? icons.stop : icons.send;
  btnSend.title = v ? t('chat.stop') : t('chat.sendTitle');
}

// ---------------------------------------------------------------- historial
function renderHistory(history) {
  log.innerHTML = '';
  current = null;
  let lastAssistant = null;
  for (const m of history) {
    if (m.role === 'user') {
      addUser(m);
      lastAssistant = null;
    } else if (m.role === 'assistant' && m.notice) {
      // Avisos y mensajes sueltos (recordatorios, saludos…): burbuja propia.
      const el = newAssistant();
      el.text = m.content;
      el.el.classList.add('notice-msg');
      el.body.innerHTML = renderMarkdown(el.text);
      lastAssistant = null;
    } else if (m.role === 'assistant') {
      if (!lastAssistant) lastAssistant = newAssistant();
      for (const tc of m.toolCalls || []) addTool(lastAssistant, tc, 'run');
      if (m.content) {
        lastAssistant.text += (lastAssistant.text ? '\n\n' : '') + m.content;
        lastAssistant.body.innerHTML = renderMarkdown(lastAssistant.text);
      }
    } else if (m.role === 'tool' && lastAssistant) {
      const tool = lastAssistant.tools.get(m.toolCallId);
      if (tool) finishTool(tool, !m.isError, m.content, (m.images || []).map(attUrl));
    }
  }
  updateEmpty();
  log.scrollTop = log.scrollHeight;
  return lastAssistant; // respuesta del último turno (para continuarla si sigue en curso)
}

function finishTool(tool, ok, result, images = []) {
  tool.el.classList.remove('run');
  for (const url of images) {
    const img = document.createElement('img');
    img.className = 'tool-shot';
    img.src = url;
    tool.el.querySelector('button').after(img);
  }
  tool.el.querySelector('.sub').textContent = summarizeInput(tool.name, tool.inp);
  tool.el.classList.add(ok ? 'ok' : 'err');
  tool.el.querySelector('.ico').innerHTML = ok ? icons.check : icons.alert;
  tool.el.querySelector('pre').textContent = `${JSON.stringify(tool.inp ?? {}, null, 2)}\n\n→ ${result || ''}`;
}

// ---------------------------------------------------------------- eventos del proceso principal
// Los eventos que llegan antes de pintar el historial se guardan y luego se aplican
// solo si son posteriores a la instantánea (número de secuencia).
let ready = false;
let lastSeq = 0;
const early = [];
wd.on('chat:event', (e) => {
  if (!ready) early.push(e);
  else handleEvent(e);
});

function handleEvent(e) {
  if (e.seq) {
    if (e.seq <= lastSeq) return;
    lastSeq = e.seq;
  }
  switch (e.type) {
    case 'reset':
      pending = [];
      renderPending();
      log.innerHTML = '';
      current = null;
      setBusy(false);
      updateEmpty();
      break;
    case 'user':
      addUser(e.message);
      break;
    case 'assistant_start':
      current = newAssistant();
      setBusy(true);
      renderCurrent();
      scrollDown(true);
      break;
    case 'text':
      if (!current) current = newAssistant();
      current.text += e.delta;
      renderCurrent();
      break;
    case 'tool_start':
      if (!current) current = newAssistant();
      if (!current.tools.has(e.id)) addTool(current, e, 'run');
      renderCurrent();
      scrollDown();
      break;
    case 'tool_progress': {
      const tool = current?.tools.get(e.id);
      if (tool) tool.el.querySelector('.sub').textContent = e.message;
      break;
    }
    case 'tool_end': {
      const tool = current?.tools.get(e.id);
      if (tool) finishTool(tool, e.ok, e.result, e.images || []);
      break;
    }
    case 'done':
      if (current) {
        if (!current.text && !current.tools.size) current.el.remove();
        else renderCurrent(true);
        if (e.aborted) addNotice(t('chat.stopped'));
      }
      current = null;
      setBusy(false);
      updateEmpty();
      break;
    case 'error':
      if (current && !current.text && !current.tools.size) current.el.remove();
      else if (current) renderCurrent(true);
      current = null;
      setBusy(false);
      addError(e.message);
      break;
    case 'notice':
      addNotice(e.message, e.level);
      break;
    case 'announce':
    case 'assistant_message': {
      // Mensaje completo fuera de un turno: saludo de un personaje, avisos, resultados en segundo plano.
      const prev = current;
      current = newAssistant();
      current.text = e.text;
      if (e.notice || e.type === 'announce') current.el.classList.add('notice-msg');
      renderCurrent(true);
      current = prev;
      scrollDown(true);
      updateEmpty();
      break;
    }
    default:
      break;
  }
}

const STATES = ['idle', 'thinking', 'talking', 'listening', 'working', 'error'];
const stateLabel = (s) => (STATES.includes(s) ? t(`chat.state.${s}`) : s);
let lastState = { state: 'idle', label: '' };
function showState({ state, label }) {
  lastState = { state, label };
  document.body.dataset.state = state;
  $('stateText').textContent = label || stateLabel(state);
}
wd.on('avatar:state', showState);
wd.on('voice:status', ({ recording }) => btnMic.classList.toggle('active', !!recording));

// ---------------------------------------------------------------- configuración
function applyConfig(pc) {
  cfg = pc.config;
  const localeChanged = pc.locale !== getLocale();
  setLocale(pc.locale);
  applyDom();
  $('assistantName').textContent = assistantName(cfg);
  document.title = t('chat.windowTitle', { name: assistantName(cfg) });
  $('hello').innerHTML = cfg.assistant.userName
    ? tHtml('chat.helloUser', { user: cfg.assistant.userName, name: assistantName(cfg) })
    : tHtml('chat.hello', { name: assistantName(cfg) });
  setBusy(busy);
  if (localeChanged) {
    showState(lastState);
    for (const b of log.querySelectorAll('.err-actions .btn')) b.textContent = t('chat.openSettings');
  }
  profileSel.innerHTML = cfg.profiles
    .map((p) => `<option value="${escapeHtml(p.id)}" ${p.id === cfg.activeProfileId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`)
    .join('');
  const c = cfg.connectors;
  const sugg = [];
  if (c.paperclip.enabled) sugg.push(t('chat.suggest.paperclip'));
  if (c.hermes.enabled) sugg.push(t('chat.suggest.hermes'));
  sugg.push(t('chat.suggest.clipboard'));
  if (!c.paperclip.enabled && !c.hermes.enabled) sugg.push(t('chat.suggest.what'));
  $('suggest').innerHTML = '';
  for (const s of sugg.slice(0, 3)) {
    const b = document.createElement('button');
    b.textContent = s;
    b.onclick = () => send(s);
    $('suggest').append(b);
  }
  const talkKey = (cfg.ui.hotkeyTalk || '').replace('Control', 'Ctrl');
  $('hint').innerHTML = [
    ['Enter', 'chat.hintSend'],
    ['Shift+Enter', 'chat.hintNewline'],
    [talkKey, 'chat.hintTalk'],
  ]
    .filter(([k]) => k)
    .map(([k, key]) => `<span class="hint-item"><kbd>${escapeHtml(k)}</kbd> ${escapeHtml(t(key))}</span>`)
    .join(' · ');
}
wd.on('cfg:changed', applyConfig);

profileSel.addEventListener('change', () => wd.invoke('cfg:patch', { activeProfileId: profileSel.value }));

// ---------------------------------------------------------------- entrada
function autosize() {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
}
input.addEventListener('input', autosize);

function send(text) {
  const msg = (text ?? input.value).trim();
  if (!msg && !pending.length) return;
  const atts = pending;
  pending = [];
  renderPending();
  input.value = '';
  autosize();
  wd.invoke('chat:send', msg, 'text', atts);
}

// Archivos pegados o soltados: los que tienen ruta (del explorador) los lee el proceso principal;
// las imágenes sin ruta (capturas en el portapapeles) se mandan en bytes.
async function attachFiles(files) {
  const withPath = [];
  for (const f of files) {
    const p = wd.pathForFile(f);
    if (p) withPath.push(p);
    else if (f.type.startsWith('image/')) addPending(await wd.invoke('chat:attach-image', new Uint8Array(await f.arrayBuffer()), f.type, f.name || 'image.png').catch((err) => addError(err.message)));
  }
  if (!withPath.length) return;
  const r = await wd.invoke('chat:attach-files', withPath);
  if (r.error) addError(r.error);
  for (const att of r.attachments || []) addPending(att);
}
input.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.files || [])];
  if (!files.length) return;
  e.preventDefault();
  attachFiles(files);
});
document.addEventListener('dragover', (e) => {
  if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
  e.preventDefault();
  document.body.classList.add('dropping');
});
document.addEventListener('dragleave', (e) => {
  if (!e.relatedTarget) document.body.classList.remove('dropping');
});
document.addEventListener('drop', (e) => {
  document.body.classList.remove('dropping');
  const files = [...(e.dataTransfer?.files || [])];
  if (!files.length) return;
  e.preventDefault();
  attachFiles(files);
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    send();
  }
});
btnSend.addEventListener('click', () => (busy ? wd.invoke('chat:stop') : send()));
btnMic.addEventListener('click', () => wd.send('voice:toggle'));
$('btnNew').addEventListener('click', () => wd.invoke('chat:new'));
$('btnSettings').addEventListener('click', () => wd.invoke('win:open', 'settings'));
$('btnClose').addEventListener('click', () => wd.send('win:close-self'));
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (busy) wd.invoke('chat:stop');
    else wd.send('win:close-self');
  }
  if (e.ctrlKey && e.key.toLowerCase() === 'n') wd.invoke('chat:new');
});
window.addEventListener('focus', () => input.focus());

log.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-ext]');
  if (a) {
    e.preventDefault();
    wd.invoke('app:open-external', a.href);
    return;
  }
  const c = e.target.closest('[data-copy]');
  if (c) {
    navigator.clipboard.writeText(c.closest('.code').querySelector('code').textContent);
    c.textContent = t('md.copied');
    setTimeout(() => (c.textContent = t('md.copy')), 1200);
  }
});

// ---------------------------------------------------------------- arranque
(async () => {
  applyConfig(await wd.invoke('cfg:get'));
  const snap = await wd.invoke('chat:history');
  const trailing = renderHistory(snap.messages);
  lastSeq = snap.seq;
  if (snap.busy) {
    current = trailing || newAssistant();
    current.text += snap.partialText || '';
    setBusy(true);
    renderCurrent();
  }
  ready = true;
  for (const e of early.splice(0)) handleEvent(e);
  for (const evt of await wd.invoke('chat:pending')) addError(evt.message);
  for (const att of await wd.invoke('chat:take-attachments')) addPending(att);
  showState({ state: await wd.invoke('chat:state'), label: '' });
  input.focus();
})();
