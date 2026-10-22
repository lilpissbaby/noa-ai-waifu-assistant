// Recorte de fondo para personajes anime.
//  - IA: modelo ISNet entrenado para anime (SkyTNT/anime-segmentation, Apache-2.0) con onnxruntime-web.
//  - Clásico: "varita mágica" desde los bordes por similitud de color.

const ORT_BASE = 'app://local/bundle/node_modules/onnxruntime-web/dist/';
let ortP = null;
let sessionP = null;

async function getOrt() {
  if (!ortP) {
    ortP = import(`${ORT_BASE}ort.wasm.min.mjs`).then((ort) => {
      ort.env.wasm.wasmPaths = ORT_BASE;
      ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1)) : 1;
      return ort;
    });
  }
  return ortP;
}

export async function loadSegmenter(modelUrl) {
  if (!sessionP) {
    sessionP = (async () => {
      const ort = await getOrt();
      const session = await ort.InferenceSession.create(modelUrl, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      return { ort, session };
    })().catch((e) => {
      sessionP = null;
      throw e;
    });
  }
  return sessionP;
}

const SIZE = 1024;

// Devuelve un canvas nuevo con el canal alfa sustituido por la máscara del modelo.
export async function aiCutout(srcCanvas, modelUrl, onStage) {
  onStage?.('loadingModel');
  const { ort, session } = await loadSegmenter(modelUrl);
  onStage?.('analyzing');
  const tmp = document.createElement('canvas');
  tmp.width = SIZE;
  tmp.height = SIZE;
  const tctx = tmp.getContext('2d', { willReadFrequently: true });
  // fondo blanco bajo zonas transparentes para no confundir al modelo
  tctx.fillStyle = '#fff';
  tctx.fillRect(0, 0, SIZE, SIZE);
  tctx.imageSmoothingQuality = 'high';
  tctx.drawImage(srcCanvas, 0, 0, SIZE, SIZE);
  const px = tctx.getImageData(0, 0, SIZE, SIZE).data;
  let max = 1;
  for (let i = 0; i < px.length; i += 4) max = Math.max(max, px[i], px[i + 1], px[i + 2]);
  const mean = [0.485, 0.456, 0.406];
  const plane = SIZE * SIZE;
  const input = new Float32Array(3 * plane);
  for (let i = 0, p = 0; p < plane; i += 4, p++) {
    input[p] = px[i] / max - mean[0];
    input[plane + p] = px[i + 1] / max - mean[1];
    input[2 * plane + p] = px[i + 2] / max - mean[2];
  }
  const feeds = { [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]) };
  const out = await session.run(feeds);
  const pred = out[session.outputNames[0]].data;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < plane; i++) {
    const v = pred[i];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  onStage?.('applying');
  const mask = document.createElement('canvas');
  mask.width = SIZE;
  mask.height = SIZE;
  const mctx = mask.getContext('2d');
  const md = mctx.createImageData(SIZE, SIZE);
  const span = hi - lo || 1;
  for (let i = 0; i < plane; i++) {
    const v = (pred[i] - lo) / span;
    // ligera curva para bordes limpios pero suaves
    const a = Math.max(0, Math.min(1, (v - 0.12) / 0.76));
    md.data[i * 4 + 3] = Math.round(a * 255);
  }
  mctx.putImageData(md, 0, 0);
  return applyMask(srcCanvas, mask);
}

