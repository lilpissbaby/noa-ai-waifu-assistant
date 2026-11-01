// Gestos de una vez para los avatares 3D (los de expressions.js → GESTURES). Datos con licencia MIT.
// Estos clips son absolutos (abs: true): [t, x°, y°, z°] desde la pose T, no desde la pose base.
//   Brazo izquierdo: z = elevación (−68 colgando, 0 en cruz, +80 arriba), y− lo lleva hacia delante.
//   Antebrazo izquierdo: y− dobla el codo hacia delante/dentro, z+ hacia arriba.
//   Dedos izquierdos: z− los cierra. El lado derecho es el espejo: x igual, y y z con el signo cambiado.
//   Tronco y cabeza: x+ se inclina hacia delante, y gira, z+ se ladea a la derecha del personaje.

const DOWN = { UpperArm: [0, 0, -68], LowerArm: [0, -12, 0], Hand: [0, 0, 0] };
const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Little'];

const mirror = ([x, y, z]) => [x, -y, -z];

// Dedos: curl 0 (estirados) … 1 (puño), por dedo. Devuelve { IndexProximal: [x, y, z], … } del lado izquierdo.
function hand(curl = {}) {
  const out = {};
  for (const f of FINGERS) {
    const c = curl[f] ?? curl.all ?? 0;
    if (f === 'Thumb') {
      // VRM 1.0: Metacarpal, Proximal y Distal (three-vrm traduce los nombres de los VRM 0.x)
      out.ThumbMetacarpal = [0, 18 * c, -12 * c];
      out.ThumbProximal = [0, 30 * c, 0];
      out.ThumbDistal = [0, 25 * c, 0];
    } else {
      out[`${f}Proximal`] = [0, 0, -70 * c];
      out[`${f}Intermediate`] = [0, 0, -95 * c];
      out[`${f}Distal`] = [0, 0, -60 * c];
    }
  }
  return out;
}
const FIST = hand({ all: 1 });
const OPEN = hand({ all: 0.1 });

// Pose = { left: { UpperArm: […], …dedos }, right: {…}, center: { spine: […], … } }.
// Las claves del lado derecho se escriben en espejo (como si fuera el izquierdo).
function bonesOf(pose) {
  const out = {};
  for (const [side, prefix] of [
    ['left', 'left'],
    ['right', 'right'],
  ])
    for (const [b, r] of Object.entries(pose[side] || {})) out[`${prefix}${b}`] = side === 'right' ? mirror(r) : r;
  Object.assign(out, pose.center || {});
  return out;
}

const restOf = (bone) => {
  const side = bone.startsWith('left') ? 'left' : bone.startsWith('right') ? 'right' : null;
  if (!side) return [0, 0, 0];
  const b = bone.slice(side.length);
  const r = DOWN[b] || [0, 0, 0];
  return side === 'right' ? mirror(r) : r;
};

// Gesto por fotogramas clave: frames = [[t, pose], …]. Antes del primero y después del último se
// vuelve a la pose de reposo (el reproductor funde la entrada y la salida con el estado).
function clip(name, duration, frames, { hipsY = null, rest = true } = {}) {
  const posed = frames.map(([t, p]) => [t, bonesOf(p)]);
  const names = new Set(posed.flatMap(([, b]) => Object.keys(b)));
  const bones = {};
  for (const bone of names) {
    const keys = [];
    let last = restOf(bone);
    if (rest) keys.push([0, ...restOf(bone)]);
    for (const [t, b] of posed) {
      if (b[bone]) last = b[bone];
      keys.push([t, ...last]);
    }
    if (rest) keys.push([duration, ...restOf(bone)]);
    bones[bone] = keys.filter((k, i, a) => i === 0 || k[0] > a[i - 1][0]);
  }
  return { name, duration, loop: false, abs: true, bones, ...(hipsY ? { hipsY } : {}) };
}

// Mantiene una pose de `a` a `b` segundos.
const hold = (a, b, pose) => [
  [a, pose],
  [b, pose],
];

// ------------------------------------------------------------------ poses
const ARMS_FRONT = (bend = -70) => ({ UpperArm: [0, -25, -72], LowerArm: [0, bend, 0] });

