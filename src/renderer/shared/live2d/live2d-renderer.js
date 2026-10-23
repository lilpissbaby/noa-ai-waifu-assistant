// Renderizador de skins Live2D (modelos de VTuber) con la misma interfaz que SkinRenderer y
// VrmRenderer. Lo mueve como VTube Studio: señales de Behaviour → entradas de seguimiento →
// parámetros del modelo (con su .vtube.json o los estándar de Cubism). Sin ticker propio: dibuja
// cuando lo pide Stage, y la máscara de opacidad se captura justo después.
import { loadLive2dRuntime } from './runtime.js';
import { HitMask } from '../vrm/hit-mask.js';
import { vtsInputs } from './vts-inputs.js';
import { parseVtsConfig, VtsMapper, standardMapping } from './vts-mapping.js';
import { autoAssignExpressions } from './expressions.js';
import { framing2d, aspect2d, normalizeFraming2d } from './framing2d.js';

const EMOTION_ON = 0.4;
const EMOTION_OFF = 0.15;
// Con una expresión puesta, la sonrisa y las cejas las lleva la expresión.
const EXPRESSION_INPUTS = new Set(['MouthSmile', 'Brows', 'BrowLeftY', 'BrowRightY', 'VoiceFrequencyPlusMouthSmile']);

// Recuadro de lo dibujado (el lienzo del modelo suele tener mucho margen vacío).
function measureContent(im) {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  const n = im.getDrawableIDs().length;
  for (let i = 0; i < n; i++) {
    const b = im.getDrawableBounds(i);
    if (!(b.width > 0 && b.height > 0)) continue;
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.width);
    y1 = Math.max(y1, b.y + b.height);
  }
  if (!Number.isFinite(x0)) return { left: 0, top: 0, width: im.originalWidth || im.width, height: im.originalHeight || im.height };
  return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
}

const fetchJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
};

export class Live2DRenderer {
  constructor(canvas) {
    this.kind = 'live2d';
    this.canvas = canvas;
    this.mask = new HitMask();
    this.box = { x: 0, y: 0, w: 1, h: 1 };
    this.framing = normalizeFraming2d();
    this.app = null;
    this.model = null;
    this.skin = null;
    this.signals = null;
    this.params = new Map();
    this.expressionOf = {};
    this.activeEmotion = null;
    this.head = null;
    this.busy = false;
    this.renderMs = [];
  }

  get aspect() {
    return this.bounds ? aspect2d(this.bounds, this.framing) : 0.75;
  }

  async load(skin) {
    const core = await window.wd.invoke('live2d:core-status');
    if (!core?.ready) throw Object.assign(new Error('Live2D Cubism Core is not installed'), { code: 'live2dCore' });
    const { PIXI, live2d } = await loadLive2dRuntime(core.url);
    if (!this.app) {
      if (!Live2DRenderer.pluginAdded) {
        PIXI.extensions.add(live2d.Live2DPlugin);
        Live2DRenderer.pluginAdded = true;
      }
      this.app = new PIXI.Application();
      await this.app.init({
        canvas: this.canvas,
        backgroundAlpha: 0,
        preference: 'webgl',
        antialias: true,
        autoStart: false,
        sharedTicker: false,
        resolution: Math.min(window.devicePixelRatio || 1, 1.5),
        width: Math.max(1, this.canvas.clientWidth),
        height: Math.max(1, this.canvas.clientHeight),
      });
      this.app.ticker?.stop();
    }
    const model3 = await fetchJson(skin.urls.model);
    const vts = skin.urls.vts ? await fetchJson(skin.urls.vts).catch(() => null) : null;
    const model = await live2d.Live2DModel.from(skin.urls.model, { autoUpdate: false, autoFocus: false, autoHitTest: false });
    if (this.model) {
      this.app.stage.removeChild(this.model);
      this.model.destroy({ children: true });
    }
    this.model = model;
    model.anchor.set(0, 0);
    this.app.stage.addChild(model);
    this.content = measureContent(model.internalModel);
    this.bounds = { width: this.content.width, height: this.content.height };

    const config = parseVtsConfig(vts);
    this.mapper = config.params.length ? new VtsMapper(config) : standardMapping(model3);
    this.inputsOf = new Map(this.mapper.config.params.map((p) => [p.output, p.input]));
    const expressionNames = (model3.FileReferences?.Expressions || []).map((e) => e.Name).filter(Boolean);
    this.expressionOf = { ...autoAssignExpressions(expressionNames), ...(skin.expressions || {}) };
    for (const [k, v] of Object.entries(this.expressionOf)) if (!expressionNames.includes(v)) delete this.expressionOf[k];
    this.expressionNames = expressionNames;
    const groups = Object.keys(model3.FileReferences?.Motions || {});
    this.greetGroup = groups.find((g) => /^(tap|greet|wave)/i.test(g)) || null;
    this.activeEmotion = null;

    // Los parámetros calculados se escriben después de motion/parpadeo/física y antes de dibujar.
    const core3 = model.internalModel.coreModel;
    model.internalModel.on('beforeModelUpdate', () => {
      for (const [id, v] of this.params) core3.setParameterValueById(id, v);
    });

    this.skin = { ...skin, framing: normalizeFraming2d(skin.framing) };
    this.setFraming(this.skin.framing);
    return this.skin;
  }

