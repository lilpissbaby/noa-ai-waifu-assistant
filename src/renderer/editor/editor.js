import { icons } from '../shared/icons.js';
import { SkinRenderer, normalizeRig, loadImage } from '../shared/skin-renderer.js';
import { Animator } from '../shared/animator.js';
import { aiCutout, colorKeyCutout, hasTransparency, trimCanvas, guessRig } from './segment.js';

const wd = window.wd;
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const editId = params.get('id');

$('btnOpen').innerHTML = `${icons.folder} Abrir archivo`;
$('dropIcon').innerHTML = icons.image;

const imgCanvas = $('img');
const overlay = $('overlay');
const stage = $('stage');

let srcCanvas = null; // imagen original (limitada)
let finalCanvas = null; // imagen recortada que se guarda
let rig = null;
let imageDirty = false;
let view = { x: 0, y: 0, s: 1 };
let history = [];

// ---------------------------------------------------------------- vista previa animada
const pv = new SkinRenderer($('preview'));
const anim = new Animator(pv);
async function refreshPreview(reloadImage = true) {
  if (!finalCanvas || !rig) return;
  if (reloadImage || !pv.skin) {
    await pv.load({ urls: { base: finalCanvas.toDataURL('image/png') }, width: finalCanvas.width, height: finalCanvas.height, rig });
  } else {
    pv.skin.rig = normalizeRig(rig, finalCanvas.width, finalCanvas.height);
  }
  pv.layout({ x: 10, y: 10, w: 230, h: 290 });
  anim.start();
  $('previewBox').classList.remove('hidden');
}
$('pvBlink').onclick = () => anim.blink();
let talking = false;
$('pvTalk').onclick = () => {
  talking = !talking;
  anim.fakeTalkUntil = talking ? performance.now() + 1e9 : 0;
  $('pvTalk').textContent = talking ? 'Callar' : 'Hablar';
};
$('preview').addEventListener('mousemove', (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  anim.cursor = { x: e.clientX - r.left, y: e.clientY - r.top };
});
$('preview').addEventListener('mouseleave', () => (anim.cursor = null));

// ---------------------------------------------------------------- utilidades
function enable(step, on = true) {
  if (on) $(step).removeAttribute('data-disabled');
  else $(step).setAttribute('data-disabled', '');
}
function status(id, text, kind = '') {
  $(id).textContent = text;
  $(id).className = `status ${kind}`;
}
function progress(p, text) {
  const box = $('progress');
  if (p == null) {
    box.classList.add('hidden');
    return;
  }
  box.classList.remove('hidden');
  box.classList.toggle('indeterminate', p < 0);
  $('bar').style.width = `${Math.max(0, p) * 100}%`;
  $('progressText').textContent = text || '';
}

function canvasFromImage(img, maxSide = 1600) {
  const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k);
  c.height = Math.round(img.naturalHeight * k);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

// ---------------------------------------------------------------- 1. cargar imagen
async function loadFromDataUrl(dataUrl, suggestedName) {
  const img = await loadImage(dataUrl);
  srcCanvas = canvasFromImage(img);
  imageDirty = true;
  history = [];
  if (suggestedName && !$('name').value) $('name').value = suggestedName.slice(0, 40);
  $('drop').classList.add('hidden');
  $('wrap').classList.remove('hidden');
  enable('step2');
  if (hasTransparency(srcCanvas)) {
    status('bgStatus', 'La imagen ya tiene fondo transparente. 👌', 'ok');
    setFinal(trimCanvas(srcCanvas));
  } else {
    status('bgStatus', 'Tiene fondo: recórtalo con IA (mejor) o por color si el fondo es liso.');
    setFinal(srcCanvas, false);
  }
}

function setFinal(canvas, trimmed = true) {
  finalCanvas = canvas;
  if (trimmed || !rig) rig = guessRig(canvas);
  draw();
  enable('step3');
  enable('step4');
  refreshPreview(true);
}

$('btnOpen').onclick = async () => {
  const r = await wd.invoke('skin:open-image');
  if (r) loadFromDataUrl(r.dataUrl, r.name);
};
$('btnUrl').onclick = async () => {
  const url = $('url').value.trim();
  if (!url) return;
  $('btnUrl').disabled = true;
  try {
    const dataUrl = await wd.invoke('skin:fetch-image', url);
    const name = decodeURIComponent(url.split('/').pop().split('?')[0]).replace(/\.\w+$/, '');
    await loadFromDataUrl(dataUrl, name);
  } catch (e) {
    alert(cleanErr(e));
  } finally {
    $('btnUrl').disabled = false;
  }
};
$('url').addEventListener('keydown', (e) => e.key === 'Enter' && $('btnUrl').click());