const P = {
  bow: { left: { UpperArm: [0, -14, -74], LowerArm: [0, -48, 0] }, right: { UpperArm: [0, -14, -74], LowerArm: [0, -48, 0] }, center: { spine: [22, 0, 0], chest: [10, 0, 0] } },
  clapOpen: { left: { UpperArm: [0, -40, -55], LowerArm: [0, -88, 20], ...OPEN }, right: { UpperArm: [0, -40, -55], LowerArm: [0, -88, 20], ...OPEN } },
  clapShut: { left: { UpperArm: [0, -48, -55], LowerArm: [0, -104, 20], ...OPEN }, right: { UpperArm: [0, -48, -55], LowerArm: [0, -104, 20], ...OPEN } },
  thumbsup: { right: { UpperArm: [0, -35, -55], LowerArm: [0, -80, 45], Hand: [-90, 0, 0], ...hand({ all: 1, Thumb: 0 }) }, center: { spine: [0, 6, 0] } },
  peace: { right: { UpperArm: [0, -20, 20], LowerArm: [0, -25, 115], Hand: [-90, 0, 10], ...hand({ all: 1, Index: 0, Middle: 0 }), IndexProximal: [0, 8, 0], MiddleProximal: [0, -8, 0] }, center: { head: [0, 0, -6] } },
  point: { right: { UpperArm: [0, -70, -5], LowerArm: [0, -8, 0], Hand: [-90, 0, 0], ...hand({ all: 1, Index: 0 }) }, center: { spine: [0, 8, 0] } },
  idea: { right: { UpperArm: [0, 0, 30], LowerArm: [0, -70, 70], Hand: [-90, 0, 0], ...hand({ all: 1, Index: 0 }) } },
  shrug: {
    left: { Shoulder: [0, 0, 10], UpperArm: [0, -10, -62], LowerArm: [0, -70, 30], Hand: [90, 0, 0], ...OPEN },
    right: { Shoulder: [0, 0, 10], UpperArm: [0, -10, -62], LowerArm: [0, -70, 30], Hand: [90, 0, 0], ...OPEN },
  },
  facepalm: { right: { UpperArm: [0, -55, -10], LowerArm: [0, -140, 45], Hand: [-90, 0, 20], ...OPEN }, center: { spine: [8, 0, 0] } },
  crossarms: {
    left: { UpperArm: [0, -28, -70], LowerArm: [0, -118, 8], ...hand({ all: 0.6 }) },
    right: { UpperArm: [0, -26, -72], LowerArm: [0, -112, -6], ...hand({ all: 0.6 }) },
  },
  hips: { left: { UpperArm: [0, 10, -48], LowerArm: [0, -20, -95], Hand: [0, 0, -20], ...hand({ all: 0.7 }) }, right: { UpperArm: [0, 10, -48], LowerArm: [0, -20, -95], Hand: [0, 0, -20], ...hand({ all: 0.7 }) }, center: { spine: [-4, 0, 0] } },
  heart: { left: { UpperArm: [0, -18, 50], LowerArm: [0, -10, 100], Hand: [0, 0, 20], ...hand({ all: 0.5, Thumb: 0 }) }, right: { UpperArm: [0, -18, 50], LowerArm: [0, -10, 100], Hand: [0, 0, 20], ...hand({ all: 0.5, Thumb: 0 }) } },
  kissHand: { right: { UpperArm: [0, -50, -38], LowerArm: [0, -128, 20], Hand: [-90, 0, 0], ...hand({ all: 0.5 }) } },
  kissOut: { right: { UpperArm: [0, -70, 5], LowerArm: [0, -15, 0], Hand: [-90, 0, -20], ...OPEN } },
  shy: { left: { UpperArm: [0, -22, -76], LowerArm: [0, -72, 0], ...hand({ all: 0.4 }) }, right: { UpperArm: [0, -22, -76], LowerArm: [0, -72, 0], ...hand({ all: 0.4 }) }, center: { spine: [4, -4, 0] } },
  stretch: { left: { UpperArm: [0, -5, 78], LowerArm: [0, -10, 25], ...hand({ all: 0.3 }) }, right: { UpperArm: [0, -5, 78], LowerArm: [0, -10, 25], ...hand({ all: 0.3 }) }, center: { spine: [-8, 0, 0], chest: [-4, 0, 0] } },
  yawnHand: { right: { UpperArm: [0, -55, -25], LowerArm: [0, -135, 35], Hand: [-90, 0, 0], ...OPEN }, left: { UpperArm: [0, 0, -50], LowerArm: [0, -20, 0] }, center: { spine: [-5, 0, 0] } },
  salute: { right: { UpperArm: [0, -10, 20], LowerArm: [0, -105, 75], Hand: [-80, 0, 10], ...hand({ all: 0 }) } },
  fistUp: { right: { UpperArm: [0, -10, 55], LowerArm: [0, -10, 60], ...FIST } },
  fistDown: { right: { UpperArm: [0, -15, 25], LowerArm: [0, -40, 85], ...FIST } },
  giggle: { right: { UpperArm: [0, -55, -30], LowerArm: [0, -135, 30], Hand: [-90, 0, 0], ...hand({ all: 0.4 }) }, center: { spine: [5, 0, 3] } },
  hug: { left: { UpperArm: [0, -38, -66], LowerArm: [0, -125, 6], ...hand({ all: 0.5 }) }, right: { UpperArm: [0, -36, -68], LowerArm: [0, -120, -4], ...hand({ all: 0.5 }) }, center: { spine: [8, 0, 0] } },
  sigh: { left: { Shoulder: [0, 0, -8], UpperArm: [0, 0, -72] }, right: { Shoulder: [0, 0, -8], UpperArm: [0, 0, -72] }, center: { spine: [8, 0, 0], chest: [4, 0, 0] } },
  cry: { left: { UpperArm: [0, -55, -15], LowerArm: [0, -145, 40], ...hand({ all: 0.5 }) }, right: { UpperArm: [0, -55, -15], LowerArm: [0, -145, 40], ...hand({ all: 0.5 }) }, center: { spine: [10, 0, 0] } },
  recoil: { left: { UpperArm: [0, -45, -35], LowerArm: [0, -40, 60], Hand: [0, 0, 60], ...OPEN }, right: { UpperArm: [0, -45, -35], LowerArm: [0, -40, 60], Hand: [0, 0, 60], ...OPEN }, center: { spine: [-12, 0, 0] } },
  stomp: { left: { Shoulder: [0, 0, 10], UpperArm: [0, 6, -62], LowerArm: [0, -30, 0], ...FIST }, right: { Shoulder: [0, 0, 10], UpperArm: [0, 6, -62], LowerArm: [0, -30, 0], ...FIST }, center: { spine: [6, 0, 0] } },
  armsUpL: { left: { UpperArm: [0, -10, 60], LowerArm: [0, -10, 30] }, right: { UpperArm: [0, -10, -55], LowerArm: [0, -40, 0] }, center: { hips: [0, 0, 6], spine: [0, 0, -5] } },
  armsUpR: { left: { UpperArm: [0, -10, -55], LowerArm: [0, -40, 0] }, right: { UpperArm: [0, -10, 60], LowerArm: [0, -10, 30] }, center: { hips: [0, 0, -6], spine: [0, 0, 5] } },
  jumpUp: { left: { UpperArm: [0, -10, 40], LowerArm: [0, -20, 30] }, right: { UpperArm: [0, -10, 40], LowerArm: [0, -20, 30] } },
  front: { left: ARMS_FRONT(), right: ARMS_FRONT() },
};

