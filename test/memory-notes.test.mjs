import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listMemory, saveMemory, forgetMemory, memoryPrompt } from '../src/main/productivity/memory.js';
import { noteFile, noteCreate, noteAppend, noteRead, noteSearch } from '../src/main/productivity/notes.js';
import { memoryTools } from '../src/main/tools/memory.js';
import { noteTools } from '../src/main/tools/notes.js';
import { buildSystemPrompt } from '../src/main/llm/agent.js';
import { loadConfig } from '../src/main/config.js';

test('memoryPrompt: cabe en 2000 caracteres y empieza por lo más reciente', () => {
  const entries = Array.from({ length: 100 }, (_, i) => ({ id: `m${i}`, text: `Dato número ${String(i).padStart(3, '0')} `.padEnd(50, 'x'), created: new Date(2026, 0, 1, 0, i).toISOString() }));
  const p = memoryPrompt(entries);
  assert.ok(p.length <= 2000, `${p.length}`);
  const lines = p.split('\n').filter((l) => l.startsWith('- '));
  assert.match(lines[0], /Dato número 099/);
  assert.match(lines[1], /Dato número 098/);
  assert.ok(lines.length > 10 && lines.length < 100);
  assert.equal(memoryPrompt([]), '');
});

test('saveMemory no duplica, forgetMemory borra', () => {
  const a = saveMemory('Le gusta el café solo');
  const b = saveMemory('  le gusta el café solo ');
  assert.equal(a.id, b.id);
  assert.equal(listMemory().length, 1);
  assert.throws(() => saveMemory('   '));
  assert.equal(forgetMemory(a.id), true);
  assert.equal(forgetMemory(a.id), false);
  assert.equal(listMemory().length, 0);
});

test('la memoria entra en el prompt de sistema', () => {
  const cfg = loadConfig();
  const p = buildSystemPrompt(cfg, [], 'es', { memory: memoryPrompt([{ id: 'x1', text: 'Se llama mupsim y programa en Rust', created: new Date().toISOString() }]) });
  assert.match(p, /Things you know about the user/);
  assert.match(p, /mupsim y programa en Rust/);
  assert.doesNotMatch(buildSystemPrompt(cfg, [], 'es'), /Things you know/);
});

test('herramientas de memoria', async () => {
  const tools = Object.fromEntries(memoryTools().map((t) => [t.name, t]));
  const saved = await tools.memory_save.run({ fact: 'Su perro se llama Toby' });
  assert.match(saved, /Toby/);
  const list = await tools.memory_list.run({});
  assert.equal(list.length, 1);
  assert.match(await tools.memory_forget.run({ id: list[0].id }), /Forgot/);
  await assert.rejects(tools.memory_forget.run({ id: 'nope' }), /No memory/);
});

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'waifu-notes-'));

test('noteFile nunca sale de la carpeta', () => {
  const dir = tmpDir();
  for (const title of ['../../etc/passwd', '..', 'a/b\\c', 'CON:', '  .oculto  ', '']) {
    const f = noteFile(dir, title);
    assert.equal(path.dirname(f), dir, title);
    assert.ok(f.endsWith('.md'));
    assert.ok(path.basename(f).length > 3, title);
  }
  assert.equal(path.basename(noteFile(dir, 'Lista de la compra')), 'Lista de la compra.md');
  // Nombres reservados de Windows.
  assert.equal(path.basename(noteFile(dir, 'CON:')), '_CON.md');
  assert.equal(path.basename(noteFile(dir, 'lpt1')), '_lpt1.md');
});

test('noteCreate no sobrescribe; noteAppend crea o añade', () => {
  const dir = tmpDir();
  const a = noteCreate(dir, { title: 'Ideas', content: 'una' });
  const b = noteCreate(dir, { title: 'Ideas', content: 'dos' });
  assert.equal(a.title, 'Ideas');
  assert.equal(b.title, 'Ideas (2)');
  assert.equal(fs.readFileSync(path.join(dir, 'Ideas.md'), 'utf8'), 'una');
  noteAppend(dir, { title: 'Ideas', content: 'tres' });
  assert.equal(noteRead(dir, { title: 'Ideas' }).content, 'una\n\ntres');
  noteAppend(dir, { title: 'Diario', content: 'hoy' });
  assert.equal(noteRead(dir, { title: 'diario' }).content, 'hoy');
});

test('noteSearch busca por título y contenido, también en subcarpetas', () => {
  const dir = tmpDir();
  fs.mkdirSync(path.join(dir, 'proyectos', 'waifu'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'proyectos', 'waifu', 'Roadmap.md'), 'Primero los recordatorios.\nDespués Live2D y la memoria a largo plazo.');
  fs.writeFileSync(path.join(dir, 'Compra.md'), 'leche, pan');
  fs.writeFileSync(path.join(dir, 'imagen.png'), 'live2d');
  const r = noteSearch(dir, 'live2d');
  assert.equal(r.length, 1);
  assert.equal(r[0].title, 'proyectos/waifu/Roadmap');
  assert.match(r[0].snippet, /Live2D/);
  assert.equal(noteSearch(dir, 'compra')[0].title, 'Compra');
  assert.equal(noteRead(dir, { title: 'Roadmap' }).title, 'proyectos/waifu/Roadmap');
  for (let i = 0; i < 30; i++) fs.writeFileSync(path.join(dir, `n${i}.md`), 'repetido');
  assert.equal(noteSearch(dir, 'repetido').length, 20);
});

test('noteRead de un título que no existe da un error claro', () => {
  assert.throws(() => noteRead(tmpDir(), { title: 'Fantasma' }), /No note titled "Fantasma"/);
});

test('herramientas de notas usan la carpeta configurada', async () => {
  const dir = tmpDir();
  const tools = Object.fromEntries(noteTools({ productivity: { notesDir: dir } }).map((t) => [t.name, t]));
  await tools.note_create.run({ title: 'Reunión', content: 'Puntos: presupuesto' });
  assert.ok(fs.existsSync(path.join(dir, 'Reunión.md')));
  await tools.note_append.run({ title: 'Reunión', content: 'Acordado: 3 sprints' });
  assert.match((await tools.note_read.run({ title: 'reunión' })).content, /3 sprints/);
  assert.equal((await tools.note_search.run({ query: 'presupuesto' })).length, 1);
});