$('btnPaste').onclick = async () => {
  try {
    const items = await navigator.clipboard.read();
    for (const it of items) {
      const type = it.types.find((t) => t.startsWith('image/'));
      if (type) {
        const blob = await it.getType(type);
        return loadFromDataUrl(await blobToDataUrl(blob), 'pegada');
      }
    }
    alert('No hay ninguna imagen en el portapapeles.');
  } catch {
    alert('Pulsa Ctrl+V con la ventana activa para pegar la imagen.');
  }
};
window.addEventListener('paste', async (e) => {
  const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
  if (file) loadFromDataUrl(await blobToDataUrl(file), file.name.replace(/\.\w+$/, ''));
});

const blobToDataUrl = (blob) =>
  new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.readAsDataURL(blob);
  });

// arrastrar y soltar
['dragenter', 'dragover'].forEach((ev) =>
  window.addEventListener(ev, (e) => {
    e.preventDefault();
    $('drop').classList.add('over');
  }),
);
['dragleave', 'drop'].forEach((ev) => window.addEventListener(ev, () => $('drop').classList.remove('over')));
window.addEventListener('drop', async (e) => {
  e.preventDefault();
  const file = [...(e.dataTransfer?.files || [])].find((f) => f.type.startsWith('image/'));
  if (file) return loadFromDataUrl(await blobToDataUrl(file), file.name.replace(/\.\w+$/, ''));
  const url = e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain');
  if (url && /^https?:/.test(url)) {
    $('url').value = url;
    $('btnUrl').click();
  }
});

// ---------------------------------------------------------------- 2. fondo
$('btnAi').onclick = async () => {
  if (!srcCanvas) return;
  const btns = ['btnAi', 'btnKey', 'btnKeep'].map($);
  btns.forEach((b) => (b.disabled = true));
  try {
    let st = await wd.invoke('skin:model-status');
    if (!st.ready) {
      if (!confirm(`El recorte con IA usa un modelo especializado en anime (${st.sizeMB} MB). Se descarga una sola vez. ¿Descargarlo ahora?`)) return;
      progress(0, 'Descargando modelo… 0 %');
      const off = wd.on('skin:model-progress', (p) => progress(p, `Descargando modelo… ${Math.round(p * 100)} %`));
      try {
        st = await wd.invoke('skin:model-download');
      } finally {
        off();
      }
    }
    progress(-1, 'Preparando…');
    const t0 = performance.now();
    const out = await aiCutout(srcCanvas, st.url, (s) => progress(-1, s));
    history.push(finalCanvas);
    imageDirty = true;
    setFinal(trimCanvas(out));
    status('bgStatus', `Recorte listo en ${((performance.now() - t0) / 1000).toFixed(1)} s. Si algo sobra o falta, prueba por color.`, 'ok');
  } catch (e) {
    console.error(e);
    status('bgStatus', `No se pudo recortar: ${cleanErr(e)}`, 'err');
  } finally {
    progress(null);
    btns.forEach((b) => (b.disabled = false));
  }
};

$('btnKey').onclick = () => {
  if (!srcCanvas) return;
  history.push(finalCanvas);
  imageDirty = true;
  const out = colorKeyCutout(srcCanvas, Number($('tol').value));
  setFinal(trimCanvas(out));
  status('bgStatus', 'Fondo por color quitado. Ajusta la tolerancia y repite si hace falta.', 'ok');
};
$('tol').addEventListener('change', () => {
  if (history.length && $('bgStatus').textContent.includes('color')) $('btnKey').click();
});
$('btnKeep').onclick = () => {
  if (!srcCanvas) return;
  history.push(finalCanvas);
  imageDirty = true;
  setFinal(hasTransparency(srcCanvas) ? trimCanvas(srcCanvas) : srcCanvas);
  status('bgStatus', 'Se usa la imagen tal cual (el fondo se verá en el escritorio).');
};
$('btnUndo').onclick = () => {
  const prev = history.pop();
  if (prev) setFinal(prev);
};

// ---------------------------------------------------------------- 3. marcadores
function fit() {
  if (!finalCanvas) return;
  const r = stage.getBoundingClientRect();
  const pad = 40;
  const s = Math.min((r.width - pad * 2 - 270) / finalCanvas.width, (r.height - pad * 2) / finalCanvas.height);
  view = { s, x: pad + (r.width - 270 - pad * 2 - finalCanvas.width * s) / 2, y: (r.height - finalCanvas.height * s) / 2 };
}

