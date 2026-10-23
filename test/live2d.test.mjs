import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { vtsInputs } from '../src/renderer/shared/live2d/vts-inputs.js';
import { parseVtsConfig, VtsMapper, standardMapping } from '../src/renderer/shared/live2d/vts-mapping.js';
import { autoAssignExpressions } from '../src/renderer/shared/live2d/expressions.js';
import { framing2d, normalizeFraming2d } from '../src/renderer/shared/live2d/framing2d.js';
import { findModels } from '../src/main/live2d.js';

const base = (extra = {}) => ({ t: 0, state: 'idle', breath: 0, blink: 0, mouth: 0, look: { x: 0, y: 0 }, sway: 0, tilt: 0, lift: 0, hop: 0, emotion: { name: 'neutral', weight: 0 }, talking: false, events: [], ...extra });

test('vtsInputs: mirada, parpadeo, boca y emociones en los rangos de VTube Studio', () => {
  const n = vtsInputs(base());
  assert.equal(n.FaceAngleX, 0);
  assert.equal(n.EyeOpenLeft, 1);
  assert.equal(n.Brows, 0.5);
  assert.equal(n.MouthOpen, 0);
  assert.equal(vtsInputs(base({ look: { x: 1, y: 0 } })).FaceAngleX, 30);
  assert.equal(vtsInputs(base({ look: { x: -1, y: 0 } })).FaceAngleX, -30);
  assert.ok(vtsInputs(base({ look: { x: 0, y: 1 } })).FaceAngleY < 0, 'mirar abajo');
  assert.equal(vtsInputs(base({ look: { x: 1, y: 0 } })).EyeLeftX, 1);
  const blink = vtsInputs(base({ blink: 1 }));
  assert.equal(blink.EyeOpenLeft, 0);
  assert.equal(blink.EyeOpenRight, 0);
  assert.equal(vtsInputs(base({ mouth: 0.7 })).MouthOpen, 0.7);
  assert.equal(vtsInputs(base({ mouth: 0.7 })).VoiceVolumePlusMouthOpen, 0.7);
  assert.equal(vtsInputs(base({ emotion: { name: 'happy', weight: 1 } })).MouthSmile, 1);
  assert.ok(vtsInputs(base({ emotion: { name: 'surprised', weight: 1 } })).Brows > 0.5);
  assert.ok(vtsInputs(base({ emotion: { name: 'angry', weight: 1 } })).Brows < 0.5);
  assert.ok(vtsInputs(base({ emotion: { name: 'sad', weight: 1 } })).MouthSmile < 0.5);
  for (const v of Object.values(vtsInputs(base({ look: { x: 3, y: -3 }, blink: 2, mouth: 5 })))) assert.ok(Number.isFinite(v));
  assert.equal(vtsInputs(base({ look: { x: 3, y: 0 } })).FaceAngleX, 30);
});

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/live2d/hiyori.vtube.json', import.meta.url), 'utf8'));

test('parseVtsConfig lee parámetros, respiración y atajos', () => {
  const c = parseVtsConfig(fixture);
  assert.equal(c.params.length, 4); // el de respiración no tiene entrada: va aparte
  assert.deepEqual(c.params[1], { input: 'FaceAngleY', inMin: -20, inMax: 20, outMin: 30, outMax: -30, clampIn: false, clampOut: true, smoothing: 20, output: 'ParamAngleY' });
  assert.equal(c.breathing, true);
  assert.deepEqual(c.breathParams, ['ParamBreath']);
  assert.deepEqual(c.hotkeys, [
    { name: 'Smile', action: 'ToggleExpression', file: 'Smile.exp3.json' },
    { name: 'Angry', action: 'ToggleExpression', file: 'Angry.exp3.json' },
    { name: 'Wave', action: 'TriggerAnimation', file: 'motions/Hiyori_m04.motion3.json' },
  ]);
  assert.deepEqual(parseVtsConfig({}), { params: [], breathing: false, breathParams: [], hotkeys: [] });
  assert.deepEqual(parseVtsConfig(null), { params: [], breathing: false, breathParams: [], hotkeys: [] });
});

