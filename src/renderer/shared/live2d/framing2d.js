// Encuadre de un modelo Live2D en el recuadro del avatar: entero, medio cuerpo (60 % superior) o
// busto (35 % superior), con zoom y desplazamiento vertical.
export const PRESETS_2D = ['full', 'half', 'bust'];
const SHOW = { full: 1, half: 0.6, bust: 0.35 };
const RANGES = { zoom: [0.6, 1.6], offsetY: [-0.2, 0.2] };
const MARGIN = 1.04;
const clamp = (v, [a, b]) => Math.max(a, Math.min(b, v));

export function normalizeFraming2d(f) {
  const src = f && typeof f === 'object' ? f : {};
  const zoom = Number(src.zoom);
  const offsetY = Number(src.offsetY);
  return {
    preset: PRESETS_2D.includes(src.preset) ? src.preset : 'half',
    zoom: src.zoom == null || src.zoom === '' || !Number.isFinite(zoom) ? 1 : clamp(zoom, RANGES.zoom),
    offsetY: src.offsetY == null || src.offsetY === '' || !Number.isFinite(offsetY) ? 0 : clamp(offsetY, RANGES.offsetY),
  };
}

// Proporción ancho/alto del recuadro que necesita el modelo con ese encuadre.
export function aspect2d(bounds, framing) {
  const f = normalizeFraming2d(framing);
  const widthK = { full: 1, half: 0.85, bust: 0.75 }[f.preset];
  return clamp((bounds.width * widthK) / (bounds.height * SHOW[f.preset]), [0.42, 1.1]);
}

// → { scale, x, y }: escala del modelo y posición de su punto superior central (ancla 0,5 / 0).
export function framing2d(bounds, framing, box) {
  const f = normalizeFraming2d(framing);
  const byHeight = box.h / (bounds.height * SHOW[f.preset] * MARGIN);
  const fit = f.preset === 'full' ? Math.min(byHeight, box.w / (bounds.width * MARGIN)) : byHeight;
  const scale = fit * f.zoom;
  const shown = bounds.height * SHOW[f.preset] * scale;
  const top = box.y + Math.max(0, (box.h - shown) / 2) * (f.preset === 'full' ? 1 : 0) + box.h * 0.02;
  return { scale, x: box.x + box.w / 2, y: top + f.offsetY * box.h };
}
