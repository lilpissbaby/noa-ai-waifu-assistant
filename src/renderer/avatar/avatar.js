import { createRenderer, loadSkinWithFallback } from '../shared/renderer-factory.js';
import { Behaviour } from '../shared/behaviour.js';
import { Stage } from '../shared/stage.js';
import { PiperClient } from './piper-client.js';
import { t, setLocale } from '../../shared/i18n/index.js';
import { applyDom } from '../../shared/i18n/dom.js';

const wd = window.wd;
let canvas = document.getElementById('stage');
const bubble = document.getElementById('bubble');
const bubbleText = document.getElementById('bubbleText');
const micEl = document.getElementById('mic');

const TOP = 58; // espacio para el bocadillo
const BASE_H = 330;
const isLinux = wd.platform === 'linux';

let renderer = null;
const behaviour = new Behaviour();
const stage = new Stage(null, behaviour);
window.__wd = {
  get renderer() {
    return stage.renderer;
  },
  behaviour,
  stage,
};
let cfg = null;
let skin = null;

// ---------------------------------------------------------------- tamaño y skin
function desiredSize() {
  const scale = cfg?.ui?.scale || 1;
  const h = Math.round(BASE_H * scale);
  const aspect = skin && renderer ? renderer.aspect : 0.75;
  const w = Math.max(Math.round(h * aspect) + 16, 210);
  return { width: w, height: h + TOP };
}

function relayout() {
  if (!renderer) return;
  renderer.layout({ x: 8, y: TOP, w: window.innerWidth - 16, h: window.innerHeight - TOP });
  // cola del bocadillo apuntando a la cabeza
  const head = skin && renderer.headAnchorCss();
  if (head) {
    const [hx] = head;
    bubble.style.setProperty('--tail-x', `${Math.max(16, Math.min(hx - bubble.offsetLeft, bubble.offsetWidth - 16))}px`);
  }
  updateShape();
}

// Si la GPU se reinicia (drivers, suspensión) se recarga la ventana para recuperar el WebGL.
function onContextLost(e) {
  e.preventDefault();
  setTimeout(() => location.reload(), 600);
}

// Devuelve un renderizador del tipo pedido. Si cambia el tipo (2D <-> VRM) se usa un canvas nuevo:
// un canvas no admite dos contextos.
async function ensureRenderer(kind) {
  if (renderer && renderer.kind === kind) return renderer;
  if (renderer) {
    const fresh = document.createElement('canvas');
    fresh.id = 'stage';
    fresh.setAttribute('aria-label', canvas.getAttribute('aria-label') || '');
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.replaceWith(fresh);
    renderer.dispose();
    canvas = fresh;
  }
  bindCanvas(canvas);
  renderer = await createRenderer(canvas, kind);
  stage.renderer = renderer;
  return renderer;
}

let loading = Promise.resolve();
function loadSkin(s) {
  loading = loading.then(() => doLoadSkin(s)).catch((e) => console.warn('skin', e));
  return loading;
}
let failCode = null;
async function doLoadSkin(s) {
  failCode = null;
  const want = s || (await wd.invoke('skin:get'));
  const r = await loadSkinWithFallback({
    skin: want,
    fallback: want.id === 'default' ? want : await wd.invoke('skin:get', 'default'),
    ensure: ensureRenderer,
    onError: (e) => {
      failCode = e?.code || null;
      console.warn(`No se pudo cargar la skin ${want.id}:`, e?.message || e);
    },
  });
  skin = r.skin;
  wd.send('avatar:resize', desiredSize());
  setTimeout(relayout, 60);
  stage.start();
  if (r.failed) {
    setState({ state: 'error', label: t(failCode === 'live2dCore' ? 'avatar.live2dCore' : 'avatar.skinFailed') });
    setTimeout(() => currentState === 'error' && setState({ state: 'idle' }), 5000);
  }
  scheduleShapeRefresh();
  await applyMotions(true); // cada modelo necesita sus movimientos importados reorientados
}

