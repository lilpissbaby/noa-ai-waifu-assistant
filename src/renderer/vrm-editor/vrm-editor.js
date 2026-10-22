// Editor de skins 3D: importar un VRM (archivo o URL), ver su licencia, ajustar el encuadre,
// probar estados, caras y gestos, y guardarlo como skin.
import { icons } from '../shared/icons.js';
import { Behaviour } from '../shared/behaviour.js';
import { Stage } from '../shared/stage.js';
import { normalizeFraming } from '../shared/vrm/framing.js';
import { t, setLocale } from '../../shared/i18n/index.js';
import { applyDom } from '../../shared/i18n/dom.js';

const wd = window.wd;
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const editId = params.get('id');
const MAX_MB = 150;

$('emptyIcon').innerHTML = icons.sparkle;

let renderer = null;
const behaviour = new Behaviour();
const stage = new Stage(null, behaviour);
let model = null; // { url, tmpId?, copyFrom?, meta, version, builtin }
let framing = normalizeFraming();
let loadStatus = null;
let saveStatus = null;
let motionStatus = null;


const cleanErr = (e) => String(e?.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
const enable = (id, on = true) => (on ? $(id).removeAttribute('data-disabled') : $(id).setAttribute('data-disabled', ''));

// Avisos guardados como clave + variables para retraducirlos al cambiar de idioma.
function status(id, key, kind = '', vars) {
  const memo = key ? { key, kind, vars } : null;
  if (id === 'loadStatus') loadStatus = memo;
  else if (id === 'motionStatus') motionStatus = memo;
  else saveStatus = memo;
  $(id).textContent = key ? (key.startsWith('!') ? key.slice(1) : t(key, vars)) : '';
  $(id).className = `status ${kind}`;
}

// ---------------------------------------------------------------- vista previa
async function ensureRenderer() {
  if (renderer) return renderer;
  const { VrmRenderer } = await import('../shared/vrm/vrm-renderer.js');
  renderer = new VrmRenderer($('preview'));
  stage.renderer = renderer;
  return renderer;
}

function layoutPreview() {
  if (!renderer?.vrm) return;
  const box = $('stage').getBoundingClientRect();
  const h = Math.max(240, Math.min(box.height - 90, 680));
  const w = Math.round(Math.min(box.width - 60, h * renderer.aspect));
  const cv = $('preview');
  cv.style.width = `${w}px`;
  cv.style.height = `${h}px`;
  renderer.layout({ x: 0, y: 0, w, h });
}
window.addEventListener('resize', layoutPreview);

$('preview').addEventListener('mousemove', (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  behaviour.cursor = { x: e.clientX - r.left, y: e.clientY - r.top };
});
$('preview').addEventListener('mouseleave', () => (behaviour.cursor = null));

async function showModel(next) {
  status('loadStatus', 'vrmEditor.loading');
  try {
    const r = await ensureRenderer();
    await r.load({ urls: { model: next.url }, framing });
    model = next;
    $('empty').classList.add('hidden');
    $('frame').classList.remove('hidden');
    layoutPreview();
    stage.start();
    renderLicense();
    paintFraming();
    ['step2', 'step3', 'step4', 'stepMotions', 'step5'].forEach((s) => enable(s));
    renderMotions();
    applyAssignToPreview();
    $('builtinNote').classList.toggle('hidden', !next.builtin);
    status('loadStatus', 'vrmEditor.loaded', 'ok', { title: next.meta?.title || '—', version: next.version || '?' });
  } catch (e) {
    console.warn('vrm', e);
    status('loadStatus', 'vrmEditor.errors.load', 'err', { error: cleanErr(e) });
  }
}

// Respuesta de skin:open-vrm / skin:fetch-vrm: { tmpId, url, name, version, meta } | { error } | null.
async function fromStaged(r) {
  if (!r) return;
  if (r.error) return status('loadStatus', `vrmEditor.errors.${r.error}`, 'err', { mb: MAX_MB });
  if (!$('name').value) $('name').value = String(r.name || '').slice(0, 40);
  await showModel({ url: r.url, tmpId: r.tmpId, meta: r.meta, version: r.version, builtin: false });
}

$('btnOpen').onclick = async () => fromStaged(await wd.invoke('skin:open-vrm'));
// Para las pruebas automáticas (tools/automation).
window.__wdVrmEditor = {
  behaviour,
  stage,
  fromStaged,
  get renderer() {
    return renderer;
  },
  get model() {
    return model;
  },
};
$('btnUrl').onclick = async () => {
  const url = $('url').value.trim();
  if (!url) return;
  $('btnUrl').disabled = true;
  status('loadStatus', 'vrmEditor.loading');
  try {
    await fromStaged(await wd.invoke('skin:fetch-vrm', url));
  } catch (e) {
    status('loadStatus', 'vrmEditor.errors.load', 'err', { error: cleanErr(e) });
  } finally {
    $('btnUrl').disabled = false;
  }
};
$('url').addEventListener('keydown', (e) => e.key === 'Enter' && $('btnUrl').click());

// ---------------------------------------------------------------- licencia
const VALUE_KEYS = new Set(['everyone', 'onlyAuthor', 'onlySeparatelyLicensedPerson', 'personalNonProfit', 'personalProfit', 'corporation', 'prohibited', 'allowModification', 'allowModificationRedistribution', 'required', 'unnecessary', 'Everyone', 'OnlyAuthor', 'ExplicitlyLicensedPerson', 'Allow', 'Disallow']);
const BAD = new Set(['onlyAuthor', 'onlySeparatelyLicensedPerson', 'prohibited', 'OnlyAuthor', 'ExplicitlyLicensedPerson', 'Disallow', 'Redistribution_Prohibited']);

function licenseRows(meta) {
  const L = meta?.license || {};
  const rows = [
    ['title', meta?.title],
    ['authors', (meta?.authors || []).join(', ')],
    ['avatar', L.avatarPermission ?? L.allowedUserName],
    ['commercial', L.commercialUsage ?? L.commercialUssageName],
    ['redistribution', typeof L.allowRedistribution === 'boolean' ? L.allowRedistribution : undefined],
    ['modification', L.modification],
    ['credit', L.creditNotation],
    ['name', L.licenseName],
    ['url', L.licenseUrl || L.otherLicenseUrl],
  ];
  return rows.filter(([k, v]) => v !== undefined && v !== '' && !(k === 'redistribution' && v === undefined));
}

function renderLicense() {
  const dl = $('license');
  dl.innerHTML = '';
  for (const [key, value] of licenseRows(model?.meta)) {
    const dt = document.createElement('dt');
    dt.textContent = t(`vrmEditor.license.${key}`);
    const dd = document.createElement('dd');
    if (key === 'url' && /^https?:\/\//.test(value)) {
      const a = document.createElement('a');
      a.textContent = value.replace(/^https?:\/\//, '');
      a.onclick = () => wd.invoke('app:open-external', value);
      dd.append(a);
    } else if (typeof value === 'boolean') {
      dd.textContent = t(value ? 'vrmEditor.license.yes' : 'vrmEditor.license.no');
      dd.className = value ? 'yes' : 'no';
    } else {
      dd.textContent = VALUE_KEYS.has(value) ? t(`vrmEditor.value.${value}`) : String(value);
      if (BAD.has(value)) dd.className = 'no';
    }
    dl.append(dt, dd);
  }
  if (!dl.children.length) {
    const dd = document.createElement('dd');
    dd.textContent = t('vrmEditor.license.unknown');
    dl.append(dd);
  }
}

// ---------------------------------------------------------------- encuadre
function paintFraming() {
  for (const b of $('presets').querySelectorAll('[data-preset]')) b.classList.toggle('on', b.dataset.preset === framing.preset);
  for (const k of ['zoom', 'yaw', 'pitch', 'offsetY']) $(k).value = framing[k];
}
function setFraming(patch) {
  framing = normalizeFraming({ ...framing, ...patch });
  renderer?.setFraming(framing);
  paintFraming();
  layoutPreview();
}
$('presets').addEventListener('click', (e) => {
  const b = e.target.closest('[data-preset]');
  if (b) setFraming({ preset: b.dataset.preset });
});
for (const k of ['zoom', 'yaw', 'pitch', 'offsetY']) $(k).addEventListener('input', () => setFraming({ [k]: Number($(k).value) }));

// ---------------------------------------------------------------- probar
let testState = 'idle';
function chip(parent, label, onclick, key) {
  const b = document.createElement('button');
  b.className = 'btn tiny';
  b.dataset.i18n = key;
  b.textContent = label;
  b.onclick = onclick;
  parent.append(b);
  return b;
}
function paintStates() {
  for (const b of $('states').children) b.classList.toggle('on', b.dataset.state === testState);
}
for (const s of ['idle', 'thinking', 'listening', 'working', 'talking']) {
  const b = chip(
    $('states'),
    '',
    () => {
      testState = s;
      behaviour.state = s;
      behaviour.fakeTalkUntil = s === 'talking' ? performance.now() + 1e9 : 0;
      paintStates();
    },
    `vrmEditor.state.${s}`,
  );
  b.dataset.state = s;
}
for (const e of ['happy', 'sad', 'angry', 'surprised', 'relaxed']) chip($('emotions'), '', () => behaviour.setEmotion(e), `vrmEditor.emotion.${e}`);
chip($('gestures'), '', () => behaviour.trigger('greet'), 'vrmEditor.gesture.greet');
paintStates();

// ---------------------------------------------------------------- movimientos importados
const SLOTS = ['idle', 'thinking', 'listening', 'working', 'talking', 'greet', 'happy', 'talkGesture'];

const slotOf = (assign, id) => SLOTS.find((k) => (Array.isArray(assign[k]) ? assign[k].includes(id) : assign[k] === id)) || '';

async function assignMotion(id, slot) {
  const assign = structuredClone((await wd.invoke('cfg:get')).config.motions?.assign || {});
  for (const k of SLOTS) {
    if (Array.isArray(assign[k])) assign[k] = assign[k].filter((x) => x !== id);
    else if (assign[k] === id) assign[k] = null;
  }
  if (slot === 'talkGesture') assign.talkGesture = [...(assign.talkGesture || []), id];
  else if (slot) assign[slot] = id;
  await wd.invoke('cfg:patch', { motions: { assign } });
  await applyAssignToPreview();
}

async function applyAssignToPreview() {
  if (!renderer?.vrm) return;
  const pc = await wd.invoke('cfg:get');
  await renderer.setMotionAssign(pc.config.motions?.assign || {}, await wd.invoke('skin:motions-list'));
}

async function loadForPreview(m) {
  const { loadMotionFile } = await import('../shared/vrm/import-clip.js');
  return loadMotionFile(m.url, m.format, renderer.vrm, m.name);
}

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'onclick' || k === 'onchange') e[k] = v;
    else if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v);
  }
  e.append(...kids.filter(Boolean));
  return e;
}

