import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MIXAMO_VRM_RIG_MAP, mixamoBoneMap, mixamoKey } from '../src/renderer/shared/vrm/mixamo-map.js';

const ALL = Object.keys(MIXAMO_VRM_RIG_MAP);

test('mixamoKey normaliza los prefijos de Mixamo', () => {
  assert.equal(mixamoKey('mixamorig:Hips'), 'mixamorigHips');
  assert.equal(mixamoKey('mixamorig1:LeftArm'), 'mixamorigLeftArm');
  assert.equal(mixamoKey('mixamorigSpine'), 'mixamorigSpine');
  assert.equal(mixamoKey('Armature'), 'Armature');
});

test('esqueleto completo de Mixamo', () => {
  const r = mixamoBoneMap(ALL.map((n) => n.replace('mixamorig', 'mixamorig:')));
  assert.equal(r.recognized, true);
  assert.deepEqual(r.missing, []);
  assert.equal(r.map.get('mixamorig:Hips'), 'hips');
});

test('sin cadera no es un esqueleto de Mixamo', () => {
  assert.equal(mixamoBoneMap(ALL.filter((n) => n !== 'mixamorigHips')).recognized, false);
  assert.equal(mixamoBoneMap(['Armature', 'Bone', 'Bone.001']).recognized, false);
});

test('lista los huesos que faltan (nombres VRM)', () => {
  const r = mixamoBoneMap(ALL.filter((n) => !/LeftHandThumb[123]$/.test(n)));
  assert.equal(r.recognized, true);
  assert.deepEqual(r.missing.sort(), ['leftThumbDistal', 'leftThumbMetacarpal', 'leftThumbProximal']);
});
