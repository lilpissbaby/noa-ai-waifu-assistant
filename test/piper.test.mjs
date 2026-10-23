import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { extractTarGz, verifyIntegrity } from '../src/main/tar.js';
import { piperInputs, parsePhonemizeOutput } from '../src/renderer/shared/piper-inputs.js';
import { encodeWav } from '../src/renderer/shared/wav.js';

// tar (ustar) mínimo con las entradas dadas, comprimido con gzip.
function tarGz(entries) {
  const blocks = [];
  for (const [name, content] of entries) {
    const data = Buffer.from(content);
    const h = Buffer.alloc(512);
    h.write(name, 0, 100, 'utf8');
    h.write('0000644\0', 100);
    h.write('0000000\0', 108);
    h.write('0000000\0', 116);
    h.write(data.length.toString(8).padStart(11, '0') + '\0', 124);
    h.write('00000000000\0', 136);
    h.write('        ', 148);
    h.write('0', 156);
    h.write('ustar\0', 257);
    h.write('00', 263);
    let sum = 0;
    for (const b of h) sum += b;
    h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
    blocks.push(h, data, Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return zlib.gzipSync(Buffer.concat(blocks));
}

test('extractTarGz: extrae lo pedido e ignora rutas peligrosas', () => {
  const gz = tarGz([
    ['package/build/piper_phonemize.js', 'js'],
    ['package/build/piper_phonemize.wasm', 'wasm'],
    ['package/README.md', 'readme'],
    ['../evil.js', 'x'],
    ['/abs/evil.js', 'x'],
  ]);
  const out = extractTarGz(gz, { want: (n) => n.startsWith('package/build/') || n.includes('evil') });
  assert.deepEqual([...out.keys()].sort(), ['package/build/piper_phonemize.js', 'package/build/piper_phonemize.wasm']);
  assert.equal(out.get('package/build/piper_phonemize.js').toString(), 'js');
});

test('extractTarGz: límite de tamaño', () => {
  const gz = tarGz([['package/a', 'x'.repeat(2000)]]);
  assert.throws(() => extractTarGz(gz, { want: () => true, maxBytes: 1000 }), /tooBig|large/i);
});

test('verifyIntegrity: sha512 en formato npm', () => {
  const buf = Buffer.from('hola piper');
  const integrity = `sha512-${crypto.createHash('sha512').update(buf).digest('base64')}`;
  assert.equal(verifyIntegrity(buf, integrity), true);
  assert.equal(verifyIntegrity(Buffer.from('otra cosa'), integrity), false);
  assert.equal(verifyIntegrity(buf, 'md5-xxx'), false);
});

const ONE = { num_speakers: 1, speaker_id_map: {}, inference: { noise_scale: 0.667, length_scale: 1, noise_w: 0.8 } };
const MULTI = { num_speakers: 4, speaker_id_map: { a: 0, b: 1, c: 2, d: 3 }, inference: { noise_scale: 0.5, length_scale: 1.1, noise_w: 0.7 } };

test('piperInputs: un solo hablante, velocidad', () => {
  const r = piperInputs([1, 5, 9, 2], ONE, { rate: 1.25 });
  assert.deepEqual([...r.input], [1n, 5n, 9n, 2n]);
  assert.deepEqual([...r.input_lengths], [4n]);
  assert.ok(Math.abs(r.scales[0] - 0.667) < 1e-6);
  assert.ok(Math.abs(r.scales[1] - 1 / 1.25) < 1e-6);
  assert.ok(Math.abs(r.scales[2] - 0.8) < 1e-6);
  assert.equal(r.sid, null);
});

test('piperInputs: varios hablantes', () => {
  const r = piperInputs([1, 2], MULTI, { speaker: 3 });
  assert.deepEqual([...r.sid], [3n]);
  assert.ok(Math.abs(r.scales[1] - 1.1) < 1e-6);
  assert.deepEqual([...piperInputs([1], MULTI, { speaker: 99 }).sid], [0n], 'hablante fuera de rango → 0');
});

test('parsePhonemizeOutput: una lista de ids por frase', () => {
  const out = parsePhonemizeOutput(['{"text":"Hola.","phonemes":["o"],"phoneme_ids":[1,0,25,0,2]}', '', '{"text":"Adiós.","phoneme_ids":[1,0,14,0,2]}', 'basura']);
  assert.deepEqual(out, [[1, 0, 25, 0, 2], [1, 0, 14, 0, 2]]);
});

test('encodeWav: cabecera y muestras PCM de 16 bits', () => {
  const wav = new DataView(encodeWav(new Float32Array([0, 1, -1, 0.5]), 22050));
  const str = (o, n) => String.fromCharCode(...Array.from({ length: n }, (_, i) => wav.getUint8(o + i)));
  assert.equal(str(0, 4), 'RIFF');
  assert.equal(str(8, 4), 'WAVE');
  assert.equal(wav.byteLength, 44 + 2 * 4);
  assert.equal(wav.getUint32(24, true), 22050);
  assert.equal(wav.getUint16(34, true), 16);
  assert.equal(wav.getInt16(46, true), 32767);
  assert.equal(wav.getInt16(48, true), -32768);
});

test('installPiperRuntime: comprueba la integridad del tarball', async () => {
  const { installPiperRuntime, piperRuntimeStatus } = await import('../src/main/piper-runtime.js');
  assert.equal(piperRuntimeStatus().ready, false);
  assert.throws(() => installPiperRuntime(tarGz([['package/build/piper_phonemize.js', 'x']])), (e) => e.code === 'integrity');
  assert.equal(piperRuntimeStatus().ready, false);
});
