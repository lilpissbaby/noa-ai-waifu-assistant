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
import { fetchLive2dModel, safeRel } from '../shared/live2d-files.js';

export { model3Files, safeRel } from '../shared/live2d-files.js';

// Baja el modelo a userData/tmp/gallery/<id>/ y lo prepara como cualquier importación de carpeta.
export async function downloadLive2d(modelUrl, { onProgress = () => {}, fetchImpl = net.fetch } = {}) {
  const get = async (url) => {
    const res = await fetchImpl(url, { headers: { 'user-agent': 'Mozilla/5.0 WaifuDesk' } });
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} ${decodeURIComponent(url.split('/').pop())}`), { status: res.status });
    return Buffer.from(await res.arrayBuffer());
  };
  const model = await fetchLive2dModel(modelUrl, get, { onProgress });
  const dir = path.join(userDir(), 'tmp', 'gallery', crypto.randomBytes(6).toString('hex'));
  try {
    for (const [rel, buf] of [[model.name, model.main], ...model.files]) {
      const to = path.join(dir, ...safeRel(rel));
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.writeFileSync(to, buf);
    }
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
