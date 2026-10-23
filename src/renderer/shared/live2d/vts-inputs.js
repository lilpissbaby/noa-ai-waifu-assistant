// Señales de Behaviour → entradas de seguimiento como las de VTube Studio (lo que daría una
// cámara de cara), en sus mismos rangos: ángulos ±30°, ojos y boca 0–1, cejas 0–1 con 0,5 neutro.
const clamp = (v, a, b) => Math.max(a, Math.min(b, Number.isFinite(v) ? v : 0));
const DEG = 180 / Math.PI;

export function vtsInputs(s) {
  const lx = clamp(s.look?.x ?? 0, -1, 1);
  const ly = clamp(s.look?.y ?? 0, -1, 1);
  const emo = s.emotion || { name: 'neutral', weight: 0 };
  const w = (name) => (emo.name === name ? clamp(emo.weight, 0, 1) : 0);
  const happy = w('happy');
  const sad = w('sad');
  const angry = w('angry');
  const surprised = w('surprised');
  const relaxed = w('relaxed');
  const blink = clamp(s.blink, 0, 1);
  const mouth = clamp(s.mouth, 0, 1);
  const eye = clamp(1 - Math.max(blink, happy * 0.35 + relaxed * 0.25) + surprised * 0.15, 0, 1);
  const smile = clamp(0.5 + 0.5 * happy + 0.25 * relaxed - 0.4 * sad - 0.35 * angry, 0, 1);
  const brows = clamp(0.5 + 0.5 * surprised - 0.4 * angry + 0.1 * sad, 0, 1);
  const breath = (clamp(s.breath, -1, 1) + 1) / 2;
  const sway = Number.isFinite(s.sway) ? s.sway : 0;
  const tilt = Number.isFinite(s.tilt) ? s.tilt : 0;
  const lift = clamp(s.lift, 0, 1);
  return {
    FaceAngleX: clamp(lx * 30 + sway * 60, -30, 30),
    FaceAngleY: clamp(-ly * 30 + lift * 8, -30, 30),
    FaceAngleZ: clamp(tilt * DEG * 1.5 + sway * 40, -30, 30),
    FacePositionX: clamp(sway * 80, -10, 10),
    FacePositionY: clamp((s.hop || 0) * 6 + (breath - 0.5) * 0.6, -10, 10),
    FacePositionZ: 0,
    EyeOpenLeft: eye,
    EyeOpenRight: eye,
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
    // Interna (no es de VTS): la respiración para ParamBreath.
    Breath: breath,
  };
}