// ------------------------------------------------------------------ clips
export const ACTIONS = [
  clip('bow', 2.2, [hold(0.55, 1.6, P.bow)].flat()),
  clip('clap', 1.8, [[0.3, P.clapOpen], [0.5, P.clapShut], [0.7, P.clapOpen], [0.9, P.clapShut], [1.1, P.clapOpen], [1.3, P.clapShut], [1.45, P.clapOpen]]),
  clip('thumbsup', 2.0, hold(0.45, 1.55, P.thumbsup)),
  clip('peace', 2.0, hold(0.45, 1.55, P.peace)),
  clip('point', 1.8, hold(0.4, 1.4, P.point)),
  clip('idea', 1.8, hold(0.35, 1.4, P.idea)),
  clip('think', 2.8, hold(0.5, 2.3, { right: { UpperArm: [0, -45, -45], LowerArm: [0, -120, 25], Hand: [-80, 0, 15], ...hand({ all: 0.6 }) }, left: { UpperArm: [0, -30, -70], LowerArm: [0, -95, 0] } })),
  clip('shrug', 1.8, hold(0.4, 1.3, P.shrug)),
  clip('facepalm', 2.2, hold(0.5, 1.7, P.facepalm)),
  clip('crossarms', 2.6, hold(0.5, 2.1, P.crossarms)),
  clip('hips', 2.4, hold(0.45, 1.9, P.hips)),
  clip('heart', 2.4, hold(0.6, 1.9, P.heart)),
  clip('blowkiss', 2.0, [[0.45, P.kissHand], [0.85, P.kissHand], [1.2, P.kissOut], [1.55, P.kissOut]]),
  clip('shy', 2.4, [[0.45, P.shy], [1.0, { ...P.shy, center: { spine: [4, 4, 0] } }], [1.5, P.shy], [1.95, { ...P.shy, center: { spine: [4, 4, 0] } }]]),
  clip('stretch', 3.0, [[0.7, P.stretch], [1.6, { ...P.stretch, center: { spine: [-10, 0, 6], chest: [-4, 0, 3] } }], [2.3, P.stretch]]),
  clip('yawn', 2.4, hold(0.5, 1.8, P.yawnHand)),
  clip('dance', 4.0, [0.4, 0.9, 1.4, 1.9, 2.4, 2.9, 3.4].map((t, i) => [t, i % 2 ? P.armsUpR : P.armsUpL]), {
    hipsY: [[0, 0], [0.65, 0.02], [0.9, 0], [1.15, 0.02], [1.4, 0], [1.65, 0.02], [1.9, 0], [2.15, 0.02], [2.4, 0], [2.65, 0.02], [2.9, 0], [3.15, 0.02], [3.4, 0], [4, 0]],
  }),
  clip('jump', 1.0, [[0.2, P.front], [0.45, P.jumpUp], [0.7, P.front]], { hipsY: [[0, 0], [0.18, -0.03], [0.45, 0.09], [0.7, 0], [0.8, -0.015], [1, 0]] }),
  clip('spin', 1.6, [[0.25, { center: { hips: [0, 90, 0] } }], [0.5, { center: { hips: [0, 180, 0] } }], [0.75, { center: { hips: [0, 270, 0] } }], [1.0, { center: { hips: [0, 359, 0] } }]], { hipsY: [[0, 0], [0.5, 0.03], [1.0, 0], [1.6, 0]] }),
  clip('salute', 1.8, hold(0.4, 1.4, P.salute)),
  clip('fistpump', 1.6, [[0.3, P.fistDown], [0.55, P.fistUp], [0.8, P.fistDown], [1.05, P.fistUp], [1.25, P.fistUp]]),
  clip('giggle', 1.6, [[0.35, P.giggle], [0.6, { ...P.giggle, center: { spine: [5, 0, -3] } }], [0.85, P.giggle], [1.1, { ...P.giggle, center: { spine: [5, 0, -3] } }], [1.25, P.giggle]]),
  clip('shiver', 1.8, [[0.35, P.hug], ...[0.5, 0.62, 0.74, 0.86, 0.98, 1.1, 1.22, 1.34].map((t, i) => [t, { ...P.hug, center: { spine: [8, i % 2 ? 3 : -3, 0] } }])]),
  clip('sigh', 2.0, hold(0.7, 1.4, P.sigh)),
  clip('cry', 2.6, [[0.5, P.cry], [0.9, { ...P.cry, center: { spine: [12, 0, 2] } }], [1.3, P.cry], [1.7, { ...P.cry, center: { spine: [12, 0, -2] } }], [2.0, P.cry]]),
  clip('recoil', 1.4, hold(0.25, 0.95, P.recoil)),
  clip('stomp', 1.4, [[0.25, P.stomp], [1.0, P.stomp]], { hipsY: [[0, 0], [0.3, 0.035], [0.45, -0.02], [0.6, 0], [1.4, 0]] }),
];
