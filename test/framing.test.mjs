import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeFraming, normalizeFraming, DEFAULT_FRAMING } from '../src/renderer/shared/vrm/framing.js';

const dims = { top: 1.55, chestY: 1.15, hipsY: 0.85, bottom: 0, shoulderWidth: 0.34 };
const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);
const f = (over) => ({ ...DEFAULT_FRAMING, ...over });

test('full: de los pies a la cabeza', () => {
  const r = computeFraming(dims, f({ preset: 'full' }));
  near(r.height, 1.55 * 1.08);
  near(r.target[1], 0.775);
  near(r.aspect, (0.34 * 2.0) / 1.55);
  near(r.position[2], (r.height / 2) / Math.tan((10 * Math.PI) / 180));
  near(r.position[1], r.target[1]);
});

test('half: de la cadera a la cabeza', () => {
  const r = computeFraming(dims, f({ preset: 'half' }));
  const low = 0.85 - 0.08 * (1.55 - 0.85);
  near(r.height, (1.55 - low) * 1.08);
  near(r.target[1], (low + 1.55) / 2);
  near(r.aspect, Math.min(1.1, (0.34 * 2.8) / (1.55 - low)));
});

test('bust: del pecho a la cabeza, proporción recortada a 1,1', () => {
  const r = computeFraming(dims, f({ preset: 'bust' }));
  near(r.height, (1.55 - 1.05) * 1.08);
  near(r.target[1], 1.3);
  assert.equal(r.aspect, 1.1);
});

test('normalizeFraming recorta a los rangos y rellena lo que falta', () => {
  assert.deepEqual(normalizeFraming({ preset: 'raro', zoom: 2, yaw: 90, pitch: -40, offsetY: 1 }), { preset: 'half', zoom: 1.6, yaw: 45, pitch: -15, offsetY: 0.2 });
  assert.deepEqual(normalizeFraming(undefined), DEFAULT_FRAMING);
  assert.deepEqual(normalizeFraming({ zoom: 'x' }), DEFAULT_FRAMING);
});

test('zoom acerca la cámara sin cambiar la proporción', () => {
  const a = computeFraming(dims, f({ zoom: 1 }));
  const b = computeFraming(dims, f({ zoom: 2 }));
  near(b.height, a.height / 1.6);
  near(b.aspect, a.aspect);
  assert.ok(b.position[2] < a.position[2]);
});

test('pitch sube la cámara y el objetivo no cambia', () => {
  const a = computeFraming(dims, f({ pitch: 0 }));
  const b = computeFraming(dims, f({ pitch: 10 }));
  assert.deepEqual(b.target, a.target);
  assert.ok(b.position[1] > a.position[1]);
  const d = Math.hypot(b.position[1] - b.target[1], b.position[2] - b.target[2]);
  near(d, a.position[2] - a.target[2]);
});

test('offsetY desplaza el objetivo una fracción del alto visible', () => {
  const a = computeFraming(dims, f({ offsetY: 0 }));
  const b = computeFraming(dims, f({ offsetY: 0.1 }));
  near(b.target[1] - a.target[1], 0.1 * a.height);
});
