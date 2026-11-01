// Señales de Behaviour -> modelo VRM: expresiones (parpadeo, vocales, emoción), mirada y la capa
// procedural (respiración, giro de cabeza, saltito) que se suma a la pose de la animación.
import { Euler, Quaternion } from 'three';
import { EMOTIONS } from '../../../shared/expressions.js';

const DEG = Math.PI / 180;
export const VOWELS = ['aa', 'ih', 'ou', 'ee', 'oh'];
export const EMOTION_NAMES = ['happy', 'angry', 'sad', 'relaxed', 'surprised'];
const EXPRESSIONS = ['blink', 'blinkLeft', 'blinkRight', ...VOWELS, ...EMOTION_NAMES];
const SECONDARY = ['ih', 'ou', 'ee', 'oh'];
const BUCKET = 125; // ms; los tramos duran 90–160 ms

// Hash entero -> [0, 1), determinista.
function hash01(n) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
const boundary = (i) => i * BUCKET + (hash01(i) - 0.5) * 35;

function segmentAt(timeMs) {
  const i = Math.floor(timeMs / BUCKET);
  if (timeMs < boundary(i)) return i - 1;
  if (timeMs >= boundary(i + 1)) return i + 1;
  return i;
}

// Reparte el nivel de la boca entre «aa» (40–70 %) y otra vocal que cambia en cada tramo.
// Tramos consecutivos nunca repiten vocal (pares: ih/ou, impares: ee/oh).
export function mouthShapes(level, timeMs) {
  const out = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
  if (!(level > 0)) return out;
  const seg = segmentAt(timeMs);
  const odd = ((seg % 2) + 2) % 2;
  const second = SECONDARY[odd * 2 + (hash01(seg * 7 + 3) < 0.5 ? 0 : 1)];
  const aaShare = 0.4 + 0.3 * hash01(seg * 13 + 1);
  out.aa = level * aaShare;
  out[second] = level - out.aa;
  return out;
}

// Pesos de las expresiones VRM: las de la emoción actual y la anterior (cada emoción es una mezcla de
// las cinco de VRM, del parpadeo y de alguna vocal; ver expressions.js), la boca y el parpadeo.
export function expressionWeights(s) {
  const w = { blink: s.blink, blinkLeft: 0, blinkRight: 0, ...mouthShapes(Math.max(s.mouth, s.mouthHold || 0), s.t * 1000) };
  for (const n of EMOTION_NAMES) w[n] = 0;
  let lid = 0; // párpados medio caídos (sueño, aburrimiento…)
  for (const e of [s.emotion, s.emotionPrev]) {
    const mix = e && e.weight > 0 ? EMOTIONS[e.name]?.vrm : null;
    if (!mix) continue;
    for (const [k, v] of Object.entries(mix)) {
      if (k === 'blink') lid = Math.max(lid, v * e.weight);
      else if (k in w) w[k] = Math.min(1, w[k] + v * e.weight);
    }
  }
  if (w.happy > 0.5) w.blink = 0;
  else w.blink = Math.min(1, Math.max(w.blink, lid));
  // guiño: el ojo de la izquierda de la pantalla es el derecho del personaje
  if (s.blinkL > s.blink) w.blinkRight = Math.min(1, s.blinkL);
  return w;
}

// Radianes. Ojos: hasta 25° a los lados y 15° arriba/abajo. Cabeza + cuello: el 40 % de 35°/20°,
// 40 % en el cuello y 60 % en la cabeza. La inclinación de los estados va en el eje Z de la cabeza.
// Gestos y emociones (s.head) se suman a cabeza y cuello: pitch + baja la cabeza, yaw + mira a la
// derecha de la pantalla (la izquierda del personaje), roll + la inclina hacia la derecha de la pantalla.
export function lookOffsets(s) {
  const lx = s.look.x;
  const ly = s.look.y;
  const h = s.head || {};
  const turnY = lx * 35 * 0.4 * DEG + (h.yaw || 0);
  const turnX = ly * 20 * 0.4 * DEG + (h.pitch || 0);
  return {
    eyes: { yaw: lx * 25 * DEG, pitch: -ly * 15 * DEG },
    neck: { x: turnX * 0.4, y: turnY * 0.4, z: -(h.roll || 0) * 0.3 },
    head: { x: turnX * 0.6 - s.lift * 0.08, y: turnY * 0.6, z: -(s.sway + s.tilt) - (h.roll || 0) * 0.7 },
  };
}

const _e = new Euler();
const _q = new Quaternion();
// vrm0: el modelo mira a −Z en su espacio local, así que los giros en X y Z cambian de signo.
function rotate(node, x, y, z, vrm0) {
  if (!node) return;
  _q.setFromEuler(vrm0 ? _e.set(-x, y, -z) : _e.set(x, y, z));
  node.quaternion.multiply(_q);
}

// ctx.hipsRestY: altura de la cadera en reposo (para el saltito); ctx.vrm0: modelo VRM 0.x.
// Todo es opcional en el modelo.
export function applyToVrm(vrm, s, ctx = {}) {
  const em = vrm.expressionManager;
  if (em) {
    const w = expressionWeights(s);
    for (const n of EXPRESSIONS) if (em.getExpression(n)) em.setValue(n, w[n]);
  }
  const o = lookOffsets(s);
  if (vrm.lookAt) {
    vrm.lookAt.target = null;
    vrm.lookAt.yaw = o.eyes.yaw / DEG;
    vrm.lookAt.pitch = o.eyes.pitch / DEG;
  }
  const bone = (n) => vrm.humanoid?.getNormalizedBoneNode(n) || null;
  const v0 = !!ctx.vrm0;
  rotate(bone('neck'), o.neck.x, o.neck.y, o.neck.z, v0);
  rotate(bone('head'), o.head.x, o.head.y, o.head.z, v0);
  // respiración: pecho y hombros
  rotate(bone('chest') || bone('spine'), -s.breath * 0.012, 0, 0, v0);
  rotate(bone('leftShoulder'), 0, 0, s.breath * 0.015, v0);
  rotate(bone('rightShoulder'), 0, 0, -s.breath * 0.015, v0);
  // saltito y botes de los gestos (s.head.y en fracción del alto ≈ 1,6 m)
  const hips = bone('hips');
  if (hips && s.hop > 0 && ctx.hipsRestY != null) hips.position.y += Math.abs(Math.sin(s.hop * Math.PI * 1.5)) * 0.035 * s.hop;
  if (hips && ctx.hipsRestY != null && s.head) {
    hips.position.y += (s.head.y || 0) * 1.6;
    hips.position.x += (s.head.x || 0) * 1.6;
  }
}
