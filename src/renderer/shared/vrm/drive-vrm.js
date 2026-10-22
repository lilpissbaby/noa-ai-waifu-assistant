// Señales de Behaviour -> modelo VRM: expresiones (parpadeo, vocales, emoción), mirada y la capa
// procedural (respiración, giro de cabeza, saltito) que se suma a la pose de la animación.
import { Euler, Quaternion } from 'three';

const DEG = Math.PI / 180;
export const VOWELS = ['aa', 'ih', 'ou', 'ee', 'oh'];
export const EMOTION_NAMES = ['happy', 'angry', 'sad', 'relaxed', 'surprised'];
const EXPRESSIONS = ['blink', ...VOWELS, ...EMOTION_NAMES];
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

export function expressionWeights(s) {
  const emo = s.emotion || { name: 'neutral', weight: 0 };
  const w = { blink: s.blink, ...mouthShapes(s.mouth, s.t * 1000) };
  for (const n of EMOTION_NAMES) w[n] = emo.name === n ? emo.weight : 0;
  if (w.happy > 0.5) w.blink = 0;
  return w;
}

// Radianes. Ojos: hasta 25° a los lados y 15° arriba/abajo. Cabeza + cuello: el 40 % de 35°/20°,
// 40 % en el cuello y 60 % en la cabeza. La inclinación de los estados va en el eje Z de la cabeza.
export function lookOffsets(s) {
  const lx = s.look.x;
  const ly = s.look.y;
  const turnY = lx * 35 * 0.4 * DEG;
  const turnX = ly * 20 * 0.4 * DEG;
  return {
    eyes: { yaw: lx * 25 * DEG, pitch: -ly * 15 * DEG },
    neck: { x: turnX * 0.4, y: turnY * 0.4, z: 0 },
    head: { x: turnX * 0.6 - s.lift * 0.08, y: turnY * 0.6, z: -(s.sway + s.tilt) },
  };
}

const _e = new Euler();
const _q = new Quaternion();
function rotate(node, x, y, z) {
  if (!node) return;
  _q.setFromEuler(_e.set(x, y, z));
  node.quaternion.multiply(_q);
}

// ctx.hipsRestY: altura de la cadera en reposo (para el saltito). Todo es opcional en el modelo.
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
  rotate(bone('neck'), o.neck.x, o.neck.y, o.neck.z);
  rotate(bone('head'), o.head.x, o.head.y, o.head.z);
  // respiración: pecho y hombros
  rotate(bone('chest') || bone('spine'), -s.breath * 0.012, 0, 0);
  rotate(bone('leftShoulder'), 0, 0, s.breath * 0.015);
  rotate(bone('rightShoulder'), 0, 0, -s.breath * 0.015);
  // saltito
  const hips = bone('hips');
  if (hips && s.hop > 0 && ctx.hipsRestY != null) hips.position.y += Math.abs(Math.sin(s.hop * Math.PI * 1.5)) * 0.035 * s.hop;
}
