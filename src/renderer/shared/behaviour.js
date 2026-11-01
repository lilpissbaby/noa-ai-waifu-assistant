// Comportamiento del avatar, independiente de cómo se dibuje (2D, VRM o Live2D): decide la
// respiración, el parpadeo, la boca, adónde mira, el saltito, la emoción, los gestos y los efectos,
// y lo devuelve como señales normalizadas. Cada renderizador traduce esas señales a su modelo
// (drive-2d.js, vrm/drive-vrm.js, live2d/vts-inputs.js); los efectos los dibuja fx.js.
import { EMOTIONS, GESTURES, IDLE_GESTURES, resolveEmotion, resolveGesture } from '../../shared/expressions.js';
import { addHead, envelope, zeroHead } from './head-motion.js';

const K = 0.08; // suavizado de la mirada y de las poses de estado (por fotograma)
const EMO_RISE = 250;
const EMO_HOLD = 4000;
const EMO_FALL = 800;
const EMO_GESTURE_COOLDOWN = 6000; // una emoción repetida no repite su gesto enseguida

const clamp1 = (v) => Math.max(-1, Math.min(1, v));

export class Behaviour {
  constructor({ random = Math.random, now = performance.now() } = {}) {
    this.random = random;
    this.t0 = now;
    this.nextBlink = 1500;
    this.blinkStart = -1;
    this.doubleBlink = false;
    this.blinkValue = 0;
    this.mouthValue = 0;
    this.levelFn = null; // () => 0..1 nivel de audio
    this.cursor = null; // {x,y} en px CSS del canvas
    this.fakeTalkUntil = 0;
    this.state = 'idle';
    this.hop = 0;
    this.smooth = { x: 0, y: 0, sway: 0, tilt: 0, lift: 0 };
    this.pending = [];
    this.emo = { name: 'neutral', start: 0, from: 0, fading: false, fadeStart: 0 };
    this.emotion = { name: 'neutral', weight: 0 };
    this.prevEmo = null; // { name, from, start }: la emoción anterior, que se funde con la nueva
    this.gest = null; // { name, start, dur, started }
    this.lastEmoGesture = -Infinity;
    this.idleGestures = false; // gestos sueltos de vez en cuando en reposo
    this.nextIdleGesture = 0;
  }

  // Gesto de una vez (wave, nod, cheer…; ver expressions.js). Devuelve false si no existe.
  gesture(name, now = performance.now()) {
    const g = resolveGesture(name);
    if (!g) return false;
    this.gest = { name: g, start: now, dur: GESTURES[g].dur * 1000, started: false };
    if (GESTURES[g].head === 'hop') this.hop = 1;
    return true;
  }

  blink() {
    this.nextBlink = performance.now() - this.t0;
  }

  // 'greet' (se abre el chat), 'done' (termina una respuesta) o 'hop': todos dan el saltito.
  trigger(name) {
    this.hop = 1;
    this.pending.push(name);
  }

  setEmotion(name, now = performance.now()) {
    const n = resolveEmotion(name) || 'neutral';
    if (n === 'neutral') {
      const w = this.emotionAt(now).weight;
      this.emo = { ...this.emo, fading: true, fadeStart: now, from: w };
      return;
    }
    const cur = this.emotionAt(now);
    this.prevEmo = cur.name !== 'neutral' && cur.name !== n && cur.weight > 0 ? { name: cur.name, from: cur.weight, start: now } : null;
    this.emo = { name: n, start: now, from: 0, fading: false, fadeStart: now + EMO_RISE + EMO_HOLD };
    const g = EMOTIONS[n].gesture;
    if (g && !this.gest && now - this.lastEmoGesture > EMO_GESTURE_COOLDOWN) {
      this.gesture(g, now);
      this.lastEmoGesture = now;
    }
  }

