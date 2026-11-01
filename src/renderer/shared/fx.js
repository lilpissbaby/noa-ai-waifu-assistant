// Efectos «manga» alrededor de la cabeza (corazones, gota de sudor, vena de enfado, interrogación,
// Zzz…) en un canvas 2D encima del avatar. Valen para cualquier skin: el renderizador da dónde está
// la cabeza (fxAnchors) y Behaviour qué efectos tocan (signals.fx). Todo se calcula a partir del
// tiempo, sin estado: cada efecto es una función de (anclas, peso, t).

const TAU = Math.PI * 2;

// Pseudoaleatorio estable a partir de un texto/número (para que cada aparición tenga su variación).
function hash(n) {
  let x = 0;
  for (const ch of String(n)) x = Math.imul(x ^ ch.charCodeAt(0), 0x9e3779b1);
  x ^= x >>> 15;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
}

const OUTLINE = 'rgba(30, 18, 34, 0.9)';

function sticker(ctx, draw, { fill, line = OUTLINE, lw = 2.2, glow = null }) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw();
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 8;
  }
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = lw;
  ctx.strokeStyle = line;
  ctx.stroke();
  ctx.restore();
}

function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.8, y - s * 1.1, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.8, y - s * 1.1, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
  ctx.closePath();
}

function starPath(ctx, x, y, r, points = 4, inner = 0.38, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = rot - Math.PI / 2 + (i * Math.PI) / points;
    const rr = i % 2 ? r * inner : r;
    ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function dropPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.bezierCurveTo(x + s * 0.2, y - s * 0.4, x + s * 0.75, y, x + s * 0.7, y + s * 0.45);
  ctx.arc(x, y + s * 0.45, s * 0.7, 0, Math.PI);
  ctx.bezierCurveTo(x - s * 0.75, y, x - s * 0.2, y - s * 0.4, x, y - s);
  ctx.closePath();
}

function cloudPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.arc(x - s * 0.55, y + s * 0.1, s * 0.5, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(x - s * 0.1, y - s * 0.3, s * 0.55, Math.PI, Math.PI * 1.9);
  ctx.arc(x + s * 0.5, y, s * 0.5, Math.PI * 1.4, Math.PI * 0.5);
  ctx.closePath();
}

