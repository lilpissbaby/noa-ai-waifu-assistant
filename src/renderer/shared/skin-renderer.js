// Renderizador WebGL2 de skins 2D con "rig" mínimo:
//  - malla deformable: respiración, giro/desplazamiento de cabeza alrededor del cuello, mandíbula
//  - parpadeo: capa "ojos cerrados" o párpado procedural dentro de los óvalos de los ojos
//  - boca: capas "boca media/abierta" o boca procedural sobre el punto de la boca
// Rig (en píxeles de la imagen): { eyes:[{x,y,w,h},{...}], mouth:{x,y,w}, neck:{x,y} }

const VS = `#version 300 es
precision highp float;
in vec2 aPos;
uniform vec2 uSize;
uniform vec2 uCanvas;
uniform vec2 uOffset;
uniform float uScale;
uniform vec2 uNeck;
uniform float uBand;
uniform float uHeadAngle;
uniform vec2 uHeadShift;
uniform float uBreath;
uniform float uBounce;
uniform vec3 uMouth;
uniform float uMouthAmt;
uniform float uJaw;
out vec2 vUv;
out vec2 vPx;
void main() {
  vec2 p = aPos;
  float cx = uSize.x * 0.5;
  float hb = clamp((uSize.y - p.y) / uSize.y, 0.0, 1.0);
  p.y -= uBreath * 0.009 * uSize.y * hb;
  float torso = smoothstep(uNeck.y, uSize.y, p.y);
  p.x = cx + (p.x - cx) * (1.0 + uBreath * 0.010 * torso * (1.0 - torso) * 4.0);
  float w = 1.0 - smoothstep(uNeck.y - uBand, uNeck.y + uBand * 0.6, p.y);
  float a = uHeadAngle * w;
  vec2 d = p - uNeck;
  float c = cos(a), s = sin(a);
  p = uNeck + vec2(c * d.x - s * d.y, s * d.x + c * d.y) + uHeadShift * w;
  if (uJaw > 0.5 && uMouthAmt > 0.0) {
    vec2 q = (aPos - uMouth.xy) / vec2(uMouth.z * 1.3, uMouth.z * 1.5);
    float f = exp(-dot(q, q) * 1.3);
    float below = smoothstep(-0.15, 0.35, (aPos.y - uMouth.y) / uMouth.z);
    p.y += uMouthAmt * uMouth.z * 0.20 * f * below;
  }
  p.y += uBounce;
  vUv = aPos / uSize;
  vPx = aPos;
  vec2 sp = p * uScale + uOffset;
  gl_Position = vec4(sp.x / uCanvas.x * 2.0 - 1.0, 1.0 - sp.y / uCanvas.y * 2.0, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vPx;
uniform sampler2D uBase;
uniform sampler2D uEyesTex;
uniform sampler2D uMouthHalfTex;
uniform sampler2D uMouthOpenTex;
uniform float uHasEyes;
uniform float uHasMouthHalf;
uniform float uHasMouthOpen;
uniform vec2 uSize;
uniform float uBlink;
uniform float uMouthAmt;
uniform vec4 uEye0;
uniform vec4 uEye1;
uniform vec3 uMouth;
uniform vec3 uLash;
uniform vec4 uLid;   // rgb + usar (a>0.5) en lugar de muestrear
uniform float uTint;
uniform vec3 uTintColor;
out vec4 outColor;

vec4 over(vec4 top, vec4 bot) { return top + bot * (1.0 - top.a); }
vec3 unpremul(vec4 c) { return c.a > 0.001 ? c.rgb / c.a : vec3(1.0, 0.85, 0.8); }

vec3 lidColor(vec4 eye) {
  if (uLid.a > 0.5) return uLid.rgb;
  vec3 acc = vec3(0.0);
  for (int i = -1; i <= 1; i++) {
    vec2 sp = vec2(eye.x + float(i) * eye.z * 0.22, eye.y + eye.w * 0.78);
    acc += unpremul(texture(uBase, sp / uSize));
  }
  return acc / 3.0;
}

vec4 blinkEye(vec4 c, vec4 eye) {
  if (eye.z <= 0.0) return c;
  vec2 d = (vPx - eye.xy) / (eye.zw * 0.5);
  float r = dot(d, d);
  if (r > 1.25) return c;
  float aa = fwidth(r) + 0.02;
  float inside = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, r);
  float top = mix(-1.15, 0.32, uBlink) + 0.22 * d.x * d.x * uBlink;
  float bottom = mix(1.15, 0.36, uBlink) + 0.10 * d.x * d.x * uBlink;
  float e = fwidth(d.y) * 1.5 + 0.01;
  float covered = max(1.0 - smoothstep(top - e, top + e, d.y), smoothstep(bottom - e, bottom + e, d.y));
  covered = max(covered, smoothstep(0.85, 1.0, uBlink));
  covered *= inside;
  vec3 skin = lidColor(eye);
  vec4 res = vec4(mix(c.rgb, skin * c.a, covered), c.a);
  float lw = 0.10 + 0.06 * uBlink;
  float lashLine = 1.0 - smoothstep(lw * 0.45, lw, abs(d.y - top));
  float lash = lashLine * (1.0 - smoothstep(0.78, 1.0, abs(d.x))) * smoothstep(0.35, 0.7, uBlink);
  res.rgb = mix(res.rgb, uLash * res.a, lash * inside);
  return res;
}

vec4 mouthProc(vec4 c) {
  float open = uMouthAmt;
  float w = uMouth.z;
  float rx = w * 0.5 * (0.62 + 0.38 * open);
  float ry = max(w * 0.40 * open, 0.75);
  vec2 center = vec2(uMouth.x, uMouth.y + ry * 0.30);
  vec2 d = (vPx - center) / vec2(rx, ry);
  if (d.y < 0.0) d.y *= 1.45;
  float r = length(d);
  float aa = fwidth(r) * 1.2 + 0.02;
  float inside = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, r);
  if (inside <= 0.0) return c;
  vec3 col = vec3(0.30, 0.07, 0.12);
  float tongue = smoothstep(0.15, 0.55, d.y + 0.25 * d.x * d.x);
  col = mix(col, vec3(0.86, 0.42, 0.50), tongue * 0.9);
  float rim = smoothstep(0.72, 0.98, r);
  col = mix(col, vec3(0.20, 0.04, 0.08), rim * 0.85);
  float a = inside * smoothstep(0.03, 0.12, open);
  return vec4(mix(c.rgb, col, a), max(c.a, a));
}

void main() {
  vec4 c = texture(uBase, vUv);
  if (uBlink > 0.002) {
    if (uHasEyes > 0.5) {
      c = over(texture(uEyesTex, vUv) * smoothstep(0.1, 0.55, uBlink), c);
    } else {
      c = blinkEye(c, uEye0);
      c = blinkEye(c, uEye1);
    }
  }
  if (uMouthAmt > 0.02) {
    if (uHasMouthOpen > 0.5) {
      if (uHasMouthHalf > 0.5 && uMouthAmt < 0.5) c = over(texture(uMouthHalfTex, vUv) * smoothstep(0.04, 0.16, uMouthAmt), c);
      else c = over(texture(uMouthOpenTex, vUv) * smoothstep(0.04, 0.2, uMouthAmt), c);
    } else {
      c = mouthProc(c);
    }
  }
  if (uTint > 0.0) c.rgb = mix(c.rgb, uTintColor * c.a, uTint);
  outColor = c;
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

export function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => res(img);
    img.onerror = () => rej(new Error(`No se pudo cargar ${String(src).slice(0, 80)}`));
    img.src = src;
  });
}

const hexToRgb = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export class SkinRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.textures = {};
    this.params = { blink: 0, mouth: 0, headAngle: 0, headX: 0, headY: 0, breath: 0, bounce: 0, tint: 0, tintColor: [1, 1, 1] };
    this.view = { x: 0, y: 0, s: 1 };
    this.skin = null;
    this.mask = null;
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true });
    if (!gl) {
      // Sin WebGL2 (GPU bloqueada, escritorio remoto…): modo 2D más sencillo.
      this.mode = '2d';
      this.ctx = canvas.getContext('2d');
      this.images = {};
      return;
    }
    this.mode = 'gl';
    this.gl = gl;
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    this.prog = prog;
    this.u = {};
    const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(prog, i);
      this.u[info.name] = gl.getUniformLocation(prog, info.name);
    }
  }

  async load(skin) {
    const gl = this.gl;
    const urls = skin.urls || {};
    const entries = await Promise.all(
      ['base', 'eyesClosed', 'mouthHalf', 'mouthOpen'].map(async (k) => [k, urls[k] ? await loadImage(urls[k]) : null]),
    );
    const imgs = Object.fromEntries(entries);
    if (!imgs.base) throw new Error('Skin has no base image');
    const W = skin.width || imgs.base.naturalWidth;
    const H = skin.height || imgs.base.naturalHeight;
    if (this.mode === '2d') {
      this.images = {};
      for (const [key, img] of Object.entries(imgs)) {
        if (!img) continue;
        const cv = document.createElement('canvas');
        cv.width = Math.round(W * Math.min(1, 1600 / Math.max(W, H)));
        cv.height = Math.round((cv.width * H) / W);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        this.images[key] = cv;
        if (key === 'base') this.buildMask(cv);
      }
      this.skin = { ...skin, width: W, height: H, rig: normalizeRig(skin.rig, W, H) };
      return this.skin;
    }
    // Textura a resolución limitada (mipmaps para que se vea fino al reducir).
    const maxSide = Math.min(2048, gl.getParameter(gl.MAX_TEXTURE_SIZE));
    const k = Math.min(1, maxSide / Math.max(W, H));
    const tw = Math.round(W * k);
    const th = Math.round(H * k);
    for (const t of Object.values(this.textures)) gl.deleteTexture(t);
    this.textures = {};
    for (const [key, img] of Object.entries(imgs)) {
      if (!img) continue;
      const cv = document.createElement('canvas');
      cv.width = tw;
      cv.height = th;
      cv.getContext('2d').drawImage(img, 0, 0, tw, th);
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.textures[key] = tex;
      if (key === 'base') this.buildMask(cv);
    }
    this.skin = { ...skin, width: W, height: H, rig: normalizeRig(skin.rig, W, H) };
    this.buildMesh(W, H);
    return this.skin;
  }

  buildMask(cv) {
    const mw = Math.min(160, cv.width);
    const mh = Math.round((cv.height / cv.width) * mw);
    const m = document.createElement('canvas');
    m.width = mw;
    m.height = mh;
    const ctx = m.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(cv, 0, 0, mw, mh);
    const data = ctx.getImageData(0, 0, mw, mh).data;
    const alpha = new Uint8Array(mw * mh);
    for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
    this.mask = { w: mw, h: mh, alpha };
  }

  buildMesh(W, H) {
    const gl = this.gl;
    const NX = 40;
    const NY = Math.max(20, Math.round((NX * H) / W));
    const verts = new Float32Array((NX + 1) * (NY + 1) * 2);
    let p = 0;
    for (let j = 0; j <= NY; j++)
      for (let i = 0; i <= NX; i++) {
        verts[p++] = (i / NX) * W;
        verts[p++] = (j / NY) * H;
      }
    const idx = new Uint32Array(NX * NY * 6);
    p = 0;
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NX; i++) {
        const a = j * (NX + 1) + i;
        const b = a + 1;
        const c = a + NX + 1;
        const d = c + 1;
        idx.set([a, b, c, b, d, c], p);
        p += 6;
      }
    if (!this.vao) {
      this.vao = gl.createVertexArray();
      this.vbo = gl.createBuffer();
      this.ibo = gl.createBuffer();
    }
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(this.prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    this.indexCount = idx.length;
  }

  // Encaja la imagen en un rectángulo (px CSS) del canvas.
  layout(box) {
    if (!this.skin) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.round(this.canvas.clientWidth * dpr);
    const ch = Math.round(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
    }
    const { width: W, height: H } = this.skin;
    const s = Math.min(box.w / W, box.h / H);
    const x = box.x + (box.w - W * s) / 2;
    const y = box.y + box.h - H * s; // apoyada abajo
    this.view = { x, y, s, dpr };
  }

  cssToImage(x, y) {
    const v = this.view;
    return [(x - v.x) / v.s, (y - v.y) / v.s];
  }
  imageToCss(ix, iy) {
    const v = this.view;
    return [ix * v.s + v.x, iy * v.s + v.y];
  }

  alphaAtCss(x, y, radius = 1) {
    if (!this.mask || !this.skin) return 0;
    const [ix, iy] = this.cssToImage(x, y);
    const { w, h, alpha } = this.mask;
    const mx = Math.floor((ix / this.skin.width) * w);
    const my = Math.floor((iy / this.skin.height) * h);
    let best = 0;
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++) {
        const px = mx + dx;
        const py = my + dy;
        if (px >= 0 && py >= 0 && px < w && py < h) best = Math.max(best, alpha[py * w + px]);
      }
    return best;
  }

  // Rectángulos (px CSS) que cubren la silueta; para setShape en Linux.
  shapeRects(cell = 6, pad = 6) {
    if (!this.mask || !this.skin) return [];
    const v = this.view;
    const rects = [];
    const x0 = Math.max(0, Math.floor(v.x - pad));
    const y0 = Math.max(0, Math.floor(v.y - pad));
    const x1 = Math.ceil(v.x + this.skin.width * v.s + pad);
    const y1 = Math.ceil(v.y + this.skin.height * v.s);
    let prev = null;
    for (let y = y0; y < y1; y += cell) {
      const runs = [];
      let start = -1;
      for (let x = x0; x <= x1; x += cell) {
        const on = x < x1 && this.alphaAtCss(x + cell / 2, y + cell / 2, 2) > 30;
        if (on && start < 0) start = x;
        if (!on && start >= 0) {
          runs.push([start - pad, x + pad]);
          start = -1;
        }
      }
      const key = runs.map((r) => r.join(',')).join('|');
      if (prev && prev.key === key) prev.rects.forEach((r) => (r.height += cell));
      else {
        const rs = runs.map(([a, b]) => ({ x: Math.max(0, a), y: y, width: b - Math.max(0, a), height: cell }));
        rects.push(...rs);
        prev = { key, rects: rs };
      }
    }
    return rects.map((r) => ({ x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }));
  }

  render() {
    if (this.mode === '2d') return this.render2d();
    const gl = this.gl;
    const sk = this.skin;
    if (!sk) return;
    const { rig } = sk;
    const v = this.view;
    const P = this.params;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.prog);
    const u = this.u;
    const dpr = v.dpr || 1;
    gl.uniform2f(u.uSize, sk.width, sk.height);
    gl.uniform2f(u.uCanvas, this.canvas.width, this.canvas.height);
    gl.uniform2f(u.uOffset, v.x * dpr, v.y * dpr);
    gl.uniform1f(u.uScale, v.s * dpr);
    gl.uniform2f(u.uNeck, rig.neck.x, rig.neck.y);
    gl.uniform1f(u.uBand, sk.height * 0.07);
    gl.uniform1f(u.uHeadAngle, P.headAngle);
    gl.uniform2f(u.uHeadShift, P.headX, P.headY);
    gl.uniform1f(u.uBreath, P.breath);
    gl.uniform1f(u.uBounce, P.bounce);
    gl.uniform3f(u.uMouth, rig.mouth.x, rig.mouth.y, rig.mouth.w);
    gl.uniform1f(u.uMouthAmt, P.mouth);
    gl.uniform1f(u.uJaw, this.textures.mouthOpen ? 0 : 1);
    gl.uniform1f(u.uBlink, P.blink);
    const e0 = rig.eyes[0] || { x: 0, y: 0, w: 0, h: 0 };
    const e1 = rig.eyes[1] || { x: 0, y: 0, w: 0, h: 0 };
    gl.uniform4f(u.uEye0, e0.x, e0.y, e0.w, e0.h);
    gl.uniform4f(u.uEye1, e1.x, e1.y, e1.w, e1.h);
    const lash = hexToRgb(rig.lashColor) || [0.17, 0.09, 0.13];
    gl.uniform3f(u.uLash, ...lash);
    const lid = hexToRgb(rig.lidColor);
    gl.uniform4f(u.uLid, ...(lid || [0, 0, 0]), lid ? 1 : 0);
    gl.uniform1f(u.uTint, P.tint);
    gl.uniform3f(u.uTintColor, ...P.tintColor);
    const units = [
      ['base', 'uBase'],
      ['eyesClosed', 'uEyesTex', 'uHasEyes'],
      ['mouthHalf', 'uMouthHalfTex', 'uHasMouthHalf'],
      ['mouthOpen', 'uMouthOpenTex', 'uHasMouthOpen'],
    ];
    units.forEach(([key, sampler, flag], i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, this.textures[key] || this.textures.base);
      gl.uniform1i(u[sampler], i);
      if (flag) gl.uniform1f(u[flag], this.textures[key] ? 1 : 0);
    });
    gl.bindVertexArray(this.vao);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
  }
}

// Respaldo sin WebGL: balanceo de toda la figura, capas o formas sencillas para ojos y boca.
SkinRenderer.prototype.render2d = function render2d() {
  const sk = this.skin;
  const ctx = this.ctx;
  if (!sk || !ctx) return;
  const v = this.view;
  const dpr = v.dpr || 1;
  const P = this.params;
  const { rig } = sk;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  ctx.setTransform(dpr * v.s, 0, 0, dpr * v.s, dpr * v.x, dpr * v.y);
  // pivota en la base: inclinación suave + respiración + saltito
  const bx = sk.width / 2;
  const by = sk.height;
  ctx.translate(bx + P.headX * 0.4, by + P.bounce);
  ctx.rotate(P.headAngle * 0.25);
  ctx.scale(1, 1 + P.breath * 0.006);
  ctx.translate(-bx, -by);
  const draw = (img) => ctx.drawImage(img, 0, 0, sk.width, sk.height);
  draw(this.images.base);
  if (P.blink > 0.05) {
    if (this.images.eyesClosed) {
      ctx.globalAlpha = Math.min(1, P.blink * 1.6);
      draw(this.images.eyesClosed);
      ctx.globalAlpha = 1;
    } else {
      for (const e of rig.eyes) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(e.x, e.y, e.w / 2, e.h / 2, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = rig.lidColor || '#ffe3d6';
        const lid = e.y - e.h / 2 + e.h * Math.min(1, P.blink) * 0.66;
        ctx.fillRect(e.x - e.w / 2, e.y - e.h / 2, e.w, lid - (e.y - e.h / 2));
        if (P.blink > 0.85) ctx.fillRect(e.x - e.w / 2, e.y - e.h / 2, e.w, e.h);
        ctx.restore();
        if (P.blink > 0.4) {
          ctx.strokeStyle = rig.lashColor || '#2b1722';
          ctx.lineWidth = Math.max(2, e.w * 0.07);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(e.x - e.w * 0.4, lid);
          ctx.quadraticCurveTo(e.x, lid + e.h * 0.12, e.x + e.w * 0.4, lid);
          ctx.stroke();
        }
      }
    }
  }
  if (P.mouth > 0.04) {
    const img = P.mouth < 0.5 && this.images.mouthHalf ? this.images.mouthHalf : this.images.mouthOpen;
    if (img) draw(img);
    else {
      const m = rig.mouth;
      ctx.fillStyle = '#4d1424';
      ctx.beginPath();
      ctx.ellipse(m.x, m.y + m.w * 0.12 * P.mouth, (m.w / 2) * (0.6 + 0.4 * P.mouth), Math.max(1, m.w * 0.38 * P.mouth), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

// Completa un rig incompleto con suposiciones razonables.
export function normalizeRig(rig = {}, W, H) {
  const r = structuredClone(rig || {});
  const headH = H * 0.42;
  if (!r.neck) r.neck = { x: W / 2, y: headH };
  if (!Array.isArray(r.eyes) || !r.eyes.length) {
    const ey = headH * 0.6;
    const ew = W * 0.1;
    r.eyes = [
      { x: W * 0.42, y: ey, w: ew, h: ew * 1.1 },
      { x: W * 0.58, y: ey, w: ew, h: ew * 1.1 },
    ];
  }
  if (!r.mouth) r.mouth = { x: W / 2, y: headH * 0.82, w: W * 0.06 };
  return r;
}
