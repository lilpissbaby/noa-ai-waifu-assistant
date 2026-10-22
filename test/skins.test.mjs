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
