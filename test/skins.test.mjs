import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { __test } from 'electron';
import { listSkins, getSkin } from '../src/main/skins.js';

test('la skin de serie «noa-3d» es un VRM servido desde el paquete', () => {
  const s = listSkins().find((x) => x.id === 'noa-3d');
  assert.ok(s, 'falta noa-3d');
  assert.equal(s.type, 'vrm');
  assert.equal(s.builtin, true);
  assert.equal(s.urls.model, 'app://local/bundle/assets/skins/noa-3d/model.vrm');
  assert.ok(s.thumb.endsWith('/thumb.png'));
  assert.ok(fs.statSync(path.resolve(import.meta.dirname, '../assets/skins/noa-3d/model.vrm')).size > 1e6);
  for (const f of ['thumb.png', 'LICENSE.txt']) assert.ok(fs.existsSync(path.resolve(import.meta.dirname, '../assets/skins/noa-3d', f)), `falta ${f}`);
});

test('un manifiesto sin type es una skin 2D', () => {
  const dir = path.join(__test.userData, 'skins', 'vieja');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'skin.json'), JSON.stringify({ id: 'vieja', name: 'Vieja', width: 10, height: 20, files: { base: 'base.png' } }));
  assert.equal(getSkin('vieja').type, '2d');
  assert.equal(getSkin('default').type, '2d');
});

test('stageVrm + saveVrmSkin: importar, guardar, ajustar y duplicar una de serie', async () => {
  const { stageVrm, saveVrmSkin, clearVrmTmp } = await import('../src/main/skins.js');
  const model = path.resolve(import.meta.dirname, '../assets/skins/noa-3d/model.vrm');
  const bad = path.join(__test.userData, 'bad.vrm');
  fs.writeFileSync(bad, 'nada');
  assert.deepEqual(stageVrm(bad), { error: 'notGlb' });

  const st = stageVrm(model, 'Mi chica');
  assert.ok(st.tmpId && st.url.startsWith('app://local/user/tmp/'));
  assert.equal(st.name, 'Mi chica');
  const tmpFile = path.join(__test.userData, 'tmp', `${st.tmpId}.vrm`);
  assert.ok(fs.existsSync(tmpFile));

  const thumb = 'data:image/png;base64,iVBORw0KGgo=';
  const m = saveVrmSkin({ tmpId: st.tmpId, name: 'Mi chica', framing: { preset: 'bust', zoom: 9 }, thumb });
  assert.equal(m.type, 'vrm');
  assert.equal(m.builtin, false);
  assert.deepEqual(m.framing, { preset: 'bust', zoom: 1.6, yaw: 0, pitch: 0, offsetY: 0 });
  assert.equal(m.meta.title, 'VRM1_Constraint_Twist_Sample');
  assert.ok(fs.existsSync(path.join(__test.userData, 'skins', m.id, 'model.vrm')));
  assert.ok(fs.existsSync(path.join(__test.userData, 'skins', m.id, 'thumb.png')));
  assert.equal(fs.existsSync(tmpFile), false, 'el temporal se borra al guardar');

  const m2 = saveVrmSkin({ id: m.id, name: 'Renombrada', framing: { preset: 'full' } });
  assert.equal(m2.id, m.id);
  assert.equal(m2.name, 'Renombrada');
  assert.equal(m2.framing.preset, 'full');
  assert.ok(m2.urls.model.endsWith(`/skins/${m.id}/model.vrm`));

  const copy = saveVrmSkin({ id: 'noa-3d', copyFrom: 'noa-3d', name: 'Mi Noa', framing: { preset: 'full' } });
  assert.notEqual(copy.id, 'noa-3d');
  assert.equal(copy.builtin, false);
  assert.ok(fs.existsSync(path.join(__test.userData, 'skins', copy.id, 'model.vrm')));

  fs.mkdirSync(path.join(__test.userData, 'tmp'), { recursive: true });
  fs.writeFileSync(path.join(__test.userData, 'tmp', 'resto.vrm'), 'x');
  clearVrmTmp();
  assert.deepEqual(fs.readdirSync(path.join(__test.userData, 'tmp')), []);
});