function draw() {
  if (!finalCanvas) return;
  fit();
  const dpr = window.devicePixelRatio || 1;
  const r = stage.getBoundingClientRect();
  imgCanvas.width = r.width * dpr;
  imgCanvas.height = r.height * dpr;
  const ctx = imgCanvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, r.width, r.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(finalCanvas, view.x, view.y, finalCanvas.width * view.s, finalCanvas.height * view.s);
  ctx.strokeStyle = 'rgba(182,156,255,0.35)';
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(view.x, view.y, finalCanvas.width * view.s, finalCanvas.height * view.s);
  drawOverlay();
}

const SVGNS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs, parent) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  parent?.append(el);
  return el;
}
const toScreen = (x, y) => [view.x + x * view.s, view.y + y * view.s];
const toImage = (sx, sy) => [(sx - view.x) / view.s, (sy - view.y) / view.s];

function drawOverlay() {
  overlay.innerHTML = '';
  if (!rig) return;
  const W = finalCanvas.width;
  // cuello
  const [nx, ny] = toScreen(rig.neck.x, rig.neck.y);
  const [lx] = toScreen(0, 0);
  const [rx] = toScreen(W, 0);
  const g = svg('g', { class: 'mk', 'data-kind': 'neck', 'data-part': 'center' }, overlay);
  svg('line', { x1: lx, x2: rx, y1: ny, y2: ny, stroke: '#ffc65c', 'stroke-width': 1.5, 'stroke-dasharray': '6 5', opacity: 0.8 }, g);
  svg('line', { x1: lx, x2: rx, y1: ny, y2: ny, stroke: 'transparent', 'stroke-width': 12 }, g);
  svg('circle', { cx: nx, cy: ny, r: 8, fill: '#ffc65c', stroke: '#1a0b14', 'stroke-width': 2 }, g);
  label('cuello / giro', nx + 12, ny - 8);

  // ojos
  rig.eyes.forEach((e, i) => {
    const [cx, cy] = toScreen(e.x, e.y);
    const rw = (e.w * view.s) / 2;
    const rh = (e.h * view.s) / 2;
    const ge = svg('g', { class: 'mk', 'data-kind': `eye${i}`, 'data-part': 'center' }, overlay);
    svg('ellipse', { cx, cy, rx: rw, ry: rh, fill: 'rgba(255,79,154,0.14)', stroke: '#ff4f9a', 'stroke-width': 2 }, ge);
    svg('circle', { cx, cy, r: 3, fill: '#ff4f9a' }, ge);
    const hx = cx + rw * 0.7071;
    const hy = cy + rh * 0.7071;
    svg('circle', { cx: hx, cy: hy, r: 6, fill: '#fff', stroke: '#ff4f9a', 'stroke-width': 2, class: 'handle', 'data-kind': `eye${i}`, 'data-part': 'size' }, overlay);
    label(i === 0 ? 'ojo' : 'ojo', cx - rw, cy - rh - 6);
  });

  // boca
  const m = rig.mouth;
  const [mx, my] = toScreen(m.x, m.y);
  const mw = (m.w * view.s) / 2;
  const gm = svg('g', { class: 'mk', 'data-kind': 'mouth', 'data-part': 'center' }, overlay);
  svg('line', { x1: mx - mw, x2: mx + mw, y1: my, y2: my, stroke: '#5cdcff', 'stroke-width': 3, 'stroke-linecap': 'round' }, gm);
  svg('circle', { cx: mx, cy: my, r: 6, fill: '#5cdcff', stroke: '#1a0b14', 'stroke-width': 2 }, gm);
  svg('circle', { cx: mx + mw, cy: my, r: 5, fill: '#fff', stroke: '#5cdcff', 'stroke-width': 2, class: 'handle-ew', 'data-kind': 'mouth', 'data-part': 'size' }, overlay);
  label('boca', mx + mw + 8, my + 4);
}
function label(text, x, y) {
  const t = svg('text', { x, y, class: 'mk-label' }, overlay);
  t.textContent = text;
}

