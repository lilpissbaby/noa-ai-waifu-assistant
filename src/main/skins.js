// Gestión de skins: la de serie (dibujada en SVG) y las importadas por el usuario.
import { net } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { userDir, uid } from './config.js';
import { t, getLocale } from '../shared/i18n/index.js';
import { validateVrmFile, MAX_VRM_BYTES } from './vrm-files.js';
import { normalizeFraming } from '../renderer/shared/vrm/framing.js';

export const APP_ROOT = path.resolve(import.meta.dirname, '..', '..');
const BUILTIN_DIR = path.join(APP_ROOT, 'assets', 'skins');
const userSkinsDir = () => path.join(userDir(), 'skins');
export const modelsDir = () => path.join(userDir(), 'models');

export const SEGMENT_MODEL = {
  file: 'isnet-anime.onnx',
  // Modelo de segmentación de personajes anime (SkyTNT/anime-segmentation, Apache-2.0) empaquetado por rembg.
  url: 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-anime.onnx',
  size: 176069933,
};

const bundleUrl = (rel) => `app://local/bundle/${rel.split(path.sep).join('/')}`;
const userUrl = (rel) => `app://local/user/${rel.split(path.sep).join('/')}`;

function readManifest(dir, builtin) {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(dir, 'skin.json'), 'utf8'));
    const rel = path.relative(builtin ? APP_ROOT : userDir(), dir);
    const toUrl = (f) => (f ? (builtin ? bundleUrl : userUrl)(path.join(rel, f)) : null);
    const urls = {};
    for (const [k, f] of Object.entries(m.files || {})) urls[k] = toUrl(f);
    // `names` permite traducir el nombre de una skin: { "es": "…", "en": "…" }.
    const name = m.names?.[getLocale()] || m.name;
    const type = m.type === 'vrm' ? 'vrm' : '2d';
    return { ...m, type, name, id: m.id || path.basename(dir), builtin, urls, thumb: urls.thumb || urls.base };
  } catch {
    return null;
  }
}

export function listSkins() {
  const out = [];
  for (const [dir, builtin] of [
    [BUILTIN_DIR, true],
    [userSkinsDir(), false],
  ]) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      const m = readManifest(path.join(dir, name), builtin);
      if (m) out.push(m);
    }
  }
  return out.sort((a, b) => (a.builtin === b.builtin ? (b.created || 0) - (a.created || 0) : a.builtin ? -1 : 1));
}

export function getSkin(id) {
  const all = listSkins();
  return all.find((s) => s.id === id) || all.find((s) => s.id === 'default') || all[0];
}

const dataUrlToBuffer = (d) => Buffer.from(String(d).split(',')[1] || '', 'base64');

export function saveSkin({ id, name, width, height, rig, files }) {
  const skinId = id && !String(id).startsWith('default') ? id : `skin-${uid()}`;
  const dir = path.join(userSkinsDir(), skinId);
  fs.mkdirSync(dir, { recursive: true });
  const written = {};
  for (const [key, dataUrl] of Object.entries(files || {})) {
    if (!dataUrl) continue;
    const fname = `${key}.png`;
    fs.writeFileSync(path.join(dir, fname), dataUrlToBuffer(dataUrl));
    written[key] = fname;
  }
  let prev = {};
  try {
    prev = JSON.parse(fs.readFileSync(path.join(dir, 'skin.json'), 'utf8'));
  } catch {
    /* nueva */
  }
  const manifest = {
    id: skinId,
    name: name || prev.name || t('editor.defaultName'),
    width,
    height,
    rig,
    files: { ...(prev.files || {}), ...written },
    created: prev.created || Date.now(),
    updated: Date.now(),
  };
  fs.writeFileSync(path.join(dir, 'skin.json'), JSON.stringify(manifest, null, 2));
  return readManifest(dir, false);
}

// ------------------------------------------------------------------ skins VRM
const tmpDir = () => path.join(userDir(), 'tmp');

// Copia un .vrm válido a la carpeta temporal para la vista previa del editor.
export function stageVrm(srcPath, name) {
  const v = validateVrmFile(srcPath);
  if (!v.ok) return { error: v.reason };
  fs.mkdirSync(tmpDir(), { recursive: true });
  const tmpId = uid();
  fs.copyFileSync(srcPath, path.join(tmpDir(), `${tmpId}.vrm`));
  return { tmpId, url: userUrl(path.join('tmp', `${tmpId}.vrm`)), name: name || v.meta.title || path.basename(srcPath, path.extname(srcPath)), version: v.version, meta: v.meta };
}

// Descarga un .vrm de una URL (límite de tamaño) y lo deja como stageVrm.
export async function downloadVrm(url) {
  if (!/^https?:\/\//i.test(url)) throw new Error(t('errors.badUrl'));
  const res = await net.fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 WaifuDesk' } });
  if (!res.ok) throw new Error(t('errors.download', { status: res.status }));
  if (Number(res.headers.get('content-length')) > MAX_VRM_BYTES) return { error: 'tooBig' };
  fs.mkdirSync(tmpDir(), { recursive: true });
  const part = path.join(tmpDir(), `${uid()}.part`);
  const out = fs.createWriteStream(part);
  let size = 0;
  try {
    const reader = res.body.getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_VRM_BYTES) {
        await reader.cancel();
        return { error: 'tooBig' };
      }
      if (!out.write(value)) await new Promise((r) => out.once('drain', r));
    }
  } finally {
    await new Promise((r) => out.end(r));
  }
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || '').replace(/\.\w+$/, '');
    return stageVrm(part, name);
  } finally {
    fs.rmSync(part, { force: true });
  }
}