  prevEmotionAt(now) {
    const p = this.prevEmo;
    if (!p) return { name: 'neutral', weight: 0 };
    const w = p.from * (1 - (now - p.start) / EMO_RISE);
    if (w <= 0) {
      this.prevEmo = null;
      return { name: 'neutral', weight: 0 };
    }
    return { name: p.name, weight: Math.min(1, w) };
  }

  emotionAt(now) {
    const e = this.emo;
    if (e.name === 'neutral') return { name: 'neutral', weight: 0 };
    let w;
    if (e.fading) w = e.from * (1 - (now - e.fadeStart) / EMO_FALL);
    else if (now < e.start) return { name: e.name, weight: 0 }; // fotograma anterior a la orden
    else if (now < e.start + EMO_RISE) w = (now - e.start) / EMO_RISE;
    else if (now < e.fadeStart) w = 1;
    else w = 1 - (now - e.fadeStart) / EMO_FALL;
    if (w <= 0) {
      this.emo = { name: 'neutral', start: 0, from: 0, fading: false, fadeStart: 0 };
      return { name: 'neutral', weight: 0 };
    }
    return { name: e.name, weight: Math.min(1, w) };
  }

  // head: ancla de la cabeza en px CSS (para mirar al cursor) o null.
  tick(now, head) {
    const t = (now - this.t0) / 1000;
    const ms = now - this.t0;
    const st = this.state;

    // Dormida (modo mascota): ojos cerrados, respiración lenta y cabeza algo caída.
    const asleep = this.sleeping && st === 'idle';
    // respiración (más rápida si piensa o trabaja)
    const breathSpeed = asleep ? 0.6 : st === 'thinking' || st === 'working' ? 1.6 : 1;
    const breath = Math.sin(t * Math.PI * 2 * 0.26 * breathSpeed);

    // parpadeo con tiempos aleatorios, a veces doble
    if (this.blinkStart < 0 && ms >= this.nextBlink) {
      this.blinkStart = ms;
      this.doubleBlink = this.random() < 0.18;
    }
    if (this.blinkStart >= 0) {
      const d = ms - this.blinkStart;
      const dur = 150;
      if (d < dur) this.blinkValue = Math.sin((d / dur) * Math.PI);
      else if (this.doubleBlink && d < dur * 2.3) this.blinkValue = d < dur * 1.3 ? 0 : Math.sin(((d - dur * 1.3) / dur) * Math.PI);
      else {
        this.blinkValue = 0;
        this.blinkStart = -1;
        this.nextBlink = ms + 2200 + this.random() * 4200;
      }
    }
    const blink = asleep ? 1 : st === 'listening' ? Math.min(this.blinkValue, 0) : this.blinkValue;

    // emoción (y la anterior, que se desvanece) y gesto en curso
    this.emotion = this.emotionAt(now);
    const emo = this.emotion;
    const prev = this.prevEmotionAt(now);
    const def = EMOTIONS[emo.name] || {};

    // mirada al cursor + balanceo + pose del estado (cada componente suavizado por separado)
    let nx = 0;
    let ny = 0;
    if (this.cursor && head && !asleep) {
      nx = clamp1((this.cursor.x - head[0]) / 700);
      ny = clamp1((this.cursor.y - head[1]) / 500);
    }
    if (def.look && emo.weight > 0) {
      nx += (def.look.x * 0.8 - nx) * emo.weight * 0.7;
      ny += (def.look.y * 0.8 - ny) * emo.weight * 0.7;
    }
    const sway = Math.sin(t * 0.55) * 0.025 + Math.sin(t * 1.3) * 0.008;
    let tilt = 0;
    if (asleep) tilt = 0.09 + Math.sin(t * 0.8) * 0.01;
    else if (st === 'thinking') tilt = 0.06 + Math.sin(t * 2) * 0.01;
    else if (st === 'listening') tilt = Math.sin(t * 3) * 0.012 - 0.04;
    const lift = st === 'thinking' ? 1 : 0;
    const s = this.smooth;
    s.x += (nx - s.x) * K;
    s.y += (ny - s.y) * K;
    s.sway += (sway - s.sway) * K;
    s.tilt += (tilt - s.tilt) * K;
    s.lift += (lift - s.lift) * K;

    // boca: nivel de audio real, o charla simulada para voces del sistema
    let target = 0;
    if (this.levelFn) target = this.levelFn();
    if (now < this.fakeTalkUntil) target = Math.max(target, 0.25 + 0.55 * Math.abs(Math.sin(t * 13.0) * Math.sin(t * 4.7 + 1)));
    const rate = target > this.mouthValue ? 0.55 : 0.3;
    this.mouthValue += (target - this.mouthValue) * rate;
    const mouth = this.mouthValue < 0.03 ? 0 : Math.min(1, this.mouthValue);

    // saltito
    let hop = 0;
    if (this.hop > 0.001) {
      this.hop *= 0.9;
      hop = this.hop;
    }

    // gestos sueltos en reposo (solo si se piden: así los tests deterministas no tocan el azar)
    if (this.idleGestures && st === 'idle' && !asleep && !this.gest && !(now < this.fakeTalkUntil)) {
      if (!this.nextIdleGesture) this.nextIdleGesture = now + 40000 + this.random() * 60000;
      else if (now >= this.nextIdleGesture) {
        this.gesture(IDLE_GESTURES[Math.floor(this.random() * IDLE_GESTURES.length)], now);
        this.nextIdleGesture = 0;
      }
    } else if (st !== 'idle' || asleep) this.nextIdleGesture = 0;

    // cabeza: patrón del gesto + movimiento continuo de la emoción
    const headPose = zeroHead();
    let gesture = null;
    let wink = def.wink ? emo.weight : 0;
    let mouthHold = 0;
    const fx = [];
    if (this.gest) {
      const el = now - this.gest.start;
      if (el >= this.gest.dur || el < 0) {
        if (el >= this.gest.dur) this.gest = null;
      } else {
        const g = GESTURES[this.gest.name];
        const u = el / this.gest.dur;
        const env = envelope(u);
        addHead(headPose, g.head, u, el / 1000);
        if (g.wink) wink = Math.max(wink, u > 0.12 && u < 0.78 ? Math.min(1, (u - 0.12) / 0.06, (0.78 - u) / 0.06) : 0);
        if (g.mouth) mouthHold = g.mouth * env;
        for (const id of g.fx || []) fx.push({ id, w: env, t: el / 1000, key: this.gest.start });
        gesture = { name: this.gest.name, t: el / 1000, dur: this.gest.dur / 1000, started: !this.gest.started };
        this.gest.started = true;
      }
    }
    if (def.move && emo.weight > 0) addHead(headPose, def.move, 0, (now - this.emo.start) / 1000, emo.weight);
    for (const [e, w] of [
      [emo, emo.weight],
      [prev, prev.weight],
    ]) {
      const d = EMOTIONS[e.name];
      if (!d?.fx || !(w > 0)) continue;
      const start = e === emo ? this.emo.start : this.prevEmo?.start || now;
      for (const id of d.fx) fx.push({ id, w, t: (now - start) / 1000, key: start });
    }
    if (asleep) fx.push({ id: 'zzz', w: 1, t, key: 'sleep' });
    // ojos cerrados que pone la cara de la emoción (los renderizadores sin caras propias cierran los ojos)
    const closed = def.closed ? emo.weight : 0;

    const events = this.pending;
    this.pending = [];

    return {
      t,
      state: st,
      breath,
      blink,
      mouth,
      look: { x: s.x, y: s.y },
      sway: s.sway,
      tilt: s.tilt,
      lift: s.lift,
      hop,
      emotion: emo,
      emotionPrev: prev,
      talking: mouth > 0 || now < this.fakeTalkUntil,
      events,
      head: headPose,
      gesture,
      blinkL: Math.max(blink, wink),
      blinkR: blink,
      wink,
      closed,
      mouthHold,
      fx,
    };
  }
}
