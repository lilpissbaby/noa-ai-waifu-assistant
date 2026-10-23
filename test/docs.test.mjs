import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { extractPdfText, extractDocxText, readDocument, attachmentsFromPaths } from '../src/main/productivity/docs.js';
import { makeZip } from './helpers/zip.mjs';
import { makePdf } from './helpers/pdf.mjs';

const DOCX_XML =
  '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
  '<w:p><w:r><w:t>Primer párrafo</w:t></w:r></w:p>' +
  '<w:p><w:r><w:t xml:space="preserve">Segundo </w:t></w:r><w:r><w:t>con &amp; y &lt;etiquetas&gt;</w:t></w:r><w:r><w:tab/><w:t>tab</w:t></w:r></w:p>' +
  '<w:p/><w:p><w:r><w:t>Fin</w:t><w:br/><w:t>otra línea</w:t></w:r></w:p></w:body></w:document>';

test('extractDocxText: un párrafo por línea, entidades y tabuladores', () => {
  const docx = makeZip([
    { name: '[Content_Types].xml', data: '<Types/>' },
    { name: 'word/document.xml', data: DOCX_XML },
  ]);
  assert.equal(extractDocxText(docx), 'Primer párrafo\nSegundo con & y <etiquetas>\ttab\n\nFin\notra línea');
  assert.throws(() => extractDocxText(makeZip([{ name: 'otra.xml', data: '<x/>' }])), /docx/i);
});

test('extractPdfText: PDF mínimo', async () => {
  assert.match(await extractPdfText(makePdf('Hola PDF')), /Hola PDF/);
});

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'waifu-docs-'));

test('readDocument: por extensión, recorta a 100 000 caracteres y rechaza binarios', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'largo.txt'), 'a'.repeat(150000));
  const r = await readDocument(path.join(dir, 'largo.txt'));
  assert.equal(r.truncated, true);
  assert.equal(r.text.length, 100000);
  fs.writeFileSync(path.join(dir, 'doc.pdf'), makePdf('Informe anual'));
  assert.match((await readDocument(path.join(dir, 'doc.pdf'))).text, /Informe anual/);
  fs.writeFileSync(path.join(dir, 'datos.csv'), 'a,b\n1,2');
  assert.deepEqual(await readDocument(path.join(dir, 'datos.csv')), { text: 'a,b\n1,2', truncated: false });
  fs.writeFileSync(path.join(dir, 'programa.exe'), Buffer.from([0x4d, 0x5a, 0, 0, 1, 2]));
  await assert.rejects(readDocument(path.join(dir, 'programa.exe')), (e) => e.code === 'unsupported');
});

test('attachmentsFromPaths: imágenes como imagen, documentos como texto', async () => {
  const dir = tmp();
  const png = path.join(dir, 'foto.png');
  fs.writeFileSync(png, Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'));
  const txt = path.join(dir, 'notas.md');
  fs.writeFileSync(txt, '# Notas\nhola');
  const [a, b] = await attachmentsFromPaths([png, txt]);
  assert.equal(a.kind, 'image');
  assert.equal(a.mime, 'image/png');
  assert.equal(a.name, 'foto.png');
  assert.deepEqual(b, { kind: 'text', name: 'notas.md', text: '# Notas\nhola' });
  const big = path.join(dir, 'enorme.txt');
  fs.writeFileSync(big, Buffer.alloc(21 * 1024 * 1024, 97));
  await assert.rejects(attachmentsFromPaths([big]), (e) => e.code === 'tooBig');
});