function text(ctx, str, x, y, size, fill, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.font = `900 ${size}px "Segoe UI Black", "Arial Black", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size * 0.18);
  ctx.strokeStyle = OUTLINE;
  ctx.strokeText(str, 0, 0);
  ctx.fillStyle = fill;
  ctx.fillText(str, 0, 0);
  ctx.restore();
}

const pop = (t, d = 0.25) => {
  const u = Math.min(1, Math.max(0, t / d));
  return u < 1 ? 1 + Math.sin(u * Math.PI) * 0.25 - (1 - u) * 0.6 : 1;
};

// Cada efecto: (ctx, a, w, t, seed). a = { x, y, r, eyes, cheeks }: centro y radio de la cabeza (px CSS).
export const EFFECTS = {
  hearts(ctx, a, w, t, seed) {
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.55 + i / 3 + seed) % 1;
      const side = i % 2 ? 1 : -1;
      const x = a.x + side * a.r * (0.95 + 0.15 * Math.sin((p + i) * TAU)) + Math.sin(p * TAU * 1.5) * a.r * 0.08;
      const y = a.y - a.r * 0.2 - p * a.r * 1.3;
      ctx.globalAlpha = w * Math.min(1, p * 5, (1 - p) * 3);
      const s = a.r * (0.16 + 0.05 * (i === 0));
      sticker(ctx, () => heartPath(ctx, x, y, s), { fill: '#ff4f8b', glow: 'rgba(255,79,139,0.6)' });
    }
  },
  sparkles(ctx, a, w, t, seed) {
    for (let i = 0; i < 5; i++) {
      const ang = -Math.PI * 0.95 + (i / 4) * Math.PI * 0.9 + seed;
      const d = a.r * (1.25 + 0.15 * Math.sin(i * 2.3));
      const tw = Math.abs(Math.sin(t * 3.2 + i * 1.7));
      ctx.globalAlpha = w * (0.35 + 0.65 * tw);
      sticker(ctx, () => starPath(ctx, a.x + Math.cos(ang) * d, a.y + Math.sin(ang) * d * 0.9, a.r * (0.08 + 0.08 * tw)), { fill: '#fff6b8', line: 'rgba(160,110,20,0.85)', lw: 1.4, glow: 'rgba(255,240,150,0.9)' });
    }
  },
  blush(ctx, a, w) {
    if (!a.cheeks) return;
    for (const [x, y] of a.cheeks) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, a.r * 0.32);
      g.addColorStop(0, 'rgba(255, 95, 134, 0.55)');
      g.addColorStop(1, 'rgba(255, 95, 134, 0)');
      ctx.globalAlpha = w;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, a.r * 0.32, a.r * 0.15, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(224, 60, 110, 0.75)';
      ctx.lineWidth = Math.max(1.2, a.r * 0.03);
      ctx.lineCap = 'round';
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(x + k * a.r * 0.1 - a.r * 0.04, y + a.r * 0.05);
        ctx.lineTo(x + k * a.r * 0.1 + a.r * 0.04, y - a.r * 0.05);
        ctx.stroke();
      }
    }
  },
  notes(ctx, a, w, t, seed) {
    for (let i = 0; i < 2; i++) {
      const p = (t * 0.45 + i * 0.5 + seed) % 1;
      const x = a.x + a.r * (1.0 + p * 0.5) + Math.sin(p * TAU * 2) * a.r * 0.1;
      const y = a.y - a.r * (0.1 + p * 1.2);
      ctx.globalAlpha = w * Math.min(1, p * 5, (1 - p) * 3);
      text(ctx, i ? '♫' : '♪', x, y, a.r * 0.5, i ? '#8fd3ff' : '#ffb2e0', Math.sin(p * TAU) * 0.3);
    }
  },
  flowers(ctx, a, w, t, seed) {
    for (let i = 0; i < 4; i++) {
      const ang = -Math.PI * 0.9 + (i / 3) * Math.PI * 0.8 + seed * 2;
      const d = a.r * 1.2;
      const x = a.x + Math.cos(ang) * d;
      const y = a.y + Math.sin(ang) * d * 0.9;
      const s = a.r * 0.12 * pop(t - i * 0.12) * (0.85 + 0.15 * Math.sin(t * 2 + i));
      if (!(s > 0)) continue;
      ctx.globalAlpha = w;
      for (let k = 0; k < 5; k++) {
        const pa = (k / 5) * TAU + t * 0.6;
        sticker(ctx, () => {
          ctx.beginPath();
          ctx.ellipse(x + Math.cos(pa) * s, y + Math.sin(pa) * s, s * 0.75, s * 0.55, pa, 0, TAU);
        }, { fill: ['#ffc2dd', '#fff1a8', '#c8e9ff', '#d9c8ff'][i], lw: 1.2 });
      }
      sticker(ctx, () => {
        ctx.beginPath();
        ctx.arc(x, y, s * 0.45, 0, TAU);
      }, { fill: '#ffd45a', lw: 1.2 });
    }
  },
  sigh(ctx, a, w, t) {
    const p = (t * 0.5) % 1;
    const x = a.x + a.r * (0.55 + p * 0.6);
    const y = a.y + a.r * (0.45 - p * 0.15);
    ctx.globalAlpha = w * Math.min(1, p * 6, (1 - p) * 1.5);
    sticker(ctx, () => cloudPath(ctx, x, y, a.r * (0.16 + p * 0.14)), { fill: 'rgba(255,255,255,0.95)', line: 'rgba(120,120,150,0.8)', lw: 1.6 });
  },
  zzz(ctx, a, w, t) {
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.35 + i / 3) % 1;
      ctx.globalAlpha = w * Math.min(1, p * 4, (1 - p) * 2.5);
      text(ctx, 'Z', a.x + a.r * (0.7 + p * 0.7), a.y - a.r * (0.6 + p * 1.0), a.r * (0.25 + p * 0.25), '#cbb8ff', -0.2);
    }
  },
  dots(ctx, a, w, t) {
    const x = a.x + a.r * 1.05;
    const y = a.y - a.r * 1.05;
    ctx.globalAlpha = w;
    sticker(ctx, () => {
      ctx.beginPath();
      ctx.ellipse(x, y, a.r * 0.5, a.r * 0.3, 0, 0, TAU);
    }, { fill: '#ffffff' });
    sticker(ctx, () => {
      ctx.beginPath();
      ctx.arc(x - a.r * 0.42, y + a.r * 0.36, a.r * 0.08, 0, TAU);
    }, { fill: '#ffffff', lw: 1.6 });
    const n = Math.floor(t * 2.5) % 4;
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = w * (i < n ? 1 : 0.2);
      ctx.fillStyle = '#5b4a7a';
      ctx.beginPath();
      ctx.arc(x + (i - 1) * a.r * 0.18, y, a.r * 0.06, 0, TAU);
      ctx.fill();
    }
  },
  question(ctx, a, w, t) {
    ctx.globalAlpha = w;
    text(ctx, '?', a.x + a.r * 1.05, a.y - a.r * (0.95 + Math.sin(t * 3) * 0.06), a.r * 0.7 * pop(t), '#7fd8ff', 0.15 + Math.sin(t * 2) * 0.1);
    if (t > 0.3) text(ctx, '?', a.x + a.r * 1.45, a.y - a.r * 0.6, a.r * 0.4 * pop(t - 0.3), '#7fd8ff', -0.2);
  },
  exclaim(ctx, a, w, t) {
    ctx.globalAlpha = w;
    text(ctx, '!', a.x + a.r * 1.0, a.y - a.r * 1.0, a.r * 0.8 * pop(t, 0.18), '#ffd45a', 0.12);
  },
  shock(ctx, a, w, t) {
    ctx.globalAlpha = w;
    text(ctx, '!!', a.x + a.r * 1.05, a.y - a.r * 1.0, a.r * 0.7 * pop(t, 0.15), '#ff6b7d', 0.1);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = Math.max(2, a.r * 0.05);
    ctx.lineCap = 'round';
    const k = 1 + 0.08 * Math.sin(t * 20);
    for (let i = 0; i < 7; i++) {
      const ang = -Math.PI + (i / 6) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(a.x + Math.cos(ang) * a.r * 1.2 * k, a.y + Math.sin(ang) * a.r * 1.15 * k);
      ctx.lineTo(a.x + Math.cos(ang) * a.r * 1.45 * k, a.y + Math.sin(ang) * a.r * 1.4 * k);
      ctx.stroke();
    }
  },
  gloom(ctx, a, w) {
    const x0 = a.x - a.r * 0.6;
    const top = a.y - a.r * 0.85;
    const g = ctx.createLinearGradient(0, top, 0, top + a.r * 0.75);
    g.addColorStop(0, 'rgba(92, 70, 170, 0.75)');
    g.addColorStop(1, 'rgba(92, 70, 170, 0)');
    ctx.globalAlpha = w;
    ctx.strokeStyle = g;
    ctx.lineWidth = Math.max(1.5, a.r * 0.04);
    for (let i = 0; i < 9; i++) {
      const x = x0 + (i / 8) * a.r * 1.2;
      ctx.beginPath();
      ctx.moveTo(x, top + (i % 2) * a.r * 0.06);
      ctx.lineTo(x, top + a.r * (0.55 + (i % 3) * 0.08));
      ctx.stroke();
    }
  },
  sweat(ctx, a, w, t) {
    const p = (t * 0.6) % 1;
    const x = a.x + a.r * 0.95;
    const y = a.y - a.r * (0.55 - p * 0.25);
    ctx.globalAlpha = w * Math.min(1, p * 6, (1 - p) * 4);
    sticker(ctx, () => dropPath(ctx, x, y, a.r * 0.17), { fill: '#bfe7ff', line: '#3d8fd0', lw: 2 });
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.ellipse(x - a.r * 0.04, y + a.r * 0.06, a.r * 0.03, a.r * 0.05, -0.3, 0, TAU);
    ctx.fill();
  },
  tears(ctx, a, w, t) {
    const eyes = a.eyes || [
      [a.x - a.r * 0.35, a.y],
      [a.x + a.r * 0.35, a.y],
    ];
    eyes.forEach(([ex, ey], i) => {
      const side = i ? 1 : -1;
      for (let k = 0; k < 2; k++) {
        const p = (t * 0.9 + k * 0.5 + i * 0.25) % 1;
        ctx.globalAlpha = w * Math.min(1, p * 5, (1 - p) * 3);
        sticker(ctx, () => dropPath(ctx, ex + side * a.r * 0.18, ey + a.r * (0.12 + p * 0.55), a.r * 0.09), { fill: '#cdeeff', line: '#4a9bd6', lw: 1.6 });
      }
    });
  },
  puff(ctx, a, w, t) {
    for (let i = 0; i < 2; i++) {
      const p = (t * 0.7 + i * 0.5) % 1;
      const side = i ? 1 : -1;
      const x = a.x + side * a.r * (0.75 + p * 0.35);
      const y = a.y - a.r * (0.8 + p * 0.45);
      ctx.globalAlpha = w * Math.min(1, p * 5, (1 - p) * 2);
      sticker(ctx, () => cloudPath(ctx, x, y, a.r * (0.14 + p * 0.1)), { fill: '#ffffff', line: 'rgba(120,120,150,0.8)', lw: 1.6 });
    }
  },
  anger(ctx, a, w, t) {
    const x = a.x + a.r * 0.75;
    const y = a.y - a.r * 0.8;
    const s = a.r * 0.22 * (1 + 0.12 * Math.sin(t * 9)) * pop(t, 0.2);
    ctx.globalAlpha = w;
    ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      const ang = k * (Math.PI / 2) + Math.PI / 4;
      const cx = x + Math.cos(ang) * s * 0.55;
      const cy = y + Math.sin(ang) * s * 0.55;
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.45, ang + Math.PI * 0.75, ang + Math.PI * 1.25);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = s * 0.42;
      ctx.stroke();
      ctx.strokeStyle = '#ff3b4f';
      ctx.lineWidth = s * 0.26;
      ctx.stroke();
    }
  },
  fire(ctx, a, w, t) {
    for (const side of [-1, 1]) {
      const x = a.x + side * a.r * 1.15;
      const y = a.y - a.r * 0.2;
      const f = 1 + 0.12 * Math.sin(t * 14 + side);
      const s = a.r * 0.3 * f;
      ctx.globalAlpha = w;
      sticker(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(x, y - s * 1.6);
        ctx.bezierCurveTo(x + s * 0.9, y - s * 0.6, x + s * 0.8, y + s * 0.6, x, y + s * 0.7);
        ctx.bezierCurveTo(x - s * 0.8, y + s * 0.6, x - s * 0.9, y - s * 0.3, x - s * 0.2, y - s * 0.8);
        ctx.quadraticCurveTo(x - s * 0.05, y - s * 0.3, x, y - s * 1.6);
        ctx.closePath();
      }, { fill: '#ff7a2f', glow: 'rgba(255,140,40,0.8)' });
      ctx.fillStyle = '#ffe07a';
      ctx.beginPath();
      ctx.ellipse(x, y + s * 0.2, s * 0.32, s * 0.45, 0, 0, TAU);
      ctx.fill();
    }
  },
  stars(ctx, a, w, t) {
    for (let i = 0; i < 3; i++) {
      const ang = t * 3 + (i * TAU) / 3;
      const x = a.x + Math.cos(ang) * a.r * 0.75;
      const y = a.y - a.r * 0.95 + Math.sin(ang) * a.r * 0.2;
      ctx.globalAlpha = w * (Math.sin(ang) > -0.3 ? 1 : 0.55);
      sticker(ctx, () => starPath(ctx, x, y, a.r * 0.14, 5, 0.45, ang), { fill: '#ffe066', lw: 1.6 });
    }
  },
  bulb(ctx, a, w, t) {
    const x = a.x + a.r * 0.15;
    const y = a.y - a.r * 1.45;
    const s = a.r * 0.28 * pop(t, 0.2);
    ctx.globalAlpha = w;
    ctx.strokeStyle = 'rgba(255, 220, 90, 0.9)';
    ctx.lineWidth = Math.max(2, a.r * 0.05);
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const ang = -Math.PI * 0.9 + (i / 4) * Math.PI * 0.8;
      const k = 1.5 + 0.15 * Math.sin(t * 8 + i);
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(ang) * s * 1.25, y + Math.sin(ang) * s * 1.25);
      ctx.lineTo(x + Math.cos(ang) * s * k * 1.2, y + Math.sin(ang) * s * k * 1.2);
      ctx.stroke();
    }
    sticker(ctx, () => {
      ctx.beginPath();
      ctx.arc(x, y, s, Math.PI * 0.8, Math.PI * 2.2);
      ctx.lineTo(x + s * 0.4, y + s * 1.1);
      ctx.lineTo(x - s * 0.4, y + s * 1.1);
      ctx.closePath();
    }, { fill: '#fff3a0', glow: 'rgba(255,230,120,0.95)' });
    sticker(ctx, () => {
      ctx.beginPath();
      ctx.rect(x - s * 0.42, y + s * 1.1, s * 0.84, s * 0.4);
    }, { fill: '#9aa3b8', lw: 1.6 });
  },
};

export const FX_NAMES = Object.keys(EFFECTS);

export class FxLayer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.enabled = true;
    this.drawn = false;
    this.bounds = null; // recuadro (px CSS) de lo último que se dibujó, para la silueta en Linux
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(this.canvas.clientWidth * dpr);
    const h = Math.round(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    return dpr;
  }

  // Sin efectos, además de borrar se oculta el canvas: así nunca se queda en pantalla un fotograma viejo
  // (Chromium a veces no vuelve a componer un canvas 2D que solo se ha borrado).
  clear() {
    if (!this.drawn) return;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvas.style.visibility = 'hidden';
    this.drawn = false;
    this.bounds = null;
  }

  // signals.fx = [{ id, w, t, key }]; renderer.fxAnchors() = { x, y, r, eyes?, cheeks?, skip? }.
  render(signals, renderer) {
    const list = this.enabled ? (signals?.fx || []).filter((e) => e.w > 0.01 && EFFECTS[e.id]) : [];
    if (!list.length) return this.clear();
    const a = renderer?.fxAnchors?.(signals);
    if (!a || !(a.r > 0)) return this.clear();
    const dpr = this.resize();
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const done = new Set();
    for (const e of list) {
      if (a.skip?.has(e.id) || done.has(e.id)) continue;
      done.add(e.id);
      ctx.save();
      try {
        EFFECTS[e.id](ctx, a, Math.min(1, e.w), e.t, hash(`${e.key}:${e.id}`));
      } catch (err) {
        console.warn('fx', e.id, err?.message || err);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    if (!this.drawn) this.canvas.style.visibility = 'visible';
    this.drawn = true;
    this.bounds = { x: Math.floor(a.x - a.r * 1.9), y: Math.floor(a.y - a.r * 2.1), width: Math.ceil(a.r * 3.8), height: Math.ceil(a.r * 3.1) };
  }
}