test('VtsMapper: rango invertido, recorte y suavizado', () => {
  const m = new VtsMapper({
    params: [
      { input: 'FaceAngleY', inMin: -20, inMax: 20, outMin: 30, outMax: -30, clampIn: false, clampOut: true, smoothing: 0, output: 'ParamAngleY' },
      { input: 'MouthOpen', inMin: 0, inMax: 1, outMin: 0, outMax: 1, clampIn: false, clampOut: false, smoothing: 50, output: 'ParamMouthOpenY' },
    ],
  });
  let out = m.apply({ FaceAngleY: 10, MouthOpen: 0 }, 1 / 30);
  assert.equal(out.get('ParamAngleY'), -15);
  out = m.apply({ FaceAngleY: 40, MouthOpen: 1 }, 1 / 30);
  assert.equal(out.get('ParamAngleY'), -30); // clampOut
  assert.ok(Math.abs(out.get('ParamMouthOpenY') - 0.5) < 1e-9); // smoothing 50: la mitad en 1/30 s
  out = m.apply({ FaceAngleY: 0, MouthOpen: 1 }, 1 / 30);
  assert.ok(Math.abs(out.get('ParamMouthOpenY') - 0.75) < 1e-9);
  // Una entrada que no existe no toca el parámetro.
  assert.equal(m.apply({ FaceAngleY: 0 }, 1 / 30).has('ParamMouthOpenY'), false);
});

test('standardMapping: parámetros estándar y grupos EyeBlink/LipSync del model3.json', () => {
  const plain = standardMapping({ Version: 3, FileReferences: {} });
  const outs = plain.config.params.map((p) => p.output);
  for (const id of ['ParamAngleX', 'ParamAngleY', 'ParamAngleZ', 'ParamBodyAngleX', 'ParamEyeLOpen', 'ParamEyeROpen', 'ParamEyeBallX', 'ParamEyeBallY', 'ParamMouthOpenY', 'ParamMouthForm', 'ParamBrowLY', 'ParamBrowRY'])
    assert.ok(outs.includes(id), id);
  assert.equal(plain.config.breathing, true);
  const r = plain.apply(vtsInputs(base({ mouth: 1, look: { x: 1, y: 0 } })), 1);
  assert.ok(r.get('ParamMouthOpenY') > 0.9);
  assert.ok(r.get('ParamAngleX') > 20);
  const grouped = standardMapping({
    Groups: [
      { Target: 'Parameter', Name: 'LipSync', Ids: ['PARAM_MOUTH_OPEN_Y'] },
      { Target: 'Parameter', Name: 'EyeBlink', Ids: ['PARAM_EYE_L_OPEN', 'PARAM_EYE_R_OPEN'] },
    ],
  });
  const gouts = grouped.config.params.map((p) => p.output);
  assert.ok(gouts.includes('PARAM_MOUTH_OPEN_Y'));
  assert.ok(!gouts.includes('ParamMouthOpenY'));
  assert.ok(gouts.includes('PARAM_EYE_L_OPEN') && gouts.includes('PARAM_EYE_R_OPEN'));
});

test('autoAssignExpressions por nombre (también en japonés)', () => {
  assert.deepEqual(autoAssignExpressions(['Smile.exp3.json', '怒り.exp3.json', 'f03.exp3.json']), { happy: 'Smile.exp3.json', angry: '怒り.exp3.json' });
  assert.deepEqual(autoAssignExpressions(['exp_Sad', 'Surprised', 'calm', '照れ', 'Joy']), { sad: 'exp_Sad', surprised: 'Surprised', relaxed: 'calm', happy: 'Joy' });
  assert.deepEqual(autoAssignExpressions([]), {});
});

test('findModels: model3.json y aviso de Cubism 2', () => {
  assert.deepEqual(findModels(['a/b/x.model3.json', 'a/y.model3.json', 'a/tex.png']), { models: ['a/y.model3.json', 'a/b/x.model3.json'], cubism2: false });
  assert.deepEqual(findModels(['old/model.json', 'old/model.moc', 'old/tex.png']), { models: [], cubism2: true });
  assert.deepEqual(findModels(['nada.txt']), { models: [], cubism2: false });
});

