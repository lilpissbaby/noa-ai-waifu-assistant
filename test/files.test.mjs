import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveInside, listDir, searchFiles } from '../src/main/productivity/files.js';
import { fileTools } from '../src/main/tools/files.js';

// .native: en Windows también expande los nombres cortos 8.3 (RUNNER~1), como hace resolveInside.
const tmp = () => fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'waifu-files-')));

test('resolveInside acepta subcarpetas y rechaza lo que sale de las carpetas autorizadas', () => {
  const root = tmp();
  const outside = tmp();
  fs.mkdirSync(path.join(root, 'docs', 'sub'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'a.txt'), 'a');
  fs.writeFileSync(path.join(outside, 'secreto.txt'), 's');
  assert.equal(resolveInside([root], 'docs/a.txt'), path.join(root, 'docs', 'a.txt'));
  assert.equal(resolveInside([root], path.join(root, 'docs', 'sub')), path.join(root, 'docs', 'sub'));
  assert.equal(resolveInside([outside, root], path.join(root, 'docs')), path.join(root, 'docs'));
  // Un archivo que aún no existe (para escribirlo) también vale si su carpeta está dentro.
  assert.equal(resolveInside([root], 'docs/nuevo/b.md'), path.join(root, 'docs', 'nuevo', 'b.md'));
  for (const bad of ['../secreto.txt', 'docs/../../x', path.join(outside, 'secreto.txt')]) assert.throws(() => resolveInside([root], bad), (e) => e.code === 'outside', bad);
  fs.symlinkSync(outside, path.join(root, 'atajo'));
  assert.throws(() => resolveInside([root], 'atajo/secreto.txt'), (e) => e.code === 'outside');
  assert.throws(() => resolveInside([], 'a.txt'), (e) => e.code === 'noRoots');
});

test('listDir y searchFiles (por nombre y por contenido, máximo 50)', () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, 'proyecto', 'node_modules'), { recursive: true });
  fs.writeFileSync(path.join(root, 'proyecto', 'notas.md'), 'línea uno\nel presupuesto es 3000\n');
  fs.writeFileSync(path.join(root, 'proyecto', 'node_modules', 'presupuesto.js'), 'x');
  fs.writeFileSync(path.join(root, 'Presupuesto 2026.xlsx'), Buffer.alloc(10));
  const ls = listDir(root);
  assert.deepEqual(
    ls.map((e) => [e.name, e.dir]),
    [
      ['proyecto', true],
      ['Presupuesto 2026.xlsx', false],
    ],
  );
  assert.equal(typeof ls[1].size, 'number');
  const hits = searchFiles([root], 'presupuesto');
  assert.deepEqual(hits.map((h) => path.relative(root, h.path)).sort(), ['Presupuesto 2026.xlsx', path.join('proyecto', 'notas.md')]);
  assert.equal(hits.find((h) => h.path.endsWith('notas.md')).line, 'el presupuesto es 3000');
  for (let i = 0; i < 70; i++) fs.writeFileSync(path.join(root, `informe-${i}.txt`), 'informe');
  assert.equal(searchFiles([root], 'informe').length, 50);
  assert.equal(searchFiles([root], 'informe', path.join(root, 'proyecto')).length, 0);
});

test('herramientas de archivos: sin carpetas avisan; leer, escribir y buscar dentro', async () => {
  const none = Object.fromEntries(fileTools({ productivity: { folders: [] } }).map((t) => [t.name, t]));
  await assert.rejects(none.files_list.run({}), /Settings/);
  const root = tmp();
  fs.writeFileSync(path.join(root, 'leeme.txt'), 'Hola desde un archivo');
  const tools = Object.fromEntries(fileTools({ productivity: { folders: [root] } }).map((t) => [t.name, t]));
  assert.deepEqual(
    (await tools.files_list.run({})).map((e) => e.name),
    [path.basename(root)],
  );
  assert.equal((await tools.files_read.run({ path: path.join(root, 'leeme.txt') })).text, 'Hola desde un archivo');
  assert.ok(tools.files_write.confirm({ path: 'x.md', content: 'y' }));
  assert.equal(tools.files_write.confirm({ path: 'x.md', content: 'y' }).allowAlways, false);
  await tools.files_write.run({ path: path.join(root, 'sub', 'nuevo.md'), content: '# Nuevo' });
  assert.equal(fs.readFileSync(path.join(root, 'sub', 'nuevo.md'), 'utf8'), '# Nuevo');
  await assert.rejects(tools.files_read.run({ path: '/etc/hostname' }), /outside/i);
  assert.equal((await tools.files_search.run({ query: 'leeme' })).length, 1);
});