let dragging = null;
overlay.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('[data-kind]');
  if (!el || !rig) return;
  overlay.setPointerCapture(e.pointerId);
  const r = overlay.getBoundingClientRect();
  dragging = { kind: el.dataset.kind, part: el.dataset.part, start: toImage(e.clientX - r.left, e.clientY - r.top), orig: structuredClone(rig) };
});
overlay.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const r = overlay.getBoundingClientRect();
  const [ix, iy] = toImage(e.clientX - r.left, e.clientY - r.top);
  const dx = ix - dragging.start[0];
  const dy = iy - dragging.start[1];
  const o = dragging.orig;
  const { kind, part } = dragging;
  if (kind === 'neck') {
    rig.neck = { x: o.neck.x + dx, y: o.neck.y + dy };
  } else if (kind === 'mouth') {
    if (part === 'center') rig.mouth = { ...o.mouth, x: o.mouth.x + dx, y: o.mouth.y + dy };
    else rig.mouth = { ...o.mouth, w: Math.max(6, Math.abs(ix - o.mouth.x) * 2) };
  } else {
    const i = Number(kind.slice(3));
    const oe = o.eyes[i];
    if (part === 'center') {
      rig.eyes[i] = { ...oe, x: oe.x + dx, y: oe.y + dy };
      // mueve el otro ojo en espejo vertical si se arrastra con Shift
      if (e.shiftKey) {
        const j = 1 - i;
        rig.eyes[j] = { ...o.eyes[j], y: o.eyes[j].y + dy };
      }
    } else {
      const w = Math.max(8, (Math.abs(ix - oe.x) / 0.7071) * 2);
      const h = Math.max(8, (Math.abs(iy - oe.y) / 0.7071) * 2);
      rig.eyes[i] = { ...oe, w, h };
      if (e.altKey) rig.eyes[1 - i] = { ...o.eyes[1 - i], w, h };
    }
  }
  drawOverlay();
  refreshPreview(false);
});
overlay.addEventListener('pointerup', () => {
  dragging = null;
});

$('btnGuess').onclick = () => {
  if (!finalCanvas) return;
  rig = guessRig(finalCanvas);
  drawOverlay();
  refreshPreview(false);
};

$('lidAuto').addEventListener('change', () => {
  $('lidRow').classList.toggle('hidden', $('lidAuto').checked);
  if (!rig) return;
  if ($('lidAuto').checked) delete rig.lidColor;
  else rig.lidColor = $('lidColor').value;
  refreshPreview(false);
});
$('lidColor').addEventListener('input', () => {
  if (!rig) return;
  rig.lidColor = $('lidColor').value;
  refreshPreview(false);
});

window.addEventListener('resize', draw);

// ---------------------------------------------------------------- 4. guardar
function thumbnail() {
  const h = 260;
  const k = h / finalCanvas.height;
  const c = document.createElement('canvas');
  c.width = Math.round(finalCanvas.width * k);
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(finalCanvas, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}

async function save(use) {
  if (!finalCanvas || !rig) return;
  status('saveStatus', 'Guardando…');
  try {
    const files = { thumb: thumbnail() };
    if (imageDirty || !editId) files.base = finalCanvas.toDataURL('image/png');
    const r = (n) => Math.round(n * 10) / 10;
    const cleanRig = {
      eyes: rig.eyes.map((e) => ({ x: r(e.x), y: r(e.y), w: r(e.w), h: r(e.h) })),
      mouth: { x: r(rig.mouth.x), y: r(rig.mouth.y), w: r(rig.mouth.w) },
      neck: { x: r(rig.neck.x), y: r(rig.neck.y) },
      ...(rig.lidColor ? { lidColor: rig.lidColor } : {}),
    };
    const m = await wd.invoke('skin:save', {
      id: editId || undefined,
      name: $('name').value.trim() || 'Mi waifu',
      width: finalCanvas.width,
      height: finalCanvas.height,
      rig: cleanRig,
      files,
    });
    if (use) await wd.invoke('skin:use', m.id);
    status('saveStatus', use ? '¡Guardada y puesta en el escritorio!' : 'Guardada.', 'ok');
    imageDirty = false;
  } catch (e) {
    status('saveStatus', cleanErr(e), 'err');
  }
}
$('btnSave').onclick = () => save(true);
$('btnSaveOnly').onclick = () => save(false);

window.__wdEditor = { load: (d, n) => loadFromDataUrl(d, n), rig: () => rig };
const cleanErr = (e) => String(e?.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');

// ---------------------------------------------------------------- editar una existente
(async () => {
  if (!editId) return;
  const s = await wd.invoke('skin:get', editId);
  if (!s || s.id !== editId) return;
  $('title').textContent = 'Ajustar skin';
  $('name').value = s.name;
  const img = await loadImage(s.urls.base);
  srcCanvas = canvasFromImage(img, 4096);
  finalCanvas = srcCanvas;
  rig = structuredClone(s.rig || guessRig(finalCanvas));
  if (rig.lidColor) {
    $('lidAuto').checked = false;
    $('lidColor').value = rig.lidColor;
    $('lidRow').classList.remove('hidden');
  }
  $('drop').classList.add('hidden');
  $('wrap').classList.remove('hidden');
  ['step2', 'step3', 'step4'].forEach((s2) => enable(s2));
  status('bgStatus', 'Imagen ya recortada.');
  draw();
  refreshPreview(true);
})();
