// Animación del cuerpo: clips propios (datos en clips/) o importados, el clip de cada estado en bucle
// con fundidos, y gestos sueltos encima. Devuelve rotaciones locales absolutas de los huesos
// normalizados; el renderizador las aplica y luego suma la capa procedural (mirada, respiración).
import { Quaternion } from 'three';
import { baseQuat, quatFromDeg, toVrm0 } from './pose.js';

const STATE_FADE = 0.4;
const GESTURE_FADE = 0.3;

const smooth = (u) => u * u * (3 - 2 * u);

export class Motion {
  constructor({ name = '', duration, loop, sample, hipsY = null }) {
    this.name = name;
    this.duration = Math.max(1e-3, duration);
    this.loop = loop;
    this.sampleAt = sample;
    this.hipsAt = hipsY;
  }
  localTime(t) {
    return this.loop ? ((t % this.duration) + this.duration) % this.duration : Math.max(0, Math.min(this.duration, t));
  }
  sample(t) {
    return this.sampleAt(this.localTime(t));
  }
  hipsY(t) {
    return this.hipsAt ? this.hipsAt(this.localTime(t)) : 0;
  }
}

// Busca el tramo [k0, k1] de una lista de claves [[t, …], …] y la fracción (suavizada) dentro.
function segment(keys, t) {
  if (t <= keys[0][0]) return [0, 0, 0];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i][0];
    const b = keys[i + 1][0];
    if (t <= b) return [i, i + 1, b > a ? smooth((t - a) / (b - a)) : 1];
  }
  const last = keys.length - 1;
  return [last, last, 0];
}

// Clip propio: { name, duration, loop, bones: { hueso: [[t, x°, y°, z°], …] }, hipsY?: [[t, m], …] }.
// Las rotaciones son relativas a la pose base y están pensadas para VRM 1.0; con vrm0 se pasan al
// espacio de los VRM 0.x.
export function motionFromDef(def, { vrm0 = false } = {}) {
  const tracks = Object.entries(def.bones).map(([bone, keys]) => ({
    bone,
    times: keys,
    quats: keys.map((k) => {
      const q = baseQuat(bone).clone().multiply(quatFromDeg([k[1], k[2], k[3]]));
      return vrm0 ? toVrm0(q) : q;
    }),
  }));
  const hips = def.hipsY;
  return new Motion({
    name: def.name,
    duration: def.duration,
    loop: !!def.loop,
    sample: (t) => {
      const out = new Map();
      for (const tr of tracks) {
        const [i, j, u] = segment(tr.times, t);
        out.set(tr.bone, tr.quats[i].clone().slerp(tr.quats[j], u));
      }
      return out;
    },
    hipsY: hips
      ? (t) => {
          const [i, j, u] = segment(hips, t);
          return hips[i][1] + (hips[j][1] - hips[i][1]) * u;
        }
      : null,
  });
}

// Clip de three.js (de .vrma o de Mixamo ya convertido) cuyas pistas apuntan a los huesos
// normalizados del modelo: «<nodo>.quaternion» y, opcionalmente, «<nodo de la cadera>.position».
export function motionFromClip(clip, vrm, name = clip.name) {
  const byNode = new Map();
  for (const [bone, node] of Object.entries(vrm.humanoid.normalizedHumanBones || {})) if (node?.node) byNode.set(node.node.name, bone);
  const rot = [];
  let hipsTrack = null;
  for (const track of clip.tracks) {
    const dot = track.name.lastIndexOf('.');
    const nodeName = track.name.slice(0, dot);
    const prop = track.name.slice(dot + 1);
    const bone = byNode.get(nodeName);
    if (!bone) continue;
    if (prop === 'quaternion') rot.push({ bone, interp: track.createInterpolant() });
    else if (prop === 'position' && bone === 'hips') hipsTrack = track.createInterpolant();
  }
  const hips0 = hipsTrack ? hipsTrack.evaluate(0)[1] : 0;
  return new Motion({
    name,
    duration: clip.duration,
    loop: true,
    sample: (t) => {
      const out = new Map();
      for (const r of rot) {
        const v = r.interp.evaluate(t);
        out.set(r.bone, new Quaternion(v[0], v[1], v[2], v[3]));
      }
      return out;
    },
    hipsY: hipsTrack ? (t) => hipsTrack.evaluate(t)[1] - hips0 : null,
  });
}

const asList = (v) => (Array.isArray(v) ? v.filter(Boolean) : v ? [v] : []);