async function renderMotions() {
  const list = await wd.invoke('skin:motions-list');
  const assign = (await wd.invoke('cfg:get')).config.motions?.assign || {};
  const box = $('motionList');
  box.innerHTML = '';
  if (!list.length) box.append(el('small', { class: 'muted', text: t('vrmEditor.motions.none') }));
  for (const m of list) {
    const select = el('select', { onchange: (e) => assignMotion(m.id, e.target.value) });
    select.append(el('option', { value: '', text: t('vrmEditor.motions.unassigned') }));
    for (const k of SLOTS) select.append(el('option', { value: k, text: t(`vrmEditor.motions.slot.${k}`) }));
    select.value = slotOf(assign, m.id);
    const info = [m.duration ? t('vrmEditor.motions.duration', { seconds: m.duration.toFixed(1) }) : '', m.missingBones?.length ? t('vrmEditor.motions.missing', { count: m.missingBones.length }) : ''].filter(Boolean).join(' · ');
    box.append(
      el(
        'div',
        { class: 'motion' },
        el('div', { class: 'top' }, el('strong', { text: m.name, title: m.name }), el('small', { class: 'muted', text: `${m.format.toUpperCase()}${info ? ` · ${info}` : ''}` })),
        el(
          'div',
          { class: 'row' },
          select,
          el('button', {
            class: 'btn tiny',
            text: t('vrmEditor.motions.try'),
            onclick: async () => {
              try {
                renderer.player.play((await loadForPreview(m)).motion);
              } catch (e) {
                status('motionStatus', motionError(e), 'err', { error: cleanErr(e), mb: 30 });
              }
            },
          }),
          el('button', {
            class: 'btn tiny ghost danger',
            text: t('vrmEditor.motions.delete'),
            onclick: async () => {
              await wd.invoke('skin:motion-delete', m.id);
              await renderMotions();
              await applyAssignToPreview();
            },
          }),
        ),
      ),
    );
  }
}

