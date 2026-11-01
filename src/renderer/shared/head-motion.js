// Movimientos de cabeza de gestos y emociones, iguales para 2D, VRM y Live2D. Cada patrón da un
// desplazamiento: pitch (+ baja la cabeza), yaw (+ gira a la derecha de la pantalla), roll (+ la
// inclina hacia la derecha de la pantalla), en radianes; x/y en fracción del alto (+y sube).
//   u: avance del gesto (0…1); t: segundos desde que empezó; e: envolvente (0…1) para entrar y salir.

const TAU = Math.PI * 2;
const sin = Math.sin;

export const HEAD_PATTERNS = {
  nod: (u, t, e) => ({ pitch: 0.16 * Math.max(0, sin(u * TAU * 2 - Math.PI / 2) * 0.5 + 0.5) * e }),
  nodOnce: (u) => ({ pitch: 0.14 * sin(u * Math.PI) }),
  shake: (u) => ({ yaw: 0.22 * sin(u * TAU * 2.5) * (1 - u) }),
  shakeSmall: (u) => ({ yaw: 0.08 * sin(u * TAU * 4) * (1 - u) }),
  bow: (u, t, e) => ({ pitch: 0.38 * e }),
  tilt: (u, t, e) => ({ roll: 0.15 * e }),
  tiltSmall: (u, t, e) => ({ roll: 0.08 * e }),
  hop: () => ({}), // lo hace el saltito de siempre (Behaviour.hop)
  bounce: (u, t, e) => ({ y: Math.abs(sin(t * TAU * 2)) * 0.012 * e }),
  bounceSmall: (u, t, e) => ({ y: Math.abs(sin(t * TAU * 3)) * 0.008 * e }),
  giggle: (u, t, e) => ({ roll: 0.05 * sin(t * TAU * 6) * e, y: Math.abs(sin(t * TAU * 6)) * 0.006 * e }),
  shiver: (u, t, e) => ({ x: 0.004 * sin(t * TAU * 18) * e, roll: 0.018 * sin(t * TAU * 15) * e }),
  tremble: (u, t, e) => ({ x: 0.0025 * sin(t * TAU * 16) * e, roll: 0.01 * sin(t * TAU * 13) * e }),
  droop: (u, t, e) => ({ pitch: 0.14 * e, roll: 0.05 * e }),
  chinUp: (u, t, e) => ({ pitch: -0.1 * e, roll: -0.04 * e }),
  huff: (u, t, e) => ({ yaw: -0.26 * e, pitch: -0.06 * e }),
  lean: (u, t, e) => ({ pitch: 0.06 * e, roll: 0.06 * e }),
  leanBack: (u, t, e) => ({ pitch: -0.12 * e, y: 0.004 * e }),
  sway: (u, t, e) => ({ roll: 0.05 * sin(t * TAU * 0.5) * e }),
  nodOff: (u, t, e) => ({ pitch: (0.1 + 0.1 * Math.max(0, sin(t * TAU * 0.22)) ** 6) * e }),
  fidget: (u, t, e) => ({ yaw: 0.06 * sin(t * TAU * 0.9) * e, roll: 0.025 * sin(t * TAU * 1.7) * e }),
  sob: (u, t, e) => ({ pitch: 0.12 * e, y: Math.abs(sin(t * TAU * 3)) * 0.006 * e }),
  wobble: (u, t, e) => ({ roll: 0.12 * sin(t * TAU * 0.8) * e, yaw: 0.08 * Math.cos(t * TAU * 0.8) * e }),
  lookaround: (u, t, e) => ({ yaw: 0.3 * sin(u * TAU) * e, pitch: -0.04 * e }),
};

// Entrada y salida suaves de un gesto (15 % y 20 % de su duración).
export function envelope(u) {
  if (u <= 0 || u >= 1) return 0;
  const a = Math.min(1, u / 0.15);
  const b = Math.min(1, (1 - u) / 0.2);
  const s = (x) => x * x * (3 - 2 * x);
  return Math.min(s(a), s(b));
}

export const zeroHead = () => ({ pitch: 0, yaw: 0, roll: 0, x: 0, y: 0 });

// Suma el patrón `name` (con peso w) a `acc`. u = 0: movimiento continuo (el de una emoción), sin
// envolvente.
export function addHead(acc, name, u, t, w = 1) {
  const fn = HEAD_PATTERNS[name];
  if (!fn || !(w > 0)) return acc;
  const r = fn(u, t, envelope(u === 0 ? 0.5 : u));
  for (const k of ['pitch', 'yaw', 'roll', 'x', 'y']) if (r[k]) acc[k] += r[k] * w;
  return acc;
}