// Movimientos importados asignados a estados y gestos (solo skins 3D).
let motionsKey = '';
async function applyMotions(force = false) {
  if (renderer?.kind !== 'vrm' || !cfg) return;
  const assign = cfg.motions?.assign || {};
  const key = JSON.stringify(assign);
  if (!force && key === motionsKey && renderer.motionsApplied) return;
  motionsKey = key;
  renderer.motionsApplied = true;
  await renderer.setMotionAssign(assign, await wd.invoke('skin:motions-list'));
}
wd.on('skin:motions-changed', () => applyMotions(true));

window.addEventListener('resize', relayout);

// ---------------------------------------------------------------- estados
// Estados que muestran bocadillo (con su texto por defecto, si lo tienen).
const STATE_TEXT = {
  thinking: '',
  listening: 'avatar.listening',
  working: '',
  error: '',
};
let currentState = 'idle';
let currentLabel = '';
// Aviso en el bocadillo (recordatorios…): se queda unos segundos aunque cambie el estado.
let announceText = '';
let announceTimer = null;
function setState({ state, label }) {
  currentState = state;
  currentLabel = label || '';
  document.body.dataset.state = state;
  behaviour.state = state;
  const own = state in STATE_TEXT;
  bubble.classList.toggle('hidden', !own && !announceText);
  bubble.classList.toggle('static', state === 'error');
  bubble.classList.toggle('announce', !own && !!announceText);
  bubbleText.textContent = own ? label || (STATE_TEXT[state] ? t(STATE_TEXT[state]) : '') : announceText;
  if (state === 'idle' && prevState === 'talking') behaviour.trigger('done');
  prevState = state;
  requestAnimationFrame(relayout);
}
let prevState = 'idle';
wd.on('avatar:state', setState);
wd.on('avatar:announce', ({ text }) => {
  announceText = text.length > 160 ? `${text.slice(0, 157)}…` : text;
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    announceText = '';
    setState({ state: currentState, label: currentLabel });
  }, 12000);
  setState({ state: currentState, label: currentLabel });
  behaviour.trigger?.('happy');
});

// ---------------------------------------------------------------- ratón: arrastrar, clic, menú
let ignoring = !isLinux;
let drag = null;
let clickTimer = null;

function overInteractive(x, y) {
  if (!bubble.classList.contains('hidden')) {
    const r = bubble.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
  }
  if (!micEl.classList.contains('hidden')) {
    const r = micEl.getBoundingClientRect();
    if (x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 6 && y <= r.bottom + 6) return true;
  }
  return !!renderer && renderer.alphaAtCss(x, y, 1) > 40;
}

function setIgnore(v) {
  if (isLinux || v === ignoring) return;
  ignoring = v;
  wd.send('avatar:ignore-mouse', v);
}

window.addEventListener('mousemove', (e) => {
  if (drag) return;
  setIgnore(!overInteractive(e.clientX, e.clientY));
});
document.addEventListener('mouseleave', () => {
  if (!drag) setIgnore(true);
});

function bindCanvas(c) {
  c.addEventListener('webglcontextlost', onContextLost);
  c.addEventListener('pointerdown', onPointerDown);
  c.addEventListener('pointermove', onPointerMove);
  c.addEventListener('pointerup', onPointerUp);
}

async function onPointerDown(e) {
  if (e.button !== 0 || !overInteractive(e.clientX, e.clientY)) return;
  canvas.setPointerCapture(e.pointerId);
  const b = await wd.invoke('avatar:bounds');
  drag = { sx: e.screenX, sy: e.screenY, bx: b.x, by: b.y, moved: false };
}
function onPointerMove(e) {
  if (!drag) return;
  const dx = e.screenX - drag.sx;
  const dy = e.screenY - drag.sy;
  if (!drag.moved && Math.hypot(dx, dy) < 5) return;
  drag.moved = true;
  wd.send('avatar:move', { x: drag.bx + dx, y: drag.by + dy });
}
function onPointerUp(e) {
  if (!drag) return;
  const wasDrag = drag.moved;
  drag = null;
  canvas.releasePointerCapture(e.pointerId);
  if (wasDrag) {
    wd.send('avatar:move-end');
    return;
  }
  // clic simple = chat · doble clic = hablar
  if (clickTimer) {
    clearTimeout(clickTimer);
    clickTimer = null;
    toggleRecording();
    return;
  }
  clickTimer = setTimeout(() => {
    clickTimer = null;
    behaviour.trigger('greet');
    wd.send('avatar:click');
  }, 240);
}
window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  wd.send('avatar:context-menu');
});
bubble.addEventListener('click', () => wd.send('avatar:click'));
micEl.addEventListener('click', () => toggleRecording());