const motionError = (e) => (e?.code ? `vrmEditor.motions.errors.${e.code}` : 'vrmEditor.motions.errors.load');

$('btnMotion').onclick = async () => {
  const entry = await wd.invoke('skin:motion-import');
  if (!entry) return;
  if (entry.error) return status('motionStatus', `vrmEditor.motions.errors.${entry.error}`, 'err', { mb: 30 });
  try {
    const r = await loadForPreview(entry);
    await wd.invoke('skin:motion-update', entry.id, { duration: r.duration, missingBones: r.missingBones });
    renderer.player.play(r.motion);
    status('motionStatus', 'vrmEditor.motions.imported', 'ok', { name: entry.name });
  } catch (e) {
    await wd.invoke('skin:motion-delete', entry.id);
    status('motionStatus', motionError(e), 'err', { error: cleanErr(e) });
  }
  await renderMotions();
};
wd.on('skin:motions-changed', () => model && renderMotions());

// ---------------------------------------------------------------- guardar
async function save(use) {
  if (!model || !renderer) return;
  status('saveStatus', 'vrmEditor.saving');
  try {
    const thumb = renderer.snapshot(200, 260);
    const m = await wd.invoke('skin:save-vrm', {
      id: editId || undefined,
      tmpId: model.tmpId,
      copyFrom: model.builtin ? model.copyFrom : undefined,
      name: $('name').value.trim() || t('vrmEditor.defaultName'),
      framing,
      thumb,
    });
    // Lo guardado ya es una skin propia: se sigue editando esa.
    model = { ...model, tmpId: undefined, builtin: false, copyFrom: undefined };
    if (m.id !== editId) history.replaceState(null, '', `?id=${encodeURIComponent(m.id)}`);
    $('builtinNote').classList.add('hidden');
    if (use) await wd.invoke('skin:use', m.id);
    status('saveStatus', use ? 'vrmEditor.savedUsed' : 'vrmEditor.saved', 'ok');
  } catch (e) {
    status('saveStatus', `!${cleanErr(e)}`, 'err');
  }
}
$('btnSave').onclick = () => save(true);
$('btnSaveOnly').onclick = () => save(false);

