// Descarga de los modelos de la galería desde su origen. Un VRM es un archivo; un modelo Live2D
// es su .model3.json más los archivos que nombra (moc3, texturas, física, movimientos, caras,
// sonidos), que se bajan uno a uno a una carpeta temporal y se importan como una carpeta.
import { net } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { userDir } from './config.js';
import { stageLive2d } from './live2d.js';
import { downloadVrm } from './skins.js';
import { galleryItem } from '../shared/gallery.js';

const MAX_BYTES = 300 * 1024 * 1024;
const MAX_FILES = 2000;

// Rutas relativas que nombra un .model3.json (sin duplicados).
export function model3Files(json) {
  const r = json?.FileReferences || {};
  const out = [r.Moc, ...(r.Textures || []), r.Physics, r.Pose, r.DisplayInfo, r.UserData];
  for (const group of Object.values(r.Motions || {})) for (const m of group || []) out.push(m?.File, m?.Sound);
  for (const e of r.Expressions || []) out.push(e?.File);
  return [...new Set(out.filter((x) => typeof x === 'string' && x.trim()))];
}

export function safeRel(rel) {
  const parts = String(rel).replaceAll('\\', '/').split('/');
  if (!rel || rel.startsWith('/') || /^[a-z]:/i.test(rel) || parts.some((p) => p === '..' || p === '')) throw new Error(`Unsafe path in model: ${rel}`);
  return parts;
}

async function fetchBuffer(url, fetchImpl) {
  const res = await fetchImpl(url, { headers: { 'user-agent': 'Mozilla/5.0 WaifuDesk' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url.split('/').pop()}`);
  return Buffer.from(await res.arrayBuffer());
}

// Baja el modelo a userData/tmp/gallery/<id>/ y lo prepara como cualquier importación de carpeta.
export async function downloadLive2d(modelUrl, { onProgress = () => {}, fetchImpl = net.fetch } = {}) {
  const dir = path.join(userDir(), 'tmp', 'gallery', crypto.randomBytes(6).toString('hex'));
  try {
    const main = await fetchBuffer(modelUrl, fetchImpl);
    const json = JSON.parse(main.toString('utf8'));
    const files = model3Files(json);
    if (!files.length || files.length > MAX_FILES) throw new Error('Not a Live2D model3.json.');
    const name = decodeURIComponent(modelUrl.split('/').pop());
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), main);
    let total = main.length;
    let done = 0;
    // De cuatro en cuatro, para no abrir cientos de conexiones.
    const queue = [...files];
    const worker = async () => {
      for (let rel = queue.shift(); rel; rel = queue.shift()) {
        const parts = safeRel(rel);
        const url = new URL(parts.map(encodeURIComponent).join('/'), modelUrl).href;
        const buf = await fetchBuffer(url, fetchImpl);
        total += buf.length;
        if (total > MAX_BYTES) throw new Error('Model too large.');
        const to = path.join(dir, ...parts);
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.writeFileSync(to, buf);
        onProgress(++done / files.length);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    return stageLive2d(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Respuesta igual que skin:fetch-vrm o live2d:stage, más { item }.
export async function downloadGalleryItem(id, { onProgress, fetchImpl } = {}) {
  const item = galleryItem(id);
  if (!item) throw new Error(`Unknown gallery model: ${id}`);
  if (item.kind === 'live2d') return { ...(await downloadLive2d(item.model, { onProgress, ...(fetchImpl ? { fetchImpl } : {}) })), item };
  const r = await downloadVrm(item.url);
  return { ...r, ...(r && !r.error ? { name: item.name } : {}), item };
}