// Mezcla dos poses: b con peso w sobre a (los huesos que faltan en a toman la pose base).
function blendInto(target, pose, w, vrm0) {
  for (const [bone, q] of pose) {
    const from = target.get(bone) || baseQuat(bone, vrm0).clone();
    target.set(bone, w >= 1 ? q.clone() : from.slerp(q, w));
  }
}

export class MotionPlayer {
  constructor({ random = Math.random, vrm0 = false } = {}) {
    this.random = random;
    this.vrm0 = vrm0; // modelo VRM 0.x: la pose base va en su espacio
    this.lib = {};
    this.time = 0;
    this.base = null; // { key, motion, t }
    this.prev = null; // { motion, t } que se desvanece
    this.fade = 1; // 0..1 del fundido entre prev y base
    this.gesture = null; // { motion, t }
    this.nextIdleSwap = 0;
    this.nextTalkGesture = -1;
    this.lastEmotion = 'neutral';
  }

  setLibrary(lib) {
    this.lib = lib || {};
    this.base = null;
    this.prev = null;
    this.gesture = null;
  }

  pickIdle(exclude) {
    const list = asList(this.lib.idle);
    const options = list.length > 1 ? list.filter((m) => m !== exclude) : list;
    return options[Math.floor(this.random() * options.length)] || null;
  }

  stateMotion(state) {
    if (state === 'idle' || state === 'error') return this.pickIdle(null);
    return asList(this.lib[state])[0] || this.pickIdle(null);
  }

  switchBase(key, motion) {
    if (this.base?.motion) {
      this.prev = this.base;
      this.fade = 0;
    }
    this.base = { key, motion, t: 0 };
    if (key === 'idle') this.nextIdleSwap = this.time + 20 + this.random() * 20;
  }

  // Reproduce un movimiento una vez encima del estado (botón «Probar» del editor).
  play(motion) {
    if (motion) this.gesture = { motion: Object.assign(Object.create(Object.getPrototypeOf(motion)), motion, { loop: false }), t: 0 };
  }

  startGesture(name) {
    const list = asList(this.lib[name]);
    const motion = list[Math.floor(this.random() * list.length)];
    if (!motion) return false;
    this.gesture = { motion, t: 0 };
    return true;
  }

  update(dt, s) {
    this.time += dt;
    let started = false;
    const key = s.state === 'error' ? 'idle' : s.state;

    // clip del estado
    if (!this.base || this.base.key !== key) this.switchBase(key, this.stateMotion(key));
    else if (key === 'idle' && this.time >= this.nextIdleSwap && asList(this.lib.idle).length > 1) this.switchBase('idle', this.pickIdle(this.base.motion));
    this.base.t += dt;
    if (this.prev) {
      this.prev.t += dt;
      this.fade = Math.min(1, this.fade + dt / STATE_FADE);
      if (this.fade >= 1) this.prev = null;
    }

    // gestos
    if (s.events?.includes('greet')) started = this.startGesture('greet') || started;
    const emo = s.emotion?.name || 'neutral';
    if (emo === 'happy' && this.lastEmotion !== 'happy') started = this.startGesture('happy') || started;
    this.lastEmotion = emo;
    if (s.talking) {
      if (this.nextTalkGesture < 0) this.nextTalkGesture = this.time + 4 + this.random() * 4;
      else if (this.time >= this.nextTalkGesture && !this.gesture) {
        started = this.startGesture('talkGesture') || started;
        this.nextTalkGesture = this.time + 4 + this.random() * 4;
      }
    } else this.nextTalkGesture = -1;
    if (this.gesture) {
      this.gesture.t += dt;
      if (this.gesture.t >= this.gesture.motion.duration) this.gesture = null;
    }

    // composición
    const pose = new Map();
    let hipsY = 0;
    if (this.prev?.motion) {
      blendInto(pose, this.prev.motion.sample(this.prev.t), 1, this.vrm0);
      hipsY = this.prev.motion.hipsY(this.prev.t);
    }
    if (this.base.motion) {
      const w = this.prev ? smooth(this.fade) : 1;
      blendInto(pose, this.base.motion.sample(this.base.t), w, this.vrm0);
      hipsY += (this.base.motion.hipsY(this.base.t) - hipsY) * w;
    }
    if (this.gesture) {
      const { motion, t } = this.gesture;
      const w = smooth(Math.max(0, Math.min(1, t / GESTURE_FADE, (motion.duration - t) / GESTURE_FADE)));
      blendInto(pose, motion.sample(t), w, this.vrm0);
      hipsY += (motion.hipsY(t) - hipsY) * w;
    }
    return { pose, hipsY, busy: !!this.prev || !!this.gesture, started };
  }
}
