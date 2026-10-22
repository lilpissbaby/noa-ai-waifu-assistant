import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Animator } from './helpers/animator-v0.2.mjs';
import { Behaviour } from '../src/renderer/shared/behaviour.js';
import { drive2d } from '../src/renderer/shared/drive-2d.js';

// Generador pseudoaleatorio con semilla (mulberry32) para que ambos lados vean la misma secuencia.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const H = 1000;
const NECK = { x: 400, y: 430 };
const toCss = (ix, iy) => [ix * 0.3 + 8, iy * 0.3 + 58];

// Guion común: cursor que se mueve, estados, charla simulada, audio y saltitos.
function script(i, now) {
  return {
    cursor: i < 40 ? null : { x: 120 + Math.sin(i / 17) * 400, y: 80 + Math.cos(i / 23) * 250 },
    state: i < 100 ? 'idle' : i < 220 ? 'thinking' : i < 300 ? 'listening' : i < 450 ? 'talking' : 'idle',
    fakeTalkUntil: i >= 300 && i < 360 ? now + 1000 : 0,
    level: i >= 380 && i < 450 ? Math.abs(Math.sin(i / 3)) : 0,
    hop: i === 120 || i === 470,
  };
}

test('drive2d(Behaviour) reproduce el Animator 0.2', () => {
  const realRandom = Math.random;
  const oldRand = seeded(42);
  const newRand = seeded(42);
  const fake = { params: { blink: 0, mouth: 0, headAngle: 0, headX: 0, headY: 0, breath: 0, bounce: 0 }, skin: { height: H, rig: { neck: NECK } }, view: {}, imageToCss: toCss };
  const anim = new Animator(fake);
  anim.t0 = 0;
  const beh = new Behaviour({ random: newRand, now: 0 });
  let level = 0;
  anim.levelFn = () => level;
  beh.levelFn = () => level;
  try {
    for (let i = 0; i < 600; i++) {
      const now = i * 16.7;
      const s = script(i, now);
      level = s.level;
      anim.cursor = s.cursor;
      beh.cursor = s.cursor;
      anim.state = s.state;
      beh.state = s.state;
      anim.fakeTalkUntil = s.fakeTalkUntil;
      beh.fakeTalkUntil = s.fakeTalkUntil;
      if (s.hop) {
        anim.bounce();
        beh.trigger('hop');
      }
      Math.random = oldRand;
      anim.tick(now);
      Math.random = realRandom;
      const p = drive2d(beh.tick(now, toCss(NECK.x, NECK.y * 0.6)), H);
      for (const k of ['breath', 'blink', 'mouth', 'headAngle', 'headX', 'headY', 'bounce']) {
        assert.ok(Math.abs(p[k] - fake.params[k]) < 1e-9, `tick ${i}: ${k} ${p[k]} ≠ ${fake.params[k]}`);
      }
    }
  } finally {
    Math.random = realRandom;
  }
});

test('setEmotion: sube en 250 ms, se mantiene 4 s y baja en 800 ms', () => {
  const b = new Behaviour({ now: 0 });
  b.setEmotion('happy', 1000);
  const at = (ms) => b.tick(ms, null).emotion;
  assert.ok(Math.abs(at(1125).weight - 0.5) <= 0.05);
  assert.equal(at(1125).name, 'happy');
  assert.equal(at(3000).weight, 1);
  assert.ok(Math.abs(at(1000 + 4250 + 400).weight - 0.5) <= 0.05);
  const end = at(6100);
  assert.equal(end.weight, 0);
  assert.equal(end.name, 'neutral');
});

test("setEmotion('neutral') lleva el peso a 0 en 800 ms", () => {
  const b = new Behaviour({ now: 0 });
  b.setEmotion('sad', 0);
  assert.equal(b.tick(1000, null).emotion.weight, 1);
  b.setEmotion('neutral', 1000);
  assert.ok(Math.abs(b.tick(1400, null).emotion.weight - 0.5) <= 0.05);
  assert.equal(b.tick(1800, null).emotion.weight, 0);
});

test("trigger('greet') aparece una sola vez en events", () => {
  const b = new Behaviour({ now: 0 });
  b.trigger('greet');
  assert.deepEqual(b.tick(16, null).events, ['greet']);
  assert.deepEqual(b.tick(33, null).events, []);
  assert.ok(b.tick(50, null).hop > 0);
});

test('talking: con boca abierta o con charla simulada', () => {
  const b = new Behaviour({ now: 0 });
  assert.equal(b.tick(10, null).talking, false);
  b.fakeTalkUntil = 5000;
  assert.equal(b.tick(20, null).talking, true);
});
