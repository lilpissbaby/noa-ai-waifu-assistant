// Lectura de .tgz (tarballs de npm) y comprobación de su integridad, sin dependencias.
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const str = (buf, start, len) => {
  const end = buf.indexOf(0, start);
  return buf.toString('utf8', start, end >= 0 && end < start + len ? end : start + len);
};
const unsafe = (name) => !name || name.startsWith('/') || /^[A-Za-z]:/.test(name) || name.split(/[\\/]/).includes('..');

// want(nombre) -> si se quiere esa entrada. Solo archivos normales; rutas absolutas o con «..» se ignoran.
export function extractTarGz(buffer, { want = () => true, maxBytes = 200 * 1024 * 1024 } = {}) {
  const tar = zlib.gunzipSync(buffer, { maxOutputLength: maxBytes + 1024 * 1024 });
  if (tar.length > maxBytes + 1024 * 1024) throw new Error('tooBig');
  const out = new Map();
  let pos = 0;
  let total = 0;
  while (pos + 512 <= tar.length) {
    const h = tar.subarray(pos, pos + 512);
    if (h.every((b) => b === 0)) break;
    const prefix = str(h, 345, 155);
    const name = (prefix ? `${prefix}/` : '') + str(h, 0, 100);
    const size = parseInt(str(h, 124, 12).trim() || '0', 8);
    const type = String.fromCharCode(h[156] || 48);
    const start = pos + 512;
    if ((type === '0' || type === '\0') && !unsafe(name) && want(name)) {
      total += size;
      if (total > maxBytes) throw new Error('tooBig');
      out.set(name, Buffer.from(tar.subarray(start, start + size)));
    }
    pos = start + Math.ceil(size / 512) * 512;
  }
  return out;
}

// integrity en formato npm/SRI: «sha512-<base64>».
export function verifyIntegrity(buffer, integrity) {
  const m = /^sha512-(.+)$/.exec(String(integrity || ''));
  if (!m) return false;
  return crypto.createHash('sha512').update(buffer).digest('base64') === m[1];
}