function applyMask(srcCanvas, maskCanvas) {
  const w = srcCanvas.width;
  const h = srcCanvas.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(srcCanvas, 0, 0);
  // escalar máscara al tamaño original
  const m = document.createElement('canvas');
  m.width = w;
  m.height = h;
  const mctx = m.getContext('2d', { willReadFrequently: true });
  mctx.imageSmoothingQuality = 'high';
  mctx.drawImage(maskCanvas, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const mask = mctx.getImageData(0, 0, w, h).data;
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = Math.min(img.data[i], mask[i]);
  ctx.putImageData(img, 0, 0);
  return out;
}

// Varita mágica desde los bordes: borra el fondo de color uniforme.
export function colorKeyCutout(srcCanvas, tolerance = 32) {
  const w = srcCanvas.width;
  const h = srcCanvas.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(srcCanvas, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  // color de referencia: mediana de los bordes
  const samples = [];
  const sample = (x, y) => {
    const i = (y * w + x) * 4;
    samples.push([d[i], d[i + 1], d[i + 2]]);
  };
  for (let x = 0; x < w; x += Math.max(1, (w / 64) | 0)) {
    sample(x, 0);
    sample(x, h - 1);
  }
  for (let y = 0; y < h; y += Math.max(1, (h / 64) | 0)) {
    sample(0, y);
    sample(w - 1, y);
  }
  const med = [0, 1, 2].map((c) => samples.map((s) => s[c]).sort((a, b) => a - b)[samples.length >> 1]);
  const tol2 = tolerance * tolerance * 3;
  const dist2 = (i) => (d[i] - med[0]) ** 2 + (d[i + 1] - med[1]) ** 2 + (d[i + 2] - med[2]) ** 2;
  // 0 = sin visitar, 1 = en cola, 2 = fondo, 3 = figura
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let sp = 0;
  const push = (p) => {
    if (seen[p] === 0) {
      seen[p] = 1;
      stack[sp++] = p;
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push(x + (h - 1) * w);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (sp > 0) {
    const p = stack[--sp];
    const i = p * 4;
    if (d[i + 3] > 10 && dist2(i) > tol2) {
      seen[p] = 3;
      continue;
    }
    seen[p] = 2;
    const x = p % w;
    const y = (p / w) | 0;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (y > 0) push(p - w);
    if (y < h - 1) push(p + w);
  }
  for (let p = 0; p < w * h; p++) {
    if (seen[p] === 2) d[p * 4 + 3] = 0;
  }
  // suaviza el borde: píxeles opacos junto a fondo pierden algo de alfa según su parecido al fondo
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (seen[p] === 2) continue;
      if (seen[p - 1] === 2 || seen[p + 1] === 2 || seen[p - w] === 2 || seen[p + w] === 2) {
        const i = p * 4;
        const k = Math.min(1, Math.sqrt(dist2(i) / tol2) / 2.2);
        d[i + 3] = Math.round(d[i + 3] * (0.35 + 0.65 * k));
      }
    }
  ctx.putImageData(img, 0, 0);
  return out;
}

export function hasTransparency(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { width: w, height: h } = canvas;
  const d = ctx.getImageData(0, 0, w, h).data;
  let border = 0;
  let clear = 0;
  const check = (x, y) => {
    border++;
    if (d[(y * w + x) * 4 + 3] < 40) clear++;
  };
  for (let x = 0; x < w; x += 4) {
    check(x, 0);
    check(x, h - 1);
  }
  for (let y = 0; y < h; y += 4) {
    check(0, y);
    check(w - 1, y);
  }
  return clear / border > 0.6;
}

// Recorta márgenes transparentes y limita el tamaño.
export function trimCanvas(canvas, maxSide = 1400, pad = 0.03) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { width: w, height: h } = canvas;
  const d = ctx.getImageData(0, 0, w, h).data;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (d[(y * w + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return canvas;
  const pw = Math.round((x1 - x0) * pad);
  const ph = Math.round((y1 - y0) * pad);
  x0 = Math.max(0, x0 - pw);
  y0 = Math.max(0, y0 - ph);
  x1 = Math.min(w - 1, x1 + pw);
  y1 = Math.min(h - 1, y1); // abajo sin margen: se apoya en el borde
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  const k = Math.min(1, maxSide / Math.max(cw, ch));
  const out = document.createElement('canvas');
  out.width = Math.round(cw * k);
  out.height = Math.round(ch * k);
  const octx = out.getContext('2d');
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(canvas, x0, y0, cw, ch, 0, 0, out.width, out.height);
  return out;
}

// Suposición inicial del rig: busca la cara por tono de piel y los ojos como huecos dentro de ella.
export function guessRig(canvas) {
  const W = canvas.width;
  const H = canvas.height;
  const k = Math.min(1, 220 / W);
  const w = Math.max(8, Math.round(W * k));
  const h = Math.max(8, Math.round(H * k));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const N = w * h;
  const skin = new Uint8Array(N);
  for (let p = 0; p < N; p++) {
    const i = p * 4;
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const a = d[i + 3];
    // piel de ilustración: clara, cálida, poco saturada
    if (a > 200 && r > 150 && r >= g && g >= b - 12 && r - b >= 10 && r - b <= 110 && r - g <= 70) skin[p] = 1;
  }
  // componentes conexas de piel; nos quedamos con la mayor de la mitad superior
  const label = new Int32Array(N).fill(-1);
  const stack = new Int32Array(N);
  let best = null;
  for (let p0 = 0; p0 < N; p0++) {
    if (!skin[p0] || label[p0] >= 0) continue;
    let sp = 0;
    stack[sp++] = p0;
    label[p0] = p0;
    const comp = { area: 0, x0: w, x1: 0, y0: h, y1: 0, rows: new Map(), id: p0 };
    while (sp) {
      const p = stack[--sp];
      const x = p % w;
      const y = (p / w) | 0;
      comp.area++;
      if (x < comp.x0) comp.x0 = x;
      if (x > comp.x1) comp.x1 = x;
      if (y < comp.y0) comp.y0 = y;
      if (y > comp.y1) comp.y1 = y;
      const row = comp.rows.get(y) || [x, x];
      row[0] = Math.min(row[0], x);
      row[1] = Math.max(row[1], x);
      comp.rows.set(y, row);
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1])
        if (q >= 0 && skin[q] && label[q] < 0) {
          label[q] = p0;
          stack[sp++] = q;
        }
    }
    const cy = (comp.y0 + comp.y1) / 2;
    if (comp.area > N * 0.004 && cy < h * 0.75 && (!best || comp.area > best.area)) best = comp;
  }
  if (!best) return proportionalRig(canvas);

  // fila más ancha = mejillas; la barbilla es la última fila ancha (se toleran huecos cortos, p. ej. los ojos)
  let maxW = 0;
  let maxY = best.y0;
  for (const [y, [a, b]] of best.rows)
    if (b - a > maxW) {
      maxW = b - a;
      maxY = y;
    }
  let chin = maxY;
  let gap = 0;
  const gapAllowed = Math.max(3, Math.round(h * 0.025));
  for (let y = maxY; y <= best.y1; y++) {
    const r = best.rows.get(y);
    if (r && r[1] - r[0] >= maxW * 0.45) {
      chin = y;
      gap = 0;
    } else if (++gap > gapAllowed) break;
  }
  const faceTop = best.y0;
  const fh = Math.max(4, chin - faceTop);
  const [fx0, fx1] = best.rows.get(maxY);
  const fcx = (fx0 + fx1) / 2;
  const fw = fx1 - fx0;

  // huecos (no piel) dentro de la cara, entre el 15 % y el 70 % de su altura: candidatos a ojos
  const yA = Math.round(faceTop + fh * 0.12);
  const yB = Math.round(faceTop + fh * 0.7);
  const xA = Math.round(fx0 + fw * 0.06);
  const xB = Math.round(fx1 - fw * 0.06);
  const seen = new Uint8Array(N);
  const holes = [];
  for (let y = yA; y <= yB; y++)
    for (let x = xA; x <= xB; x++) {
      const p0 = y * w + x;
      if (skin[p0] || seen[p0] || d[p0 * 4 + 3] < 200) continue;
      let sp = 0;
      stack[sp++] = p0;
      seen[p0] = 1;
      const hb = { area: 0, x0: x, x1: x, y0: y, y1: y, touchesTop: false };
      while (sp) {
        const p = stack[--sp];
        const px = p % w;
        const py = (p / w) | 0;
        hb.area++;
        hb.x0 = Math.min(hb.x0, px);
        hb.x1 = Math.max(hb.x1, px);
        hb.y0 = Math.min(hb.y0, py);
        hb.y1 = Math.max(hb.y1, py);
        if (py <= yA) hb.touchesTop = true;
        for (const q of [px > xA ? p - 1 : -1, px < xB ? p + 1 : -1, py > yA ? p - w : -1, py < yB ? p + w : -1])
          if (q >= 0 && !skin[q] && !seen[q] && d[q * 4 + 3] >= 200) {
            seen[q] = 1;
            stack[sp++] = q;
          }
      }
      const bw = hb.x1 - hb.x0 + 1;
      const bh = hb.y1 - hb.y0 + 1;
      if (hb.area > fw * fh * 0.004 && bw < fw * 0.45 && bh < fh * 0.5 && !(hb.touchesTop && bh > fh * 0.3)) holes.push({ ...hb, cx: (hb.x0 + hb.x1) / 2, cy: (hb.y0 + hb.y1) / 2, bw, bh });
    }
  // par de huecos a izquierda y derecha del centro, a altura parecida
  let pair = null;
  let bestScore = -Infinity;
  const left = holes.filter((o) => o.cx < fcx);
  const right = holes.filter((o) => o.cx > fcx);
  for (const a of left)
    for (const b of right) {
      const dy = Math.abs(a.cy - b.cy);
      const sym = Math.abs(fcx - a.cx - (b.cx - fcx));
      const score = a.area + b.area - dy * fw * 0.4 - sym * fh * 0.2;
      if (dy < fh * 0.15 && score > bestScore) {
        bestScore = score;
        pair = [a, b];
      }
    }
  const inv = 1 / k;
  let eyes;
  if (pair) {
    eyes = pair.map((e) => ({
      x: Math.round(e.cx * inv),
      y: Math.round(e.cy * inv),
      w: Math.round(Math.max(e.bw, fw * 0.16) * 1.25 * inv),
      h: Math.round(Math.max(e.bh, fw * 0.16) * 1.2 * inv),
    }));
  } else {
    const ey = faceTop + fh * 0.42;
    const ew = fw * 0.34;
    eyes = [
      { x: Math.round((fcx - fw * 0.25) * inv), y: Math.round(ey * inv), w: Math.round(ew * inv), h: Math.round(ew * 1.12 * inv) },
      { x: Math.round((fcx + fw * 0.25) * inv), y: Math.round(ey * inv), w: Math.round(ew * inv), h: Math.round(ew * 1.12 * inv) },
    ];
  }
  const eyeBottom = Math.max(...eyes.map((e) => e.y + e.h / 2)) * k;
  const mouthY = Math.max(eyeBottom + fh * 0.12, faceTop + fh * 0.78);
  return {
    eyes,
    mouth: { x: Math.round(fcx * inv), y: Math.round(Math.min(mouthY, chin - fh * 0.08) * inv), w: Math.round(fw * 0.13 * inv) },
    neck: { x: Math.round(fcx * inv), y: Math.round((chin + fh * 0.04) * inv) },
  };
}

// Sin cara detectable: proporciones típicas de un busto anime.
function proportionalRig(canvas) {
  const W = canvas.width;
  const H = canvas.height;
  const headH = H * 0.5;
  const ew = W * 0.12;
  return {
    eyes: [
      { x: Math.round(W * 0.4), y: Math.round(headH * 0.62), w: Math.round(ew), h: Math.round(ew * 1.15) },
      { x: Math.round(W * 0.6), y: Math.round(headH * 0.62), w: Math.round(ew), h: Math.round(ew * 1.15) },
    ],
    mouth: { x: Math.round(W / 2), y: Math.round(headH * 0.86), w: Math.round(W * 0.06) },
    neck: { x: Math.round(W / 2), y: Math.round(headH) },
  };
}
