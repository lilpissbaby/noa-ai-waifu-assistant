import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readZip } from '../src/main/zip.js';
import { makeZip } from './helpers/zip.mjs';

test('readZip lee entradas guardadas y comprimidas', () => {
  const zip = makeZip([
    { name: 'voz/a.onnx.json', data: '{"a":1}' },
    { name: 'voz/a.onnx', data: Buffer.alloc(5000, 7), deflate: false },
    { name: 'voz/', data: '' },
  ]);
  const files = readZip(zip);
  assert.deepEqual(
    files.map((f) => f.name),
    ['voz/a.onnx.json', 'voz/a.onnx'],
  );
  assert.equal(files[0].data.toString(), '{"a":1}');
  assert.equal(files[1].data.length, 5000);
});

test('readZip con filtro solo descomprime lo pedido', () => {
  const zip = makeZip([
    { name: 'a.txt', data: 'x' },
    { name: 'b.onnx', data: 'y' },
  ]);
  assert.deepEqual(
    readZip(zip, { want: (n) => n.endsWith('.onnx') }).map((f) => f.name),
    ['b.onnx'],
  );
});

test('readZip rechaza rutas peligrosas y enlaces', () => {
  for (const name of ['../evil.onnx', 'a/../../evil', '/etc/passwd', 'C:\\evil', 'a\\..\\..\\b']) {
    assert.throws(() => readZip(makeZip([{ name, data: 'x' }])), (e) => e.code === 'unsafe', name);
  }
  assert.throws(() => readZip(makeZip([{ name: 'link.onnx', data: '/etc/passwd', mode: 0o120777 }])), (e) => e.code === 'unsafe');
});

test('readZip limita el número de entradas y el tamaño', () => {
  const many = makeZip(Array.from({ length: 2001 }, (_, i) => ({ name: `f${i}`, data: '', deflate: false })));
  assert.throws(() => readZip(many), (e) => e.code === 'tooMany');
  assert.equal(readZip(many, { maxFiles: 3000 }).length, 2001);
  const big = makeZip([{ name: 'big.bin', data: Buffer.alloc(2_000_000) }]);
  assert.throws(() => readZip(big, { maxBytes: 1_000_000 }), (e) => e.code === 'tooBig');
});

test('readZip: lo que no es un zip falla con un código claro', () => {
  assert.throws(() => readZip(Buffer.from('no soy un zip')), (e) => e.code === 'corrupt');
});
