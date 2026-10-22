// Carga movimientos importados y los convierte en Motion para el modelo VRM actual:
//  - .vrma (VRM Animation): cargador oficial de @pixiv/three-vrm-animation.
//  - .fbx de Mixamo: se reorienta cada hueso al esqueleto normalizado del VRM (método del ejemplo
//    oficial de three-vrm, licencia MIT).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { VRMAnimationLoaderPlugin, VRMLookAtQuaternionProxy, createVRMAnimationClip } from '@pixiv/three-vrm-animation';
import { motionFromClip } from './motion.js';
import { MIXAMO_VRM_RIG_MAP, mixamoBoneMap, mixamoKey } from './mixamo-map.js';

export class MotionLoadError extends Error {
  constructor(code, message = code) {
    super(message);
    this.code = code;
  }
}

async function loadVrma(url, vrm) {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
  const gltf = await loader.loadAsync(url);
  const anim = gltf.userData.vrmAnimations?.[0];
  if (!anim) throw new MotionLoadError('notVrma');
  // La mirada animada necesita este proxy en la escena; si no está, three-vrm lo crea y avisa.
  if (vrm.lookAt && !vrm.scene.children.some((c) => c instanceof VRMLookAtQuaternionProxy)) {
    const proxy = new VRMLookAtQuaternionProxy(vrm.lookAt);
    proxy.name = 'VRMLookAtQuaternionProxy';
    vrm.scene.add(proxy);
  }
  return { clip: createVRMAnimationClip(anim, vrm), missingBones: [] };
}

async function loadMixamo(url, vrm) {
  const asset = await new FBXLoader().loadAsync(url);
  const names = [];
  asset.traverse((o) => names.push(o.name));
  const { recognized, missing } = mixamoBoneMap(names);
  if (!recognized) throw new MotionLoadError('notMixamo');
  const clip = THREE.AnimationClip.findByName(asset.animations, 'mixamo.com') || asset.animations[0];
  if (!clip) throw new MotionLoadError('notMixamo');
  const byKey = new Map(names.map((n) => [mixamoKey(n), n]));
  const restInv = new THREE.Quaternion();
  const parentRest = new THREE.Quaternion();
  const q = new THREE.Quaternion();
  const hipsNode = asset.getObjectByName(byKey.get('mixamorigHips'));
  const scale = (vrm.humanoid.normalizedRestPose.hips?.position?.[1] || 1) / (hipsNode?.position.y || 1);
  const vrm0 = vrm.meta?.metaVersion === '0';
  const tracks = [];
  for (const track of clip.tracks) {
    const [rigName, prop] = track.name.split('.');
    const bone = MIXAMO_VRM_RIG_MAP[mixamoKey(rigName)];
    const nodeName = bone && vrm.humanoid.getNormalizedBoneNode(bone)?.name;
    const rigNode = asset.getObjectByName(rigName);
    if (!nodeName || !rigNode) continue;
    rigNode.getWorldQuaternion(restInv).invert();
    rigNode.parent.getWorldQuaternion(parentRest);
    if (track instanceof THREE.QuaternionKeyframeTrack) {
      const values = track.values.slice();
      for (let i = 0; i < values.length; i += 4) {
        q.fromArray(values, i).premultiply(parentRest).multiply(restInv);
        q.toArray(values, i);
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(`${nodeName}.${prop}`, track.times, values.map((v, i) => (vrm0 && i % 2 === 0 ? -v : v))));
    } else if (track instanceof THREE.VectorKeyframeTrack && bone === 'hips') {
      const values = track.values.map((v, i) => (vrm0 && i % 3 !== 1 ? -v : v) * scale);
      tracks.push(new THREE.VectorKeyframeTrack(`${nodeName}.${prop}`, track.times, values));
    }
  }
  return { clip: new THREE.AnimationClip('mixamo', clip.duration, tracks), missingBones: missing };
}

// -> { motion, duration, missingBones }. Lanza MotionLoadError('notVrma' | 'notMixamo') o el error del cargador.
export async function loadMotionFile(url, format, vrm, name = '') {
  const { clip, missingBones } = format === 'fbx' ? await loadMixamo(url, vrm) : await loadVrma(url, vrm);
  const motion = motionFromClip(clip, vrm, name);
  return { motion, duration: clip.duration, missingBones };
}