// En Linux se recorta la ventana a la silueta (no hay "click-through" con reenvío).
let shapeTimer = null;
function updateShape() {
  if (!isLinux || !renderer) return;
  clearTimeout(shapeTimer);
  shapeTimer = setTimeout(() => {
    const rects = renderer.shapeRects(6, 4);
    for (const el of [bubble, micEl]) {
      if (el.classList.contains('hidden')) continue;
      const r = el.getBoundingClientRect();
      rects.push({ x: Math.floor(r.left - 6), y: Math.floor(r.top - 6), width: Math.ceil(r.width + 12), height: Math.ceil(r.height + 14) });
    }
    wd.send('avatar:shape', rects);
  }, 50);
}

// Los VRM mueven los brazos (gestos): en Linux la silueta se recalcula a menudo.
let shapeInterval = null;
function scheduleShapeRefresh() {
  clearInterval(shapeInterval);
  if (isLinux && renderer?.kind === 'vrm') shapeInterval = setInterval(updateShape, 400);
}

// ---------------------------------------------------------------- cursor
wd.on('avatar:emotion', (name) => behaviour.setEmotion(name));
wd.on('avatar:cursor', (p) => {
  behaviour.cursor = p;
});

// ---------------------------------------------------------------- voz: grabación
let rec = null;

async function toggleRecording() {
  if (rec) return rec.stop();
  try {
    await startRecording();
  } catch (e) {
    console.error(e);
    setState({ state: 'error', label: t('avatar.noMic') });
    setTimeout(() => currentState === 'error' && setState({ state: 'idle' }), 3000);
  }
}

async function startRecording() {
  stopPlayback();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
  const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  const ctx = getAudioCtx();
  const src = ctx.createMediaStreamSource(stream);
  const an = ctx.createAnalyser();
  an.fftSize = 1024;
  src.connect(an);
  const buf = new Float32Array(an.fftSize);
  const started = performance.now();
  let speech = false;
  let lastVoice = performance.now();
  let raf = 0;
  let discard = false;
  const autoStop = cfg?.voice?.autoStopOnSilence !== false;

  const meter = () => {
    an.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += v * v;
    const rms = Math.sqrt(sum / buf.length);
    micEl.style.setProperty('--lvl', Math.min(1, rms * 9).toFixed(3));
    const now = performance.now();
    if (rms > 0.035) {
      speech = true;
      lastVoice = now;
    }
    if (autoStop && speech && now - lastVoice > 1400) return stop();
    if (!speech && now - started > 9000) {
      discard = true;
      return stop();
    }
    if (now - started > 60000) return stop();
    raf = requestAnimationFrame(meter);
  };

  const stop = () => {
    if (mr.state !== 'inactive') mr.stop();
  };
  mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  mr.onstop = async () => {
    cancelAnimationFrame(raf);
    stream.getTracks().forEach((track) => track.stop());
    src.disconnect();
    rec = null;
    micEl.classList.add('hidden');
    updateShape();
    wd.send('voice:status', { recording: false });
    if (discard || !chunks.length) {
      setState({ state: 'idle' });
      return;
    }
    const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    await wd.invoke('voice:transcribe', bytes, blob.type);
  };
  mr.start(250);
  rec = { stop };
  micEl.classList.remove('hidden');
  updateShape();
  wd.send('voice:status', { recording: true });
  raf = requestAnimationFrame(meter);
}

wd.on('voice:record-toggle', toggleRecording);

// ---------------------------------------------------------------- voz: reproducción
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

const queue = [];
let playing = null;
let analyser = null;
const levelBuf = new Float32Array(512);

