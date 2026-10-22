import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { AnimationClip, QuaternionKeyframeTrack, VectorKeyframeTrack, Quaternion } from 'three';
import { __test } from 'electron';
import { listMotions, importMotion, updateMotion, deleteMotion, MAX_MOTION_BYTES } from '../src/main/motions.js';
import { loadConfig, patchConfig } from '../src/main/config.js';
import { motionFromClip } from '../src/renderer/shared/vrm/motion.js';

const src = (name, bytes = 64) => {
  const p = path.join(__test.userData, name);
  fs.writeFileSync(p, Buffer.alloc(bytes, 1));
  return p;
};

test('importMotion copia el archivo y lo añade a la biblioteca', () => {
  const e = importMotion(src('Saludo feliz.vrma'));
  assert.equal(e.format, 'vrma');
  assert.equal(e.name, 'Saludo feliz');
  assert.ok(e.url.startsWith('app://local/user/motions/'));
  assert.ok(fs.existsSync(path.join(__test.userData, 'motions', e.file)));
  assert.ok(listMotions().some((m) => m.id === e.id));
  const f = importMotion(src('Bailar.FBX'));
  assert.equal(f.format, 'fbx');
});

test('importMotion rechaza formatos raros y archivos grandes', () => {
  assert.equal(MAX_MOTION_BYTES, 30 * 1024 * 1024);
  assert.deepEqual(importMotion(src('x.bvh')), { error: 'badFormat' });
  const big = src('grande.fbx');
  fs.truncateSync(big, MAX_MOTION_BYTES + 1);
  assert.deepEqual(importMotion(big), { error: 'tooBig' });
});

test('updateMotion guarda duración y huesos que faltan', () => {
  const e = importMotion(src('idle.fbx'));
  updateMotion(e.id, { duration: 3.25, missingBones: ['leftToes'] });
  const m = listMotions().find((x) => x.id === e.id);
  assert.equal(m.duration, 3.25);
  assert.deepEqual(m.missingBones, ['leftToes']);
});

test('deleteMotion borra el archivo, la entrada y sus asignaciones', () => {
  const e = importMotion(src('borrar.vrma'));
  const keep = importMotion(src('otro.vrma'));
  patchConfig({ motions: { assign: { idle: e.id, talkGesture: [e.id, keep.id] } } });
  deleteMotion(e.id);
  assert.equal(fs.existsSync(path.join(__test.userData, 'motions', e.file)), false);
  assert.equal(listMotions().some((m) => m.id === e.id), false);
  const a = loadConfig().motions.assign;
  assert.equal(a.idle, null);
  assert.deepEqual(a.talkGesture, [keep.id]);
});

test('config: asignaciones vacías por defecto', () => {
  const a = loadConfig().motions.assign;
  for (const k of ['thinking', 'listening', 'working', 'talking', 'greet', 'happy']) assert.equal(a[k], null);
});

test('motionFromClip: pistas de huesos normalizados -> Motion (cadera solo en vertical y relativa)', () => {
  const vrm = { humanoid: { normalizedHumanBones: { hips: { node: { name: 'N_hips' } }, spine: { node: { name: 'N_spine' } } } } };
  const q0 = new Quaternion();
  const q1 = new Quaternion().setFromAxisAngle({ x: 0, y: 0, z: 1 }, Math.PI / 2);
  const clip = new AnimationClip('c', 2, [
    new QuaternionKeyframeTrack('N_spine.quaternion', [0, 2], [...q0.toArray(), ...q1.toArray()]),
    new VectorKeyframeTrack('N_hips.position', [0, 2], [0.3, 1.0, 0.2, 0.9, 1.2, -0.5]),
    new QuaternionKeyframeTrack('Otro.quaternion', [0, 2], [...q0.toArray(), ...q1.toArray()]),
  ]);
  const m = motionFromClip(clip, vrm, 'importado');
  assert.equal(m.duration, 2);
  assert.equal(m.name, 'importado');
  const pose = m.sample(1);
  assert.deepEqual([...pose.keys()], ['spine']);
  assert.ok(Math.abs(pose.get('spine').angleTo(q0) - Math.PI / 4) < 1e-6);
  assert.ok(Math.abs(m.hipsY(1) - 0.1) < 1e-6, 'a mitad: 1,1 - 1,0 (pistas en float32)');
});
