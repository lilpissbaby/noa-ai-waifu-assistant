// Lector de .zip para los packs de voces (y modelos Live2D): lee el directorio central, rechaza
// rutas peligrosas y enlaces simbólicos, y limita entradas y tamaño antes de descomprimir.
// Sin dependencias: Node trae inflateRaw. No admite ZIP64 ni cifrado.
import zlib from 'node:zlib';

const fail = (code, message = code) => Object.assign(new Error(message), { code });

export function isUnsafePath(name) {
  if (!name || name.includes('\0')) return true;
  if (/^([a-z]:|[\\/])/i.test(name)) return true;
  return name.split(/[\\/]+/).some((part) => part === '..');
}

function findEnd(buf) {
  const min = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= min; i--) if (buf.readUInt32LE(i) === 0x06054b50) return i;
  return -1;
}

export function readZip(buffer, { maxFiles = 2000, maxBytes = Infinity, want = () => true } = {}) {
  const end = buffer.length >= 22 ? findEnd(buffer) : -1;
  if (end < 0) throw fail('corrupt', 'Not a zip file');
  const count = buffer.readUInt16LE(end + 10);
  if (count > maxFiles) throw fail('tooMany');
  let pos = buffer.readUInt32LE(end + 16);
  const entries = [];
  for (let i = 0; i < count; i++) {
    if (pos + 46 > buffer.length || buffer.readUInt32LE(pos) !== 0x02014b50) throw fail('corrupt', 'Broken zip directory');
    const madeBy = buffer.readUInt16LE(pos + 4) >> 8;
    const flags = buffer.readUInt16LE(pos + 8);
    const method = buffer.readUInt16LE(pos + 10);
    const compSize = buffer.readUInt32LE(pos + 20);
    const size = buffer.readUInt32LE(pos + 24);
    const nameLen = buffer.readUInt16LE(pos + 28);
    const extraLen = buffer.readUInt16LE(pos + 30);
    const commentLen = buffer.readUInt16LE(pos + 32);
    const mode = buffer.readUInt32LE(pos + 38) >>> 16;
    const offset = buffer.readUInt32LE(pos + 42);
    const name = buffer.toString(flags & 0x0800 ? 'utf8' : 'latin1', pos + 46, pos + 46 + nameLen);
    pos += 46 + nameLen + extraLen + commentLen;
    if (isUnsafePath(name)) throw fail('unsafe', `Unsafe path in zip: ${name}`);
    if (madeBy === 3 && (mode & 0xf000) === 0xa000) throw fail('unsafe', `Link in zip: ${name}`);
    if (name.endsWith('/')) continue;
    entries.push({ name, flags, method, compSize, size, offset });
  }
  const out = [];
  let total = 0;
  for (const e of entries) {
    if (!want(e.name)) continue;
    total += e.size;
    if (total > maxBytes) throw fail('tooBig');
    if (e.flags & 1) throw fail('corrupt', `Encrypted entry: ${e.name}`);
    const lh = e.offset;
    if (lh + 30 > buffer.length || buffer.readUInt32LE(lh) !== 0x04034b50) throw fail('corrupt', `Broken entry: ${e.name}`);
    const start = lh + 30 + buffer.readUInt16LE(lh + 26) + buffer.readUInt16LE(lh + 28);
    const body = buffer.subarray(start, start + e.compSize);
    let data;
    if (e.method === 0) data = Buffer.from(body);
    else if (e.method === 8) {
      try {
        data = zlib.inflateRawSync(body, { maxOutputLength: Math.max(1, e.size) });
      } catch (err) {
        throw fail(err.code === 'ERR_BUFFER_TOO_LARGE' ? 'tooBig' : 'corrupt', `${e.name}: ${err.message}`);
      }
    } else throw fail('corrupt', `Unsupported compression in ${e.name}`);
    if (data.length !== e.size) throw fail('corrupt', `Size mismatch in ${e.name}`);
    out.push({ name: e.name, data });
  }
  return out;
}