// ---------------------------------------------------------------- idioma
function applyLocale(locale) {
  setLocale(locale);
  applyDom();
  document.title = t('vrmEditor.windowTitle');
  $('btnOpen').innerHTML = `${icons.folder} `;
  $('btnOpen').append(t('vrmEditor.open'));
  if (editId) $('title').textContent = t('vrmEditor.titleEdit');
  for (const [id, memo] of [
    ['loadStatus', loadStatus],
    ['saveStatus', saveStatus],
    ['motionStatus', motionStatus],
  ])
    if (memo) status(id, memo.key, memo.kind, memo.vars);
  if (model) {
    renderLicense();
    renderMotions();
  }
}
wd.on('cfg:changed', (pc) => applyLocale(pc.locale));
// Si ya estaba abierta y se pide otra skin (Ajustes → Ajustar), se recarga con ella.
wd.on('win:query', (q) => {
  const next = new URLSearchParams(q || {}).toString();
  if (next !== params.toString()) location.search = next;
});

// ---------------------------------------------------------------- arranque / editar una existente
(async () => {
  applyLocale((await wd.invoke('cfg:get')).locale);
  if (!editId) return;
  const s = await wd.invoke('skin:get', editId);
  if (!s || s.id !== editId || s.type !== 'vrm') return;
  $('name').value = s.name;
  framing = normalizeFraming(s.framing);
  await showModel({ url: s.urls.model, meta: s.meta, version: s.meta?.version, builtin: s.builtin, copyFrom: s.builtin ? s.id : undefined });
})();
