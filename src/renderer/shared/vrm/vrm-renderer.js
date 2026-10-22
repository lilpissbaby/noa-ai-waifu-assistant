// Renderizador de skins VRM (three.js + @pixiv/three-vrm) con la misma interfaz que SkinRenderer:
// load, layout, apply, render, aspect, headAnchorCss, alphaAtCss, shapeRects, frameInterval, dispose.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { computeFraming, normalizeFraming } from './framing.js';
import { applyToVrm } from './drive-vrm.js';
import { HitMask } from './hit-mask.js';
import { BASE_POSE, baseQuat } from './pose.js';
import { MotionPlayer, motionFromDef } from './motion.js';
import { CLIPS, DEFAULT_ASSIGN } from './clips/index.js';

const DEG = Math.PI / 180;
const FOV = 20;
const STEP = 1 / 60;
const _v = new THREE.Vector3();

// Biblioteca de animaciones propias: { estado o gesto: Motion[] }.
export function defaultLibrary() {
  const motions = Object.fromEntries(Object.entries(CLIPS).map(([k, d]) => [k, motionFromDef(d)]));
  return Object.fromEntries(Object.entries(DEFAULT_ASSIGN).map(([k, names]) => [k, names.map((n) => motions[n])]));
}

export class VrmRenderer {
  constructor(canvas) {
    this.kind = 'vrm';
    this.canvas = canvas;
    this.gl = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true });
    this.gl.setClearColor(0x000000, 0);
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    const light = new THREE.DirectionalLight(0xffffff, Math.PI);
    light.position.set(1, 1.6, 2).normalize();
    this.scene.add(light);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 50);
    this.mask = new HitMask();
    this.box = { x: 0, y: 0, w: 1, h: 1 };
    this.framing = normalizeFraming();
    this.frame = null;
    this.vrm = null;
    this.skin = null;
    this.signals = null;
    this.busy = false;
    this.head = null;
    this.player = new MotionPlayer();
    this.player.setLibrary(defaultLibrary());
    this.renderMs = [];
  }

  get aspect() {
    return this.frame ? this.frame.aspect : 0.75;
  }

  async load(skin) {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    const gltf = await loader.loadAsync(skin.urls.model);
    const vrm = gltf.userData.vrm;
    if (!vrm || !vrm.humanoid) throw new Error('El archivo no es un VRM con esqueleto humanoide');
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);
    VRMUtils.rotateVRM0(vrm);
    vrm.scene.traverse((o) => (o.frustumCulled = false));
    if (this.vrm) {
      this.scene.remove(this.vrm.scene);
      VRMUtils.deepDispose(this.vrm.scene);
    }
    this.vrm = vrm;
    this.baseYaw = vrm.scene.rotation.y;
    this.scene.add(vrm.scene);
    this.dims = this.measure();
    this.hipsRestY = vrm.humanoid.getNormalizedBoneNode('hips')?.position.y ?? 0;
    this.skin = { ...skin, framing: normalizeFraming(skin.framing) };
    this.setFraming(this.skin.framing);
    return this.skin;
  }

  // Medidas en pose de reposo (metros): alto, pecho, cadera, suelo y ancho de hombros.
  measure() {
    const vrm = this.vrm;
    vrm.humanoid.resetNormalizedPose();
    vrm.update(0);
    vrm.scene.updateMatrixWorld(true);
    const y = (name) => {
      const n = vrm.humanoid.getNormalizedBoneNode(name);
      return n ? n.getWorldPosition(_v).y : null;
    };
    const x = (name) => {
      const n = vrm.humanoid.getNormalizedBoneNode(name);
      return n ? n.getWorldPosition(_v).x : null;
    };
    const box = new THREE.Box3().setFromObject(vrm.scene);
    const head = y('head');
    const hips = y('hips') ?? box.min.y + (box.max.y - box.min.y) * 0.5;
    const chest = y('upperChest') ?? y('chest') ?? y('spine') ?? (hips + head) / 2;
    const top = Math.max(box.max.y, (head ?? hips) + 0.15);
    const l = x('leftUpperArm');
    const r = x('rightUpperArm');
    const shoulderWidth = l != null && r != null ? Math.abs(l - r) : (box.max.x - box.min.x) * 0.25;
    return { top, chestY: chest, hipsY: hips, bottom: Math.max(box.min.y, 0), shoulderWidth };
  }

  setFraming(framing) {
    this.framing = normalizeFraming(framing);
    if (!this.vrm) return;
    this.frame = computeFraming(this.dims, this.framing, FOV);
    this.vrm.scene.rotation.y = this.baseYaw + this.framing.yaw * DEG;
    this.camera.position.set(...this.frame.position);
    this.camera.lookAt(...this.frame.target);
  }

  layout(box) {
    this.box = { ...box };
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.gl.setPixelRatio(dpr);
    this.gl.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false);
    this.camera.aspect = Math.max(0.1, box.w / box.h);
    this.camera.updateProjectionMatrix();
  }

  apply(signals) {
    this.signals = signals;
  }

  frameInterval(s) {
    return s && (s.talking || s.hop > 0.01 || this.busy) ? 0 : 1000 / 30;
  }

  render(dt = STEP) {
    const vrm = this.vrm;
    const t0 = performance.now();
    if (!vrm || !this.signals) {
      this.gl.clear();
      return;
    }
    vrm.humanoid.resetNormalizedPose();
    const out = this.player.update(dt, this.signals);
    for (const bone of Object.keys(BASE_POSE)) if (!out.pose.has(bone)) vrm.humanoid.getNormalizedBoneNode(bone)?.quaternion.copy(baseQuat(bone));
    for (const [bone, q] of out.pose) vrm.humanoid.getNormalizedBoneNode(bone)?.quaternion.copy(q);
    const hips = vrm.humanoid.getNormalizedBoneNode('hips');
    if (hips) hips.position.y += out.hipsY;
    this.busy = out.busy;
    applyToVrm(vrm, this.signals, { hipsRestY: this.hipsRestY });
    // Física de pelo y ropa a paso fijo (máx. 3 subpasos por fotograma).
    const steps = Math.max(1, Math.min(3, Math.round(dt / STEP)));
    for (let i = 0; i < steps; i++) vrm.update(STEP);
    const { x, y, w, h } = this.box;
    const cssH = this.canvas.clientHeight;
    this.gl.setViewport(x, cssH - y - h, w, h);
    this.gl.render(this.scene, this.camera);
    this.updateHead();
    this.mask.maybeCapture(this.canvas, t0);
    this.renderMs.push(performance.now() - t0);
    if (this.renderMs.length > 120) this.renderMs.shift();
  }

  updateHead() {
    const head = this.vrm.humanoid.getNormalizedBoneNode('head');
    if (!head) return;
    head.getWorldPosition(_v);
    _v.y += 0.06;
    _v.project(this.camera);
    const { x, y, w, h } = this.box;
    this.head = [x + ((_v.x + 1) / 2) * w, y + ((1 - _v.y) / 2) * h];
  }

  headAnchorCss() {
    return this.head;
  }

  alphaAtCss(x, y, radius = 1) {
    return this.mask.alphaAt(x, y, radius);
  }

  shapeRects(cell = 6, pad = 6) {
    return this.mask.rects(cell, pad);
  }

  // Imagen PNG (data URL) del recuadro del avatar, para miniaturas. Dibuja y copia en la misma tarea.
  snapshot(width = 200, height = 260) {
    if (!this.vrm) return null;
    if (!this.signals) this.signals = { t: 0, state: 'idle', breath: 0, blink: 0, mouth: 0, look: { x: 0, y: 0 }, sway: 0, tilt: 0, lift: 0, hop: 0, emotion: { name: 'neutral', weight: 0 }, talking: false, events: [] };
    this.render(0);
    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    const k = this.canvas.width / this.canvas.clientWidth;
    const { x, y, w, h } = this.box;
    const s = Math.min(width / w, height / h);
    out.getContext('2d').drawImage(this.canvas, x * k, y * k, w * k, h * k, (width - w * s) / 2, height - h * s, w * s, h * s);
    return out.toDataURL('image/png');
  }

  // Sustituye clips propios por movimientos importados según la asignación de la configuración.
  // assign = { idle: id|null, …, talkGesture: [id…] }; motions = lista de skin:motions-list.
  async setMotionAssign(assign = {}, motions = []) {
    const lib = defaultLibrary();
    if (this.vrm) {
      const { loadMotionFile } = await import('./import-clip.js');
      const byId = new Map(motions.map((m) => [m.id, m]));
      for (const [key, value] of Object.entries(assign)) {
        const ids = (Array.isArray(value) ? value : [value]).filter(Boolean);
        const loaded = [];
        for (const id of ids) {
          const m = byId.get(id);
          if (!m) {
            console.warn(`Movimiento asignado que ya no existe: ${id}`);
            continue;
          }
          try {
            loaded.push((await loadMotionFile(m.url, m.format, this.vrm, m.name)).motion);
          } catch (e) {
            console.warn(`No se pudo cargar el movimiento ${m.name}:`, e?.message || e);
          }
        }
        if (loaded.length) lib[key] = loaded;
      }
    }
    this.player.setLibrary(lib);
  }

  avgRenderMs() {
    const a = this.renderMs;
    return a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
  }

  dispose() {
    if (this.vrm) {
      this.scene.remove(this.vrm.scene);
      VRMUtils.deepDispose(this.vrm.scene);
      this.vrm = null;
    }
    this.gl.dispose();
    this.gl.forceContextLoss();
    this.skin = null;
  }
}