  // Lista de parámetros del modelo (para el editor): [{ id, min, max, value }]
  parameters() {
    const core = this.model?.internalModel?.coreModel;
    if (!core) return [];
    const raw = core.getModel?.()?.parameters;
    if (!raw) return [];
    return Array.from({ length: raw.count }, (_, i) => ({ id: raw.ids[i], min: raw.minimumValues[i], max: raw.maximumValues[i], value: raw.values[i] }));
  }

  setOverride(id, value) {
    this.overrides ||= new Map();
    if (value == null) this.overrides.delete(id);
    else this.overrides.set(id, value);
  }

  setFraming(framing) {
    this.framing = normalizeFraming2d(framing);
    this.place();
  }

  place() {
    if (!this.model || !this.bounds) return;
    const f = framing2d(this.bounds, this.framing, this.box);
    this.fit = f;
    const c = this.content;
    this.model.scale.set(f.scale);
    this.model.position.set(f.x - (c.left + c.width / 2) * f.scale, f.y - c.top * f.scale);
  }

  layout(box) {
    this.box = { ...box };
    if (this.app) this.app.renderer.resize(Math.max(1, this.canvas.clientWidth), Math.max(1, this.canvas.clientHeight));
    this.place();
  }

  apply(signals) {
    this.signals = signals;
  }

  frameInterval(s) {
    return s && (s.talking || s.hop > 0.01 || this.busy) ? 0 : 1000 / 30;
  }

  setEmotion(s) {
    const emo = s.emotion || { name: 'neutral', weight: 0 };
    const want = emo.weight >= EMOTION_ON ? this.expressionOf[emo.name] : null;
    if (want && this.activeEmotion !== want) {
      this.activeEmotion = want;
      this.model.expression(want).catch(() => {});
    } else if (!want && this.activeEmotion && emo.weight < EMOTION_OFF) {
      this.activeEmotion = null;
      this.model.internalModel.motionManager.expressionManager?.resetExpression();
    }
  }

  render(dt = 1 / 60) {
    const t0 = performance.now();
    if (!this.app) return;
    if (!this.model || !this.signals) return;
    const s = this.signals;
    if (s.events?.includes('greet') && this.greetGroup) this.model.motion(this.greetGroup, undefined, 2).catch?.(() => {});
    this.setEmotion(s);
    const params = this.mapper.apply(vtsInputs(s), dt);
    if (this.activeEmotion) for (const [id] of params) if (EXPRESSION_INPUTS.has(this.inputsOf.get(id))) params.delete(id);
    for (const [id, v] of this.overrides || []) params.set(id, v);
    this.params = params;
    this.model.update(dt * 1000);
    this.app.renderer.render(this.app.stage);
    this.updateHead();
    this.mask.maybeCapture(this.canvas, t0);
    this.renderMs.push(performance.now() - t0);
    if (this.renderMs.length > 120) this.renderMs.shift();
  }

  // Cabeza: el área «Head» del modelo si la tiene; si no, cerca de lo alto del encuadre.
  updateHead() {
    if (!this.fit) return;
    const { x, y, scale } = this.fit;
    const headY = this.bounds.height * 0.08;
    this.head = [x, Math.max(this.box.y, y + headY * scale)];
  }

  headAnchorCss() {
    return this.head;
  }

  alphaAtCss(x, y, radius = 1) {
    return this.mask.alphaAt(x, y, radius);
  }

  shapeRects(cell = 6, pad = 6) {
    return this.mask.rects(cell, pad);
  }

  snapshot(width = 200, height = 260) {
    if (!this.model) return null;
    if (!this.signals) this.signals = { t: 0, state: 'idle', breath: 0, blink: 0, mouth: 0, look: { x: 0, y: 0 }, sway: 0, tilt: 0, lift: 0, hop: 0, emotion: { name: 'neutral', weight: 0 }, talking: false, events: [] };
    this.render(0);
    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    const k = this.canvas.width / this.canvas.clientWidth;
    const { x, y, w, h } = this.box;
    const sc = Math.min(width / w, height / h);
    out.getContext('2d').drawImage(this.canvas, x * k, y * k, w * k, h * k, (width - w * sc) / 2, height - h * sc, w * sc, h * sc);
    return out.toDataURL('image/png');
  }

  avgRenderMs() {
    const a = this.renderMs;
    return a.length ? a.reduce((sum, v) => sum + v, 0) / a.length : 0;
  }

  dispose() {
    try {
      this.model?.destroy({ children: true });
    } catch {
      /* ya destruido */
    }
    this.model = null;
    try {
      this.app?.destroy({ removeView: false }, { children: true });
    } catch {
      /* contexto perdido */
    }
    this.app = null;
    this.skin = null;
  }
}
Live2DRenderer.pluginAdded = false;
