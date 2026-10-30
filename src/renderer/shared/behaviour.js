// Comportamiento del avatar, independiente de cómo se dibuje (2D o VRM): decide la respiración, el
// parpadeo, la boca, adónde mira, el saltito y la emoción, y lo devuelve como señales normalizadas.
// Cada renderizador traduce esas señales a su modelo (drive-2d.js, vrm/drive-vrm.js).

const K = 0.08; // suavizado de la mirada y de las poses de estado (por fotograma)
const EMO_RISE = 250;
const EMO_HOLD = 4000;
const EMO_FALL = 800;

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
    if (!name || name === 'neutral') {
      const w = this.emotionAt(now).weight;
      this.emo = { ...this.emo, fading: true, fadeStart: now, from: w };
      return;
    }
    this.emo = { name, start: now, from: 0, fading: false, fadeStart: now + EMO_RISE + EMO_HOLD };
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

    // mirada al cursor + balanceo + pose del estado (cada componente suavizado por separado)
    let nx = 0;
    let ny = 0;
    if (this.cursor && head && !asleep) {
      nx = clamp1((this.cursor.x - head[0]) / 700);
      ny = clamp1((this.cursor.y - head[1]) / 500);
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

    const events = this.pending;
    this.pending = [];
    this.emotion = this.emotionAt(now);

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
      emotion: this.emotion,
      talking: mouth > 0 || now < this.fakeTalkUntil,
      events,
    };
  }
}
