import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Euler, Quaternion } from 'three';
import { motionFromDef, MotionPlayer } from '../src/renderer/shared/vrm/motion.js';
import { BASE_POSE, quatFromDeg } from '../src/renderer/shared/vrm/pose.js';
import { CLIPS } from '../src/renderer/shared/vrm/clips/index.js';

const DEG = 180 / Math.PI;
const zDeg = (q) => new Euler().setFromQuaternion(q).z * DEG;
const sig = (over = {}) => ({ state: 'idle', talking: false, events: [], emotion: { name: 'neutral', weight: 0 }, ...over });

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

const def = (name, bones, over = {}) => ({ name, duration: 2, loop: true, bones, ...over });

test('motionFromDef interpola: a mitad de 0° y 90° en Z da 45°', () => {
  const m = motionFromDef(def('x', { spine: [[0, 0, 0, 0], [2, 0, 0, 90]] }, { loop: false }));
  assert.ok(Math.abs(zDeg(m.sample(1).get('spine')) - 45) < 1e-6);
});

test('motionFromDef: las rotaciones van encima de la pose base', () => {
  const m = motionFromDef(def('x', { leftUpperArm: [[0, 0, 0, 0], [2, 0, 0, 0]] }));
  const q = m.sample(0.5).get('leftUpperArm');
  assert.ok(q.angleTo(quatFromDeg(BASE_POSE.leftUpperArm)) < 1e-6);
});

test('motionFromDef: en bucle, sample(duración + 0,1) = sample(0,1)', () => {
  const m = motionFromDef(def('x', { spine: [[0, 0, 0, 0], [1, 10, 20, 30], [2, 0, 0, 0]] }));
  assert.ok(m.sample(2.1).get('spine').angleTo(m.sample(0.1).get('spine')) < 1e-6);
});

const lib = () => ({
  idle: [motionFromDef(def('idle-a', { spine: [[0, 0, 0, 0], [2, 0, 0, 0]] })), motionFromDef(def('idle-b', { spine: [[0, 0, 0, 0], [2, 0, 0, 0]] }))],
  thinking: motionFromDef(def('thinking', { spine: [[0, 0, 0, 40], [2, 0, 0, 40]] })),
  greet: motionFromDef(def('greet', { rightUpperArm: [[0, 0, 0, -60], [2, 0, 0, -60]] }, { loop: false })),
  talkGesture: [motionFromDef(def('talk-1', { leftLowerArm: [[0, 0, -30, 0], [2, 0, -30, 0]] }, { loop: false }))],
});

test('MotionPlayer: de idle a thinking con un fundido de 0,4 s', () => {
  const p = new MotionPlayer({ random: seeded(1) });
  p.setLibrary(lib());
  for (let i = 0; i < 30; i++) p.update(1 / 60, sig());
  let out;
  for (let i = 0; i < 12; i++) out = p.update(1 / 60, sig({ state: 'thinking' }));
  assert.ok(Math.abs(zDeg(out.pose.get('spine')) - 20) < 2, `a 0,2 s: ${zDeg(out.pose.get('spine'))}`);
  assert.equal(out.busy, true);
  for (let i = 0; i < 20; i++) out = p.update(1 / 60, sig({ state: 'thinking' }));
  assert.ok(Math.abs(zDeg(out.pose.get('spine')) - 40) < 1e-6);
  assert.equal(out.busy, false);
});

test('MotionPlayer: el gesto «greet» solo toca sus huesos y deja de estar ocupado al acabar', () => {
  const p = new MotionPlayer({ random: seeded(2) });
  p.setLibrary(lib());
  p.update(1 / 60, sig());
  let out = p.update(1 / 60, sig({ events: ['greet'] }));
  for (let i = 0; i < 60; i++) out = p.update(1 / 60, sig());
  assert.equal(out.busy, true);
  const arm = new Euler().setFromQuaternion(out.pose.get('rightUpperArm')).z * DEG;
  const base = new Euler().setFromQuaternion(quatFromDeg(BASE_POSE.rightUpperArm)).z * DEG;
  assert.ok(Math.abs(arm - (base - 60)) < 1, `brazo ${arm}`);
  assert.ok(Math.abs(zDeg(out.pose.get('spine'))) < 1e-6, 'la columna sigue en idle');
  for (let i = 0; i < 60 * 1.5; i++) out = p.update(1 / 60, sig());
  assert.equal(out.busy, false);
});

test('MotionPlayer: hablando 20 s salen entre 2 y 5 gestos', () => {
  const p = new MotionPlayer({ random: seeded(3) });
  p.setLibrary(lib());
  let starts = 0;
  for (let i = 0; i < 20 * 60; i++) {
    const out = p.update(1 / 60, sig({ state: 'talking', talking: true }));
    if (out.started) starts++;
  }
  assert.ok(starts >= 2 && starts <= 5, `gestos: ${starts}`);
});

test('MotionPlayer: sin biblioteca devuelve una pose vacía', () => {
  const p = new MotionPlayer();
  const out = p.update(1 / 60, sig({ state: 'working' }));
  assert.equal(out.pose.size, 0);
  assert.equal(out.busy, false);
});

test('los clips propios existen y solo usan huesos humanoides', () => {
  const names = ['idle-a', 'idle-b', 'thinking', 'listening', 'working', 'talking', 'talk-1', 'talk-2', 'talk-3', 'greet', 'happy'];
  assert.deepEqual(Object.keys(CLIPS).sort(), [...names].sort());
  const HUMAN = /^(hips|spine|chest|upperChest|neck|head|(left|right)(Shoulder|UpperArm|LowerArm|Hand|UpperLeg|LowerLeg|Foot|Eye)|(left|right)(Thumb|Index|Middle|Ring|Little)(Metacarpal|Proximal|Intermediate|Distal))$/;
  for (const [name, d] of Object.entries(CLIPS)) {
    assert.ok(d.duration > 0, name);
    for (const [bone, keys] of Object.entries(d.bones)) {
      assert.match(bone, HUMAN, `${name}: ${bone}`);
      assert.equal(keys[0][0], 0, `${name}/${bone} debe empezar en t=0`);
      assert.ok(keys.at(-1)[0] <= d.duration + 1e-9, `${name}/${bone} se pasa de la duración`);
      if (d.loop) assert.deepEqual(keys.at(-1).slice(1), keys[0].slice(1), `${name}/${bone}: el bucle debe cerrar`);
    }
  }
});

test('Quaternion de three disponible en los tests', () => {
  assert.ok(new Quaternion().identity());
});
