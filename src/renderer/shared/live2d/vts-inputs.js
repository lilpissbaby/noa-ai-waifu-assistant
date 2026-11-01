// Señales de Behaviour → entradas de seguimiento como las de VTube Studio (lo que daría una
// cámara de cara), en sus mismos rangos: ángulos ±30°, ojos y boca 0–1, cejas 0–1 con 0,5 neutro.
import { EMOTIONS } from '../../../shared/expressions.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, Number.isFinite(v) ? v : 0));
const DEG = 180 / Math.PI;

// Suma de los cambios de cara (expressions.js → l2d) de la emoción actual y la anterior.
export function emotionFace(s) {
  const out = { smile: 0, eye: 0, brows: 0, mouth: 0, cheek: 0 };
  for (const e of [s.emotion, s.emotionPrev]) {
    const d = e && e.weight > 0 ? EMOTIONS[e.name]?.l2d : null;
    if (!d) continue;
    const w = clamp(e.weight, 0, 1);
    for (const k of Object.keys(out)) if (d[k]) out[k] += d[k] * w;
  }
  return out;
}

export function vtsInputs(s) {
  const lx = clamp(s.look?.x ?? 0, -1, 1);
  const ly = clamp(s.look?.y ?? 0, -1, 1);
  const f = emotionFace(s);
  const h = s.head || {};
  const blink = clamp(s.blink, 0, 1);
  const mouth = clamp(Math.max(s.mouth, s.mouthHold || 0, f.mouth), 0, 1);
  const shut = f.eye < 0 ? -f.eye : 0; // la emoción entorna o cierra los ojos
  const eye = clamp(1 - Math.max(blink, shut) + Math.max(0, f.eye) * 0.5, 0, 1);
  // Guiño: el ojo de la izquierda de la pantalla es el derecho del modelo.
  const wink = clamp(s.blinkL ?? 0, 0, 1);
  const smile = clamp(0.5 + f.smile, 0, 1);
  const brows = clamp(0.5 + f.brows, 0, 1);
  const breath = (clamp(s.breath, -1, 1) + 1) / 2;
  const sway = Number.isFinite(s.sway) ? s.sway : 0;
  const tilt = Number.isFinite(s.tilt) ? s.tilt : 0;
  const lift = clamp(s.lift, 0, 1);
  return {
    FaceAngleX: clamp(lx * 30 + sway * 60 + (h.yaw || 0) * DEG, -30, 30),
    FaceAngleY: clamp(-ly * 30 + lift * 8 - (h.pitch || 0) * DEG, -30, 30),
    FaceAngleZ: clamp(tilt * DEG * 1.5 + sway * 40 + (h.roll || 0) * DEG * 1.5, -30, 30),
    FacePositionX: clamp(sway * 80 + (h.x || 0) * 400, -10, 10),
    FacePositionY: clamp((s.hop || 0) * 6 + (breath - 0.5) * 0.6 + (h.y || 0) * 300, -10, 10),
    FacePositionZ: 0,
    EyeOpenLeft: eye,
    EyeOpenRight: Math.min(eye, 1 - wink),
    EyeLeftX: lx,
    EyeLeftY: -ly,
    EyeRightX: lx,
    EyeRightY: -ly,
    MouthOpen: mouth,
    MouthSmile: smile,
    BrowLeftY: brows,
    BrowRightY: brows,
    Brows: brows,
    VoiceVolume: mouth,
    VoiceFrequency: clamp(mouth * 0.6, 0, 1),
    VoiceVolumePlusMouthOpen: mouth,
    VoiceFrequencyPlusMouthSmile: clamp(Math.max(mouth * 0.6, smile), 0, 1),
    MousePositionX: lx,
    MousePositionY: -ly,
    // Internas (no son de VTS): la respiración para ParamBreath y el rubor para ParamCheek.
    Breath: breath,
    Cheek: clamp(f.cheek, 0, 1),
  };
}
