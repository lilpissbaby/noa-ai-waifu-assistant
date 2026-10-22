import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mouthShapes, expressionWeights, lookOffsets, applyToVrm } from '../src/renderer/shared/vrm/drive-vrm.js';

const VOWELS = ['aa', 'ih', 'ou', 'ee', 'oh'];
const sum = (o) => VOWELS.reduce((a, k) => a + o[k], 0);
const secondary = (o) => VOWELS.slice(1).find((k) => o[k] > 0);

const signals = (over = {}) => ({
  t: 1,
  state: 'idle',
  breath: 0,
  blink: 0,
  mouth: 0,
  look: { x: 0, y: 0 },
  sway: 0,
  tilt: 0,
  lift: 0,
  hop: 0,
  emotion: { name: 'neutral', weight: 0 },
  talking: false,
  events: [],
  ...over,
});

test('mouthShapes: boca cerrada sin nivel', () => {
  assert.deepEqual(mouthShapes(0, 1234), { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 });
});

test('mouthShapes: suma = nivel y «aa» al menos el 40 %', () => {
  for (let i = 0; i < 200; i++) {
    const level = (i % 10) / 10 + 0.05;
    const m = mouthShapes(level, i * 37.3);
    assert.ok(Math.abs(sum(m) - level) < 1e-9, `suma ${sum(m)} ≠ ${level}`);
    assert.ok(m.aa >= 0.4 * level - 1e-12);
  }
});

test('mouthShapes: la vocal secundaria cambia en cualquier ventana de 170 ms', () => {
  for (let start = 0; start < 5000; start += 61) {
    const seen = new Set();
    for (let t = start; t <= start + 170; t += 5) seen.add(secondary(mouthShapes(0.8, t)));
    assert.ok(seen.size >= 2, `sin cambios en [${start}, ${start + 170}]`);
  }
});

test('expressionWeights: la sonrisa anula el parpadeo', () => {
  const w = expressionWeights(signals({ blink: 1, emotion: { name: 'happy', weight: 0.6 } }));
  assert.equal(w.blink, 0);
  assert.equal(w.happy, 0.6);
  assert.equal(w.sad, 0);
  assert.equal(expressionWeights(signals({ blink: 1, emotion: { name: 'happy', weight: 0.4 } })).blink, 1);
});

test('expressionWeights: las vocales salen de la boca', () => {
  const w = expressionWeights(signals({ mouth: 0.5 }));
  assert.ok(Math.abs(sum(w) - 0.5) < 1e-9);
});

test('lookOffsets: ojos 25°/15°, cabeza y cuello reparten el 40 %', () => {
  const deg = Math.PI / 180;
  const o = lookOffsets(signals({ look: { x: 1, y: 0.5 } }));
  assert.ok(Math.abs(o.eyes.yaw - 25 * deg) < 1e-9);
  assert.ok(Math.abs(o.eyes.pitch - -7.5 * deg) < 1e-9);
  const turn = 35 * 0.4 * deg;
  assert.ok(Math.abs(o.neck.y - turn * 0.4) < 1e-9);
  assert.ok(Math.abs(o.head.y - turn * 0.6) < 1e-9);
  assert.ok(Math.abs(o.neck.x + o.head.x - 0.5 * 20 * 0.4 * deg) < 1e-9);
});

test('applyToVrm no falla con un modelo sin expresiones, sin mirada ni huesos opcionales', () => {
  const vrm = { humanoid: { getNormalizedBoneNode: () => null } };
  assert.doesNotThrow(() => applyToVrm(vrm, signals({ mouth: 0.7, blink: 1, look: { x: 0.3, y: -0.2 }, hop: 0.5, emotion: { name: 'sad', weight: 1 } }), {}));
  const vrm2 = { humanoid: { getNormalizedBoneNode: () => null }, expressionManager: { getExpression: () => null, setValue() { throw new Error('no debería llamarse'); } }, lookAt: null };
  assert.doesNotThrow(() => applyToVrm(vrm2, signals({ mouth: 0.7 }), {}));
});

test('applyToVrm solo toca expresiones que existen', () => {
  const set = {};
  const vrm = {
    humanoid: { getNormalizedBoneNode: () => null },
    expressionManager: { getExpression: (n) => (['aa', 'blink', 'happy'].includes(n) ? {} : null), setValue: (n, v) => (set[n] = v) },
  };
  applyToVrm(vrm, signals({ mouth: 0.5, blink: 0.3, emotion: { name: 'angry', weight: 1 } }), {});
  assert.deepEqual(Object.keys(set).sort(), ['aa', 'blink', 'happy']);
  assert.equal(set.blink, 0.3);
});