test('framing2d: bust acerca más que half y half más que full', () => {
  const bounds = { width: 1000, height: 2000 };
  const box = { x: 8, y: 58, w: 300, h: 400 };
  const full = framing2d(bounds, { preset: 'full' }, box);
  const half = framing2d(bounds, { preset: 'half' }, box);
  const bust = framing2d(bounds, { preset: 'bust' }, box);
  assert.ok(bust.scale > half.scale && half.scale > full.scale);
  assert.ok(full.scale * bounds.height <= box.h && full.scale * bounds.width <= box.w);
  assert.equal(full.x, box.x + box.w / 2);
  const zoomed = framing2d(bounds, { preset: 'half', zoom: 1.5 }, box);
  assert.ok(Math.abs(zoomed.scale - half.scale * 1.5) < 1e-9);
  assert.ok(framing2d(bounds, { preset: 'half', offsetY: 0.2 }, box).y > half.y);
  assert.deepEqual(normalizeFraming2d({ preset: 'x', zoom: 9, offsetY: -1 }), { preset: 'half', zoom: 1.6, offsetY: -0.2 });
});

test('importar modelos: zip con model3.json, Cubism 2, enlaces y guardar la skin', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const { makeZip } = await import('./helpers/zip.mjs');
  const { stageLive2d, saveLive2dSkin, importCore, coreStatus } = await import('../src/main/live2d.js');
  const { __test } = await import('electron');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'waifu-l2d-'));
  const zip = path.join(dir, 'chica.zip');
  fs.writeFileSync(
    zip,
    makeZip([
      { name: 'Chica/chica.model3.json', data: '{"Version":3}' },
      { name: 'Chica/chica.moc3', data: 'moc' },
      { name: 'Chica/chica.vtube.json', data: '{}' },
      { name: 'Chica/README.txt', data: 'Uso personal permitido. Prohibido revender.' },
      { name: '__MACOSX/Chica/._chica.moc3', data: 'x' },
    ]),
  );
  const st = stageLive2d(zip);
  assert.deepEqual(st.models, ['Chica/chica.model3.json']);
  assert.deepEqual(st.vts, ['Chica/chica.vtube.json']);
  assert.match(st.readmes[0].text, /revender/);
  const skin = saveLive2dSkin({ tmpId: st.tmpId, model: st.models[0], vts: st.vts[0], name: 'Chica', framing: { preset: 'bust' }, expressions: { happy: 'Smile' } });
  assert.equal(skin.type, 'live2d');
  assert.equal(skin.files.model, 'model/Chica/chica.model3.json');
  assert.equal(skin.vts, 'model/Chica/chica.vtube.json');
  assert.ok(fs.existsSync(path.join(__test.userData, 'skins', skin.id, 'model', 'Chica', 'chica.moc3')));
  assert.throws(() => saveLive2dSkin({ id: skin.id, model: '../../config.json' }), (e) => e.code === 'unsafe');

  const old = path.join(dir, 'old.zip');
  fs.writeFileSync(old, makeZip([{ name: 'm/model.json', data: '{}' }, { name: 'm/m.moc', data: 'x' }]));
  assert.deepEqual(stageLive2d(old), { error: 'cubism2' });
  const bad = path.join(dir, 'bad.zip');
  fs.writeFileSync(bad, makeZip([{ name: 'x.model3.json', data: '{}' }, { name: 'link', data: '/etc/passwd', mode: 0o120777 }]));
  assert.deepEqual(stageLive2d(bad), { error: 'unsafe' });

  // Core: desde el .zip del SDK (Core/live2dcubismcore.min.js) o el .js suelto; lo demás se rechaza.
  const core = '/**\n * Live2D Cubism Core\n */\nvar Live2DCubismCore;';
  const sdk = path.join(dir, 'CubismSdkForWeb-5-r.5.zip');
  fs.writeFileSync(sdk, makeZip([{ name: 'CubismSdkForWeb-5-r.5/Core/live2dcubismcore.min.js', data: core }]));
  assert.equal(coreStatus().ready, false);
  assert.equal(importCore(sdk).ready, true);
  assert.equal(coreStatus().url, 'app://local/user/runtime/live2d/live2dcubismcore.min.js');
  const fake = path.join(dir, 'virus.js');
  fs.writeFileSync(fake, 'alert(1)');
  assert.throws(() => importCore(fake), (e) => e.code === 'notCore');
});
