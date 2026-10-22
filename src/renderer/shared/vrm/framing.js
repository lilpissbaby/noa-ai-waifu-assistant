// Encuadre de la cámara a partir de las medidas del modelo (en metros, mirando a +Z). Sin three.js:
// lo usan el renderizador, el editor y los tests.

export const DEFAULT_FRAMING = { preset: 'half', zoom: 1, yaw: 0, pitch: 0, offsetY: 0 };
export const PRESETS = ['full', 'half', 'bust'];
const RANGES = { zoom: [0.6, 1.6], yaw: [-45, 45], pitch: [-15, 15], offsetY: [-0.2, 0.2] };
const WIDTH_K = { full: 2.0, half: 2.8, bust: 2.6 };
const MARGIN = 1.08;

const clamp = (v, [a, b]) => Math.max(a, Math.min(b, v));

export function normalizeFraming(f) {
  const src = f && typeof f === 'object' ? f : {};
  const out = { preset: PRESETS.includes(src.preset) ? src.preset : DEFAULT_FRAMING.preset };
  for (const [k, range] of Object.entries(RANGES)) {
    const v = Number(src[k]);
    out[k] = src[k] == null || src[k] === '' || !Number.isFinite(v) ? DEFAULT_FRAMING[k] : clamp(v, range);
  }
  return out;
}

// Rango vertical [abajo, arriba] que debe verse con cada preset.
export function verticalRange(dims, preset) {
  const { top, chestY, hipsY, bottom } = dims;
  if (preset === 'full') return [bottom, top];
  if (preset === 'bust') return [chestY - 0.25 * (top - chestY), top];
  return [hipsY - 0.08 * (top - hipsY), top];
}

// dims = { top, chestY, hipsY, bottom, shoulderWidth }
export function computeFraming(dims, framing, fovDeg = 20) {
  const f = normalizeFraming(framing);
  const [low, high] = verticalRange(dims, f.preset);
  const span = Math.max(0.05, high - low);
  const height = (span * MARGIN) / f.zoom;
  const aspect = clamp((dims.shoulderWidth * WIDTH_K[f.preset]) / span, [0.42, 1.1]);
  const target = [0, (low + high) / 2 + f.offsetY * height, 0];
  const dist = height / 2 / Math.tan(((fovDeg / 2) * Math.PI) / 180);
  const p = (f.pitch * Math.PI) / 180;
  const position = [0, target[1] + dist * Math.sin(p), dist * Math.cos(p)];
  return { aspect, height, target, position };
}
