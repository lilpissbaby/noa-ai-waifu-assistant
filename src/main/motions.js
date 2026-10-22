// Biblioteca de movimientos importados (.vrma o .fbx de Mixamo) para las skins 3D. Los archivos se
// copian a userData/motions/ y la lista vive en motions.json; a qué estado o gesto se asigna cada uno
// se guarda en la configuración (motions.assign).
import fs from 'node:fs';
import path from 'node:path';
import { userDir, uid, loadConfig, patchConfig } from './config.js';

export const MAX_MOTION_BYTES = 30 * 1024 * 1024;
const FORMATS = { '.vrma': 'vrma', '.fbx': 'fbx' };

const dir = () => path.join(userDir(), 'motions');
const indexFile = () => path.join(dir(), 'motions.json');
const urlOf = (file) => `app://local/user/motions/${encodeURIComponent(file)}`;

function readIndex() {
  try {
    const list = JSON.parse(fs.readFileSync(indexFile(), 'utf8'));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
function writeIndex(list) {
  fs.mkdirSync(dir(), { recursive: true });
  fs.writeFileSync(indexFile(), JSON.stringify(list, null, 2));
}

export const listMotions = () => readIndex().map((m) => ({ ...m, url: urlOf(m.file) }));

// -> entrada nueva | { error: 'badFormat' | 'tooBig' }
export function importMotion(srcPath) {
  const ext = path.extname(srcPath).toLowerCase();
  const format = FORMATS[ext];
  if (!format) return { error: 'badFormat' };
  if (fs.statSync(srcPath).size > MAX_MOTION_BYTES) return { error: 'tooBig' };
  const id = `mot-${uid()}`;
  const file = `${id}${ext}`;
  fs.mkdirSync(dir(), { recursive: true });
  fs.copyFileSync(srcPath, path.join(dir(), file));
  const entry = { id, name: path.basename(srcPath, path.extname(srcPath)).slice(0, 60), file, format, duration: null, missingBones: [] };
  writeIndex([...readIndex(), entry]);
  return { ...entry, url: urlOf(file) };
}

export function updateMotion(id, { duration, missingBones } = {}) {
  const list = readIndex().map((m) => (m.id === id ? { ...m, ...(duration != null ? { duration } : {}), ...(missingBones ? { missingBones } : {}) } : m));
  writeIndex(list);
  return list.find((m) => m.id === id) || null;
}

export function deleteMotion(id) {
  const list = readIndex();
  const m = list.find((x) => x.id === id);
  if (!m) return false;
  fs.rmSync(path.join(dir(), m.file), { force: true });
  writeIndex(list.filter((x) => x.id !== id));
  const assign = { ...loadConfig().motions.assign };
  for (const [k, v] of Object.entries(assign)) assign[k] = Array.isArray(v) ? v.filter((x) => x !== id) : v === id ? null : v;
  patchConfig({ motions: { assign } });
  return true;
}
