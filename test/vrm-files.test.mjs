import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateVrmFile, MAX_VRM_BYTES } from '../src/main/vrm-files.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-files-'));

// GLB mínimo: cabecera + chunk JSON (+ chunk BIN opcional).
function glb(json, { bin = 8, declared } = {}) {
  let j = Buffer.from(JSON.stringify(json), 'utf8');
  if (j.length % 4) j = Buffer.concat([j, Buffer.alloc(4 - (j.length % 4), 0x20)]);
  const b = Buffer.alloc(bin);
  const total = 12 + 8 + j.length + (bin ? 8 + bin : 0);
  const head = Buffer.alloc(12);
  head.write('glTF', 0, 'ascii');
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(declared ?? total, 8);
  const jh = Buffer.alloc(8);
  jh.writeUInt32LE(j.length, 0);
  jh.writeUInt32LE(0x4e4f534a, 4);
  const parts = [head, jh, j];
  if (bin) {
    const bh = Buffer.alloc(8);
    bh.writeUInt32LE(bin, 0);
    bh.writeUInt32LE(0x004e4942, 4);
    parts.push(bh, b);
  }
  return Buffer.concat(parts);
}
const write = (name, buf) => {
  const p = path.join(dir, name);
  fs.writeFileSync(p, buf);
  return p;
};

const VRM1 = {
  asset: { version: '2.0' },
  extensions: {
    VRMC_vrm: {
      specVersion: '1.0',
      humanoid: { humanBones: { hips: { node: 0 } } },
      meta: { name: 'Chica', authors: ['Ana'], version: '1', licenseUrl: 'https://vrm.dev/licenses/1.0/', avatarPermission: 'everyone', commercialUsage: 'personalNonProfit', allowRedistribution: true, modification: 'prohibited', thumbnailImage: 3 },
    },
  },
};
const VRM0 = {
  asset: { version: '2.0' },
  extensions: { VRM: { exporterVersion: 'UniVRM-0.99', humanoid: { humanBones: [{ bone: 'hips', node: 0 }] }, meta: { title: 'Viejo', author: 'Bea', version: '0.9', allowedUserName: 'Everyone', commercialUssageName: 'Disallow', licenseName: 'CC_BY', texture: 1 } } },
};

test('VRM 1.0 válido', () => {
  const r = validateVrmFile(write('a.vrm', glb(VRM1)));
  assert.equal(r.ok, true);
  assert.equal(r.version, '1');
  assert.equal(r.meta.title, 'Chica');
  assert.deepEqual(r.meta.authors, ['Ana']);
  assert.equal(r.meta.license.allowRedistribution, true);
  assert.equal(r.meta.license.commercialUsage, 'personalNonProfit');
  assert.equal('thumbnailImage' in r.meta.license, false);
});

test('VRM 0.x válido', () => {
  const r = validateVrmFile(write('b.vrm', glb(VRM0)));
  assert.equal(r.ok, true);
  assert.equal(r.version, '0');
  assert.equal(r.meta.title, 'Viejo');
  assert.deepEqual(r.meta.authors, ['Bea']);
  assert.equal(r.meta.license.licenseName, 'CC_BY');
  assert.equal(r.meta.license.allowedUserName, 'Everyone');
});

test('GLB sin VRM o sin esqueleto humanoide', () => {
  assert.deepEqual(validateVrmFile(write('c.glb', glb({ asset: { version: '2.0' } }))), { ok: false, reason: 'notVrm' });
  const noHumanoid = structuredClone(VRM1);
  delete noHumanoid.extensions.VRMC_vrm.humanoid;
  assert.deepEqual(validateVrmFile(write('d.vrm', glb(noHumanoid))), { ok: false, reason: 'notVrm' });
});

test('texto plano no es GLB', () => {
  assert.deepEqual(validateVrmFile(write('e.vrm', Buffer.from('hola, no soy un modelo 3D'))), { ok: false, reason: 'notGlb' });
});

test('cabecera que declara más bytes de los que hay', () => {
  const full = glb(VRM1, { bin: 64 });
  assert.deepEqual(validateVrmFile(write('f.vrm', full.subarray(0, full.length - 40))), { ok: false, reason: 'truncated' });
});

test('más de 150 MB', () => {
  assert.equal(MAX_VRM_BYTES, 150 * 1024 * 1024);
  const p = path.join(dir, 'g.vrm');
  fs.writeFileSync(p, glb(VRM1));
  fs.truncateSync(p, MAX_VRM_BYTES + 1);
  assert.deepEqual(validateVrmFile(p), { ok: false, reason: 'tooBig' });
});

test('archivo que no existe', () => {
  assert.deepEqual(validateVrmFile(path.join(dir, 'no-existe.vrm')), { ok: false, reason: 'notGlb' });
});

test('la skin de serie pasa la validación', () => {
  const r = validateVrmFile(path.resolve(import.meta.dirname, '../assets/skins/noa-3d/model.vrm'));
  assert.equal(r.ok, true);
  assert.equal(r.version, '1');
  assert.equal(r.meta.license.allowRedistribution, true);
});