behaviour.levelFn = () => {
  if (!analyser || !playing || playing.type !== 'audio') return 0;
  analyser.getFloatTimeDomainData(levelBuf);
  let sum = 0;
  for (const v of levelBuf) sum += v * v;
  const rms = Math.sqrt(sum / levelBuf.length);
  return Math.min(1, Math.max(0, (rms - 0.012) * 7));
};

function pump() {
  if (playing || !queue.length) return;
  const item = queue.shift();
  playing = item;
  if (item.type === 'audio') playAudio(item);
  else sayText(item);
}

async function playAudio(item) {
  try {
    const ctx = getAudioCtx();
    // Piper: el WAV se está sintetizando desde que llegó la frase (va por delante de la reproducción).
    if (item.audioP) item.audio = new Uint8Array(await item.audioP);
    if (playing !== item) return;
    const ab = item.audio.buffer.slice(item.audio.byteOffset, item.audio.byteOffset + item.audio.byteLength);
    const buffer = await ctx.decodeAudioData(ab);
    if (playing !== item) return;
    const srcNode = ctx.createBufferSource();
    srcNode.buffer = buffer;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    srcNode.connect(analyser);
    analyser.connect(ctx.destination);
    item.node = srcNode;
    srcNode.onended = () => finish(item);
    srcNode.start();
  } catch (e) {
    console.error('audio', e);
    finish(item);
  }
}

function sayText(item) {
  const synth = window.speechSynthesis;
  const u = new SpeechSynthesisUtterance(item.text);
  const voices = synth.getVoices();
  // Sin voz elegida: la primera del idioma de la respuesta (es, en, ru, uk, zh…).
  const lang = (item.lang || 'en').toLowerCase();
  const v = voices.find((x) => x.name === item.voice) || voices.find((x) => x.lang.toLowerCase().startsWith(lang)) || null;
  if (v) {
    u.voice = v;
    u.lang = v.lang;
  } else u.lang = item.lang || 'en';
  u.rate = Number(item.rate) || 1;
  u.pitch = Number(item.pitch) || 1;
  u.onstart = () => {
    behaviour.fakeTalkUntil = performance.now() + 60000;
  };
  u.onend = u.onerror = () => {
    behaviour.fakeTalkUntil = 0;
    finish(item);
  };
  synth.speak(u);
  // Si no hay voces instaladas onstart nunca llega: no bloquear la cola.
  setTimeout(() => {
    if (playing === item && !synth.speaking) {
      behaviour.fakeTalkUntil = 0;
      finish(item);
    }
  }, 4000);
}

function finish(item) {
  if (playing !== item) return;
  playing = null;
  if (!queue.length) behaviour.trigger('done');
  pump();
}

function stopPlayback() {
  queue.length = 0;
  if (playing?.node) {
    try {
      playing.node.stop();
    } catch {
      /* ya parado */
    }
  }
  playing = null;
  window.speechSynthesis.cancel();
  behaviour.fakeTalkUntil = 0;
}

wd.on('tts:play', ({ id, audio }) => {
  queue.push({ type: 'audio', id, audio });
  pump();
});
const piper = new PiperClient();
wd.on('tts:piper', ({ id, text, voice, runtimeUrl }) => {
  const audioP = piper.synth(text, voice, runtimeUrl);
  audioP.catch((e) => wd.send('tts:piper-error', String(e?.message || e)));
  queue.push({ type: 'audio', id, audioP });
  pump();
});
wd.on('tts:say', (item) => {
  queue.push({ type: 'say', ...item });
  pump();
});
wd.on('tts:stop', stopPlayback);

// ---------------------------------------------------------------- arranque
wd.on('skin:changed', (s) => loadSkin(s));
wd.on('cfg:changed', (pc) => {
  const prevScale = cfg?.ui?.scale;
  cfg = pc.config;
  setLocale(pc.locale);
  applyDom();
  if (skin && prevScale !== cfg.ui.scale) wd.send('avatar:resize', desiredSize());
  applyMotions();
});

(async () => {
  const pc = await wd.invoke('cfg:get');
  cfg = pc.config;
  setLocale(pc.locale);
  applyDom();
  document.body.dataset.state = 'idle';
  await loadSkin();
  const st = await wd.invoke('chat:state');
  if (st && st !== 'idle') setState({ state: st });
})();
