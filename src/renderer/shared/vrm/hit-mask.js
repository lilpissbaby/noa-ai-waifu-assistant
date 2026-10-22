// Máscara de opacidad del canvas WebGL a baja resolución, para saber si el cursor está sobre la
// waifu (clic que atraviesa la ventana) y para recortar la ventana en Linux. Se captura justo
// después de dibujar, en la misma tarea, así no hace falta preserveDrawingBuffer.
export class HitMask {
  constructor(scale = 0.25, everyMs = 100) {
    this.scale = scale;
    this.everyMs = everyMs;
    this.last = -Infinity;
    this.cv = null;
    this.ctx = null;
    this.mask = null; // { w, h, cssW, cssH, alpha }
  }

  maybeCapture(glCanvas, now, force = false) {
    if (!force && now - this.last < this.everyMs) return false;
    this.last = now;
    const cssW = glCanvas.clientWidth;
    const cssH = glCanvas.clientHeight;
    if (!cssW || !cssH) return false;
    const w = Math.max(1, Math.round(cssW * this.scale));
    const h = Math.max(1, Math.round(cssH * this.scale));
    if (!this.cv) {
      this.cv = document.createElement('canvas');
      this.ctx = this.cv.getContext('2d', { willReadFrequently: true });
    }
    if (this.cv.width !== w || this.cv.height !== h) {
      this.cv.width = w;
      this.cv.height = h;
    }
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.drawImage(glCanvas, 0, 0, w, h);
    const data = this.ctx.getImageData(0, 0, w, h).data;
    const alpha = new Uint8Array(w * h);
    for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
    this.mask = { w, h, cssW, cssH, alpha };
    return true;
  }

  alphaAt(x, y, radius = 1) {
    const m = this.mask;
    if (!m) return 0;
    const mx = Math.floor((x / m.cssW) * m.w);
    const my = Math.floor((y / m.cssH) * m.h);
    let best = 0;
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++) {
        const px = mx + dx;
        const py = my + dy;
        if (px >= 0 && py >= 0 && px < m.w && py < m.h) best = Math.max(best, m.alpha[py * m.w + px]);
      }
    return best;
  }

  // Rectángulos (px CSS) que cubren la silueta, agrupando filas iguales.
  rects(cell = 6, pad = 6) {
    const m = this.mask;
    if (!m) return [];
    const out = [];
    let prev = null;
    for (let y = 0; y < m.cssH; y += cell) {
      const runs = [];
      let start = -1;
      for (let x = 0; x <= m.cssW; x += cell) {
        const on = x < m.cssW && this.alphaAt(x + cell / 2, y + cell / 2, 1) > 30;
        if (on && start < 0) start = x;
        if (!on && start >= 0) {
          runs.push([start - pad, x + pad]);
          start = -1;
        }
      }
      const key = runs.map((r) => r.join(',')).join('|');
      if (prev && prev.key === key) prev.rects.forEach((r) => (r.height += cell));
      else {
        const rs = runs.map(([a, b]) => ({ x: Math.max(0, a), y: Math.max(0, y - pad), width: b - Math.max(0, a), height: cell + pad }));
        out.push(...rs);
        prev = { key, rects: rs };
      }
    }
    return out.map((r) => ({ x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }));
  }
}
