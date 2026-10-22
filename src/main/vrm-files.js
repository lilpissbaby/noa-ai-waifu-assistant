// Comprobación de archivos VRM sin cargarlos en three.js: lee la cabecera GLB y el chunk JSON para
// saber si es un VRM (0.x o 1.0) con esqueleto humanoide y qué licencia declara su autor.
import fs from 'node:fs';

export const MAX_VRM_BYTES = 150 * 1024 * 1024;
const GLTF = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;

function readAt(fd, pos, len) {
  const buf = Buffer.alloc(len);
  const n = fs.readSync(fd, buf, 0, len, pos);
  return n === len ? buf : null;
}

// La miniatura (índice de imagen) y la textura de VRM 0.x no son datos de licencia.
function meta1(m = {}) {
  const { name, authors, version, ...license } = m;
  delete license.thumbnailImage;
  return { title: name || '', authors: Array.isArray(authors) ? authors : [], version: version || '', license };
}

function meta0(m = {}) {
  const { title, author, version, ...license } = m;
  delete license.texture;
  return { title: title || '', authors: author ? [author] : [], version: version || '', license };
}

// -> { ok: true, version: '0'|'1', meta } | { ok: false, reason: 'tooBig'|'notGlb'|'notVrm'|'truncated' }
export function validateVrmFile(file) {
  let fd;
  try {
    const size = fs.statSync(file).size;
    if (size > MAX_VRM_BYTES) return { ok: false, reason: 'tooBig' };
    fd = fs.openSync(file, 'r');
    const head = readAt(fd, 0, 20);
    if (!head || head.readUInt32LE(0) !== GLTF) return { ok: false, reason: 'notGlb' };
    if (head.readUInt32LE(8) > size) return { ok: false, reason: 'truncated' };
    const jsonLen = head.readUInt32LE(12);
    if (head.readUInt32LE(16) !== JSON_CHUNK) return { ok: false, reason: 'notGlb' };
    if (20 + jsonLen > size) return { ok: false, reason: 'truncated' };
    const raw = readAt(fd, 20, jsonLen);
    let json;
    try {
      json = JSON.parse(raw.toString('utf8'));
    } catch {
      return { ok: false, reason: 'notGlb' };
    }
    const ext = json.extensions || {};
    if (ext.VRMC_vrm?.humanoid) return { ok: true, version: '1', meta: meta1(ext.VRMC_vrm.meta) };
    if (ext.VRM?.humanoid) return { ok: true, version: '0', meta: meta0(ext.VRM.meta) };
    return { ok: false, reason: 'notVrm' };
  } catch {
    return { ok: false, reason: 'notGlb' };
  } finally {
    if (fd != null) fs.closeSync(fd);
  }
}
