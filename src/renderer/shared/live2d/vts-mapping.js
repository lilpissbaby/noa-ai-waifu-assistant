// Parámetros de un modelo Live2D a partir de las entradas de seguimiento, como VTube Studio:
// con su .vtube.json (ParameterSettings) o, si no hay, con los parámetros estándar de Cubism.
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

export function parseVtsConfig(json) {
  const out = { params: [], breathing: false, breathParams: [], hotkeys: [] };
  if (!json || typeof json !== 'object') return out;
  for (const p of Array.isArray(json.ParameterSettings) ? json.ParameterSettings : []) {
    const output = String(p?.OutputLive2D || '').trim();
    if (!output) continue;
    if (p.UseBreathing) {
      out.breathing = true;
      out.breathParams.push(output);
    }
    const input = String(p.Input || '').trim();
    if (!input) continue;
    out.params.push({
      input,
      inMin: num(p.InputRangeLower),
      inMax: num(p.InputRangeUpper, 1),
      outMin: num(p.OutputRangeLower),
      outMax: num(p.OutputRangeUpper, 1),
      clampIn: !!p.ClampInput,
      clampOut: !!p.ClampOutput,
      smoothing: Math.max(0, Math.min(100, num(p.Smoothing))),
      output,
    });
  }
  for (const h of Array.isArray(json.Hotkeys) ? json.Hotkeys : []) if (h?.Action) out.hotkeys.push({ name: String(h.Name || ''), action: String(h.Action), file: String(h.File || '') });
  return out;
}

const clampRange = (v, a, b) => Math.max(Math.min(a, b), Math.min(Math.max(a, b), v));

export class VtsMapper {
  constructor(config) {
    this.config = { params: [], breathing: false, breathParams: [], hotkeys: [], ...config };
    this.state = new Map();
  }

  // entradas → Map(idParámetro → valor). smoothing 0–100: fracción que queda por recorrer en cada 1/30 s.
  apply(inputs, dt = 1 / 30) {
    const out = new Map();
    this.config.params.forEach((p, i) => {
      let x = inputs[p.input];
      if (!Number.isFinite(x)) return;
      if (p.clampIn) x = clampRange(x, p.inMin, p.inMax);
      const span = p.inMax - p.inMin || 1;
      let y = p.outMin + ((x - p.inMin) / span) * (p.outMax - p.outMin);
      if (p.clampOut) y = clampRange(y, p.outMin, p.outMax);
      const prev = this.state.get(i);
      if (prev !== undefined && p.smoothing > 0) {
        const keep = Math.min(0.99, p.smoothing / 100) ** Math.max(0, dt * 30);
        y = prev + (y - prev) * (1 - keep);
      }
      this.state.set(i, y);
      out.set(p.output, y);
    });
    if (this.config.breathing && Number.isFinite(inputs.Breath)) for (const id of this.config.breathParams) if (!out.has(id)) out.set(id, inputs.Breath);
    return out;
  }
}

const groupIds = (model3, name) => (model3?.Groups || []).find((g) => g?.Target === 'Parameter' && g?.Name === name)?.Ids || [];

// Sin .vtube.json: los parámetros estándar del editor de Cubism.
export function standardMapping(model3) {
  const p = (input, inMin, inMax, outMin, outMax, output, smoothing = 10) => ({ input, inMin, inMax, outMin, outMax, clampIn: true, clampOut: true, smoothing, output });
  const [eyeL = 'ParamEyeLOpen', eyeR = 'ParamEyeROpen'] = groupIds(model3, 'EyeBlink');
  const lips = groupIds(model3, 'LipSync');
  const params = [
    p('FaceAngleX', -30, 30, -30, 30, 'ParamAngleX'),
    p('FaceAngleY', -30, 30, -30, 30, 'ParamAngleY'),
    p('FaceAngleZ', -30, 30, -30, 30, 'ParamAngleZ'),
    p('FaceAngleX', -30, 30, -10, 10, 'ParamBodyAngleX', 20),
    p('FaceAngleY', -30, 30, -10, 10, 'ParamBodyAngleY', 20),
    p('FaceAngleZ', -30, 30, -10, 10, 'ParamBodyAngleZ', 20),
    p('EyeOpenLeft', 0, 1, 0, 1, eyeL, 0),
    p('EyeOpenRight', 0, 1, 0, 1, eyeR, 0),
    p('EyeLeftX', -1, 1, -1, 1, 'ParamEyeBallX', 15),
    p('EyeLeftY', -1, 1, -1, 1, 'ParamEyeBallY', 15),
    ...(lips.length ? lips : ['ParamMouthOpenY']).map((id) => p('MouthOpen', 0, 1, 0, 1, id, 0)),
    p('MouthSmile', 0, 1, -1, 1, 'ParamMouthForm', 20),
    p('BrowLeftY', 0, 1, -1, 1, 'ParamBrowLY', 20),
    p('BrowRightY', 0, 1, -1, 1, 'ParamBrowRY', 20),
  ];
  return new VtsMapper({ params, breathing: true, breathParams: ['ParamBreath'], hotkeys: [] });
}
