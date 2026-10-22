// Los VRM 0.x miran a −Z en su espacio local (rotateVRM0 gira la escena 180°): toda rotación pensada para
// VRM 1.0 hay que pasarla a su espacio, igual que hace three-vrm-animation (x y z del cuaternión negados).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { baseQuat, toVrm0 } from '../src/renderer/shared/vrm/pose.js';
import { motionFromDef, MotionPlayer } from '../src/renderer/shared/vrm/motion.js';
import { applyToVrm } from '../src/renderer/shared/vrm/drive-vrm.js';

const Y180 = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI);
const mirrored = (q) => Y180.clone().multiply(q).multiply(Y180.clone().invert());
const same = (a, b) => assert.ok(a.angleTo(b) < 1e-6, `${a.toArray()} ≠ ${b.toArray()}`);

test('toVrm0 equivale a girar 180° alrededor de Y', () => {
  const q = new Quaternion(0.1, 0.2, 0.3, 0.9).normalize();
  same(toVrm0(q.clone()), mirrored(q));
});

test('la pose base de un VRM 0.x baja los brazos en su espacio', () => {
  same(baseQuat('leftUpperArm', true), mirrored(baseQuat('leftUpperArm')));
  assert.ok(baseQuat('leftUpperArm', true).angleTo(baseQuat('leftUpperArm')) > 1, 'no puede ser la misma rotación');
});

test('motionFromDef con vrm0 da las mismas poses en el espacio de VRM 0.x', () => {
  const def = { name: 'x', duration: 2, loop: true, bones: { leftUpperArm: [[0, 10, -20, 30], [2, 10, -20, 30]], head: [[0, -6, 3, 6], [2, -6, 3, 6]] } };
  const a = motionFromDef(def).sample(0.5);
  const b = motionFromDef(def, { vrm0: true }).sample(0.5);
  for (const bone of ['leftUpperArm', 'head']) same(b.get(bone), mirrored(a.get(bone)));
});

test('MotionPlayer con vrm0 rellena con la pose base de VRM 0.x', () => {
  const def = { name: 'g', duration: 2, loop: false, bones: { rightUpperArm: [[0, 0, 0, -60], [2, 0, 0, -60]] } };
  const run = (vrm0) => {
    const p = new MotionPlayer({ random: () => 0.5, vrm0 });
    p.setLibrary({ greet: [motionFromDef(def, { vrm0 })] });
    p.update(1 / 60, { state: 'idle', events: [] });
    return p.update(0.1, { state: 'idle', events: ['greet'] }).pose.get('rightUpperArm');
  };
  same(run(true), mirrored(run(false)));
});

test('applyToVrm con vrm0 gira cabeza y pecho en su espacio', () => {
  const make = () => {
    const nodes = {};
    for (const b of ['neck', 'head', 'chest', 'leftShoulder', 'rightShoulder']) nodes[b] = { quaternion: new Quaternion(), position: new Vector3() };
    return { humanoid: { getNormalizedBoneNode: (b) => nodes[b] || null }, nodes };
  };
  const s = { t: 1, state: 'thinking', breath: 0.7, blink: 0, mouth: 0, look: { x: 0.6, y: -0.4 }, sway: 0.01, tilt: 0.05, lift: 0.5, hop: 0, emotion: { name: 'neutral', weight: 0 }, talking: false, events: [] };
  const v1 = make();
  const v0 = make();
  applyToVrm(v1, s, {});
  applyToVrm(v0, s, { vrm0: true });
  for (const b of Object.keys(v1.nodes)) same(v0.nodes[b].quaternion, mirrored(v1.nodes[b].quaternion));
});
