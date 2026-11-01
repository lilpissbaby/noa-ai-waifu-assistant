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

// requestAnimationFrame falso: se ejecuta a mano con flush().
function fakeRaf() {
  let queue = [];
  globalThis.requestAnimationFrame = (cb) => queue.push(cb);
  return (now) => {
    const q = queue;
    queue = [];
    q.forEach((cb) => cb(now));
  };
}
function fakeRenderer(interval = 0) {
  return { renders: 0, applied: 0, headAnchorCss: () => [0, 0], frameInterval: () => interval, apply() { this.applied++; }, render() { this.renders++; } };
}

test('Stage: un solo bucle aunque se llame start() dos veces', async () => {
  const { Stage } = await import('../src/renderer/shared/stage.js');
  const flush = fakeRaf();
  const r = fakeRenderer();
  const stage = new Stage(r, new Behaviour({ now: 0 }));
  stage.start();
  stage.start();
  flush(16);
  flush(33);
  assert.equal(r.renders, 2);
  stage.stop();
  stage.start();
  flush(50);
  flush(66);
  assert.equal(r.renders, 4, 'stop()+start() no debe dejar dos bucles');
  stage.stop();
  flush(83);
  assert.equal(r.renders, 4);
});

test('Stage: respeta frameInterval del renderizador', async () => {
  const { Stage } = await import('../src/renderer/shared/stage.js');
  const flush = fakeRaf();
  const r = fakeRenderer(1000 / 30);
  const stage = new Stage(r, new Behaviour({ now: 0 }));
  stage.start();
  for (let i = 1; i <= 60; i++) flush(i * (1000 / 60));
  stage.stop();
  assert.ok(r.renders >= 29 && r.renders <= 31, `renders=${r.renders}`);
});

test('setEmotion: un fotograma con marca de tiempo anterior no la cancela', () => {
  // requestAnimationFrame da la hora de inicio del fotograma, que puede ser anterior a performance.now().
  const b = new Behaviour({ now: 0 });
  b.setEmotion('happy', 1000);
  assert.equal(b.tick(990, null).emotion.weight, 0);
  assert.ok(Math.abs(b.tick(1125, null).emotion.weight - 0.5) <= 0.05);
});

test('gesture(): mueve la cabeza, guiña, lleva sus efectos y termina', () => {
  const b = new Behaviour({ now: 0 });
  assert.equal(b.gesture('inventado', 0), false);
  assert.equal(b.gesture('nod', 0), true);
  const mid = b.tick(250, null);
  assert.equal(mid.gesture.name, 'nod');
  assert.equal(mid.gesture.started, true);
  assert.ok(mid.head.pitch > 0.05, `pitch ${mid.head.pitch}`);
  assert.equal(b.tick(260, null).gesture.started, false);
  assert.equal(b.tick(1200, null).gesture, null);
  b.gesture('blowkiss', 2000);
  const k = b.tick(2800, null);
  assert.ok(k.blinkL > 0.9 && k.blinkR < 0.5, 'guiño solo en un ojo');
  assert.deepEqual(k.fx.map((e) => e.id), ['hearts']);
  b.gesture('Hello', 5000);
  assert.equal(b.tick(5100, null).gesture.name, 'wave', 'sinónimos');
});

test('setEmotion: emociones nuevas, sinónimos, fundido con la anterior y gesto con pausa', () => {
  const b = new Behaviour({ now: 0 });
  b.setEmotion('enamorada', 0);
  let s = b.tick(1000, null);
  assert.equal(s.emotion.name, 'love');
  assert.deepEqual(s.fx.map((e) => e.id).sort(), ['blush', 'hearts', 'hearts'].sort());
  assert.equal(s.gesture?.name, 'heart', 'la emoción lanza su gesto');
  b.setEmotion('crying', 1100);
  s = b.tick(1200, null);
  assert.equal(s.emotion.name, 'crying');
  assert.equal(s.emotionPrev.name, 'love');
  assert.ok(s.emotionPrev.weight > 0 && s.emotionPrev.weight < 1);
  assert.equal(b.tick(1500, null).emotionPrev.weight, 0);
  assert.equal(b.tick(1600, null).closed, 1, 'llorando con los ojos cerrados');
  b.gest = null;
  b.setEmotion('love', 3000);
  assert.equal(b.tick(3100, null).gesture, null, 'no repite gesto antes de 6 s');
});

test('idleGestures: en reposo hace algún gesto suelto (y no si está desactivado)', () => {
  const b = new Behaviour({ now: 0, random: () => 0 });
  for (let t = 0; t < 200000; t += 1000) assert.equal(b.tick(t, null).gesture, null);
  b.idleGestures = true;
  let seen = null;
  for (let t = 200000; t < 400000 && !seen; t += 500) seen = b.tick(t, null).gesture?.name || null;
  assert.ok(seen, 'ningún gesto en 200 s');
});
