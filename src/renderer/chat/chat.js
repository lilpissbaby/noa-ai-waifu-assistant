import { renderMarkdown, escapeHtml } from '../shared/md.js';
import { icons } from '../shared/icons.js';

const wd = window.wd;
const $ = (id) => document.getElementById(id);
const log = $('log');
const input = $('input');
const btnSend = $('btnSend');
const btnMic = $('btnMic');
const profileSel = $('profile');
const empty = $('empty');

$('btnNew').innerHTML = icons.plus;
$('btnSettings').innerHTML = icons.settings;
$('btnClose').innerHTML = icons.close;
btnMic.innerHTML = icons.mic;
btnSend.innerHTML = icons.send;

let cfg = null;
let busy = false;
let current = null; // mensaje del asistente en curso

const TOOL_LABEL = {
  get_current_time: 'Mirar la hora',
  open_url: 'Abrir enlace',
  clipboard_read: 'Leer portapapeles',
  clipboard_write: 'Copiar al portapapeles',
  show_notification: 'Notificación',
  run_command: 'Ejecutar comando',
  hermes_task: 'Hermes',
  paperclip_list_agents: 'Paperclip · agentes',
  paperclip_list_projects: 'Paperclip · proyectos',
  paperclip_list_issues: 'Paperclip · tareas',
  paperclip_get_issue: 'Paperclip · ver tarea',
  paperclip_create_issue: 'Paperclip · crear tarea',
  paperclip_update_issue: 'Paperclip · actualizar tarea',
  paperclip_add_comment: 'Paperclip · comentar',
  paperclip_wakeup_agent: 'Paperclip · despertar agente',
};
const toolLabel = (n) => TOOL_LABEL[n] || n.replace(/^webhook_/, 'Webhook · ').replace(/^mcp_/, 'MCP · ');

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
  el.textContent = m.content;
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
  el.innerHTML = `${icons.alert}<div><div class="txt"></div><div class="err-actions"><button class="btn">Abrir ajustes</button></div></div>`;
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
  btnSend.title = v ? 'Detener' : 'Enviar (Enter)';
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
    } else if (m.role === 'assistant') {
      if (!lastAssistant) lastAssistant = newAssistant();
      for (const tc of m.toolCalls || []) addTool(lastAssistant, tc, 'run');
      if (m.content) {
        lastAssistant.text += (lastAssistant.text ? '\n\n' : '') + m.content;
        lastAssistant.body.innerHTML = renderMarkdown(lastAssistant.text);
      }
    } else if (m.role === 'tool' && lastAssistant) {
      const t = lastAssistant.tools.get(m.toolCallId);
      if (t) finishTool(t, !m.isError, m.content);
    }
  }
  updateEmpty();
  log.scrollTop = log.scrollHeight;
  return lastAssistant; // respuesta del último turno (para continuarla si sigue en curso)
}

function finishTool(t, ok, result) {
  t.el.classList.remove('run');
  t.el.querySelector('.sub').textContent = summarizeInput(t.name, t.inp);
  t.el.classList.add(ok ? 'ok' : 'err');
  t.el.querySelector('.ico').innerHTML = ok ? icons.check : icons.alert;
  t.el.querySelector('pre').textContent = `${JSON.stringify(t.inp ?? {}, null, 2)}\n\n→ ${result || ''}`;
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
      const t = current?.tools.get(e.id);
      if (t) t.el.querySelector('.sub').textContent = e.message;
      break;
    }
    case 'tool_end': {
      const t = current?.tools.get(e.id);
      if (t) finishTool(t, e.ok, e.result);
      break;
    }
    case 'done':
      if (current) {
        if (!current.text && !current.tools.size) current.el.remove();
        else renderCurrent(true);
        if (e.aborted) addNotice('Detenido');
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
    default:
      break;
  }
}

const STATE_LABEL = { idle: 'lista', thinking: 'pensando…', talking: 'respondiendo…', listening: 'escuchando…', working: 'trabajando…', error: 'error' };
wd.on('avatar:state', ({ state, label }) => {
  document.body.dataset.state = state;
  $('stateText').textContent = label || STATE_LABEL[state] || state;
});
wd.on('voice:status', ({ recording }) => btnMic.classList.toggle('active', !!recording));

// ---------------------------------------------------------------- configuración
function applyConfig(pc) {
  cfg = pc.config;
  $('assistantName').textContent = cfg.assistant.name;
  document.title = `${cfg.assistant.name} — chat`;
  $('hello').innerHTML = `Hola${cfg.assistant.userName ? `, ${escapeHtml(cfg.assistant.userName)}` : ''}. Soy <em>${escapeHtml(cfg.assistant.name)}</em>.`;
  profileSel.innerHTML = cfg.profiles
    .map((p) => `<option value="${escapeHtml(p.id)}" ${p.id === cfg.activeProfileId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`)
    .join('');
  const c = cfg.connectors;
  const sugg = [];
  if (c.paperclip.enabled) sugg.push('¿Qué tareas tienen pendientes mis agentes en Paperclip?');
  if (c.hermes.enabled) sugg.push('Pídele a Hermes que revise el estado de los contenedores del VPS');
  sugg.push('Resúmeme lo que tengo en el portapapeles');
  if (!c.paperclip.enabled && !c.hermes.enabled) sugg.push('¿Qué puedes hacer por mí?');
  $('suggest').innerHTML = '';
  for (const s of sugg.slice(0, 3)) {
    const b = document.createElement('button');
    b.textContent = s;
    b.onclick = () => send(s);
    $('suggest').append(b);
  }
  $('hint').innerHTML = `<kbd>Enter</kbd> envía · <kbd>Shift+Enter</kbd> salto · <kbd>${escapeHtml((cfg.ui.hotkeyTalk || '').replace('Control', 'Ctrl'))}</kbd> hablar`;
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
  const t = (text ?? input.value).trim();
  if (!t) return;
  input.value = '';
  autosize();
  wd.invoke('chat:send', t, 'text');
}

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
    c.textContent = '¡Copiado!';
    setTimeout(() => (c.textContent = 'Copiar'), 1200);
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
  const st = await wd.invoke('chat:state');
  document.body.dataset.state = st;
  $('stateText').textContent = STATE_LABEL[st] || st;
  input.focus();
})();
