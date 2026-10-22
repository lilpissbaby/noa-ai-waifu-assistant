import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSkinWithFallback, kindOf } from '../src/renderer/shared/renderer-factory.js';

const fakeRenderer = (kind, fail) => ({ kind, load: async (skin) => (fail ? Promise.reject(new Error(`no carga ${skin.id}`)) : { ...skin, loaded: true }) });

test('kindOf: vrm o 2d', () => {
  assert.equal(kindOf({ type: 'vrm' }), 'vrm');
  assert.equal(kindOf({ type: '2d' }), '2d');
  assert.equal(kindOf({}), '2d');
});

test('loadSkinWithFallback: si el VRM no carga, vuelve a la skin 2D y avisa', async () => {
  const asked = [];
  const errors = [];
  const r = await loadSkinWithFallback({
    skin: { id: 'noa-3d', type: 'vrm' },
    fallback: { id: 'default', type: '2d' },
    ensure: async (kind) => (asked.push(kind), fakeRenderer(kind, kind === 'vrm')),
    onError: (e) => errors.push(e.message),
  });
  assert.deepEqual(asked, ['vrm', '2d']);
  assert.deepEqual(errors, ['no carga noa-3d']);
  assert.equal(r.renderer.kind, '2d');
  assert.equal(r.skin.id, 'default');
  assert.equal(r.failed, true);
});

test('loadSkinWithFallback: sin errores no toca la skin de respaldo', async () => {
  const asked = [];
  const r = await loadSkinWithFallback({ skin: { id: 'noa-3d', type: 'vrm' }, fallback: { id: 'default' }, ensure: async (kind) => (asked.push(kind), fakeRenderer(kind)), onError: () => assert.fail('no debería avisar') });
  assert.deepEqual(asked, ['vrm']);
  assert.equal(r.skin.loaded, true);
  assert.equal(r.failed, false);
});

test('loadSkinWithFallback: si también falla la de respaldo, lanza el error', async () => {
  await assert.rejects(loadSkinWithFallback({ skin: { id: 'a', type: 'vrm' }, fallback: { id: 'b' }, ensure: async (kind) => fakeRenderer(kind, true), onError: () => {} }), /no carga b/);
});