export function clearVrmTmp() {
  fs.rmSync(tmpDir(), { recursive: true, force: true });
  fs.mkdirSync(tmpDir(), { recursive: true });
}

// Guarda una skin VRM: nueva desde un temporal (tmpId), copia de otra (copyFrom, p. ej. una de
// serie) o cambios de nombre/encuadre de una propia (id).
export function saveVrmSkin({ id, tmpId, copyFrom, name, framing, thumb }) {
  const existing = id ? listSkins().find((s) => s.id === id) : null;
  const reuse = existing && !existing.builtin && !copyFrom;
  const skinId = reuse ? id : `vrm-${uid()}`;
  const dir = path.join(userSkinsDir(), skinId);
  fs.mkdirSync(dir, { recursive: true });
  const model = path.join(dir, 'model.vrm');
  if (tmpId) {
    const src = path.join(tmpDir(), `${path.basename(String(tmpId))}.vrm`);
    fs.copyFileSync(src, model);
    fs.rmSync(src, { force: true });
  } else if (copyFrom) {
    const from = listSkins().find((s) => s.id === copyFrom);
    const fromDir = path.join(from.builtin ? BUILTIN_DIR : userSkinsDir(), from.id);
    fs.copyFileSync(path.join(fromDir, from.files.model), model);
    if (!thumb && from.files.thumb) fs.copyFileSync(path.join(fromDir, from.files.thumb), path.join(dir, 'thumb.png'));
  }
  if (!fs.existsSync(model)) throw new Error('No hay modelo VRM para guardar');
  if (thumb) fs.writeFileSync(path.join(dir, 'thumb.png'), dataUrlToBuffer(thumb));
  const v = validateVrmFile(model);
  let prev = {};
  try {
    prev = JSON.parse(fs.readFileSync(path.join(dir, 'skin.json'), 'utf8'));
  } catch {
    /* nueva */
  }
  const manifest = {
    id: skinId,
    type: 'vrm',
    name: name || prev.name || t('vrmEditor.defaultName'),
    files: { model: 'model.vrm', ...(fs.existsSync(path.join(dir, 'thumb.png')) ? { thumb: 'thumb.png' } : {}) },
    framing: normalizeFraming(framing || prev.framing),
    meta: v.ok ? { ...v.meta, version: v.version } : prev.meta || null,
    created: prev.created || Date.now(),
    updated: Date.now(),
  };
  fs.writeFileSync(path.join(dir, 'skin.json'), JSON.stringify(manifest, null, 2));
  return readManifest(dir, false);
}

export function deleteSkin(id) {
  const dir = path.join(userSkinsDir(), id);
  if (!dir.startsWith(userSkinsDir()) || !fs.existsSync(dir)) return false;
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

// Descarga una imagen de internet (URL pegada por el usuario) y la devuelve como data URL.
export async function fetchImage(url) {
  if (!/^https?:\/\//i.test(url)) throw new Error(t('errors.badUrl'));
  const res = await net.fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 WaifuDesk' } });
  if (!res.ok) throw new Error(t('errors.imageDownload', { status: res.status }));
  const type = res.headers.get('content-type') || 'image/png';
  if (!type.startsWith('image/')) throw new Error(t('errors.notImage', { type }));
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 25 * 1024 * 1024) throw new Error(t('errors.imageTooBig', { mb: 25 }));
  return `data:${type};base64,${buf.toString('base64')}`;
}

export function segmentModelStatus() {
  const p = path.join(modelsDir(), SEGMENT_MODEL.file);
  const ok = fs.existsSync(p) && fs.statSync(p).size > 1e8;
  return { ready: ok, url: ok ? userUrl(path.join('models', SEGMENT_MODEL.file)) : null, sizeMB: Math.round(SEGMENT_MODEL.size / 1e6) };
}

let downloading = null;
export function downloadSegmentModel(onProgress) {
  if (downloading) return downloading;
  downloading = (async () => {
    fs.mkdirSync(modelsDir(), { recursive: true });
    const final = path.join(modelsDir(), SEGMENT_MODEL.file);
    const tmp = `${final}.part`;
    const res = await net.fetch(SEGMENT_MODEL.url);
    if (!res.ok) throw new Error(t('errors.download', { status: res.status }));
    const total = Number(res.headers.get('content-length')) || SEGMENT_MODEL.size;
    const out = fs.createWriteStream(tmp);
    let done = 0;
    let lastTick = 0;
    const reader = res.body.getReader();
    for (;;) {
      const { value, done: end } = await reader.read();
      if (end) break;
      done += value.length;
      if (!out.write(value)) await new Promise((r) => out.once('drain', r));
      const now = Date.now();
      if (now - lastTick > 250) {
        lastTick = now;
        onProgress?.(done / total);
      }
    }
    await new Promise((r, j) => out.end((e) => (e ? j(e) : r())));
    fs.renameSync(tmp, final);
    onProgress?.(1);
    return segmentModelStatus();
  })().finally(() => {
    downloading = null;
  });
  return downloading;
}
