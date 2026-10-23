import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PaperclipWatcher } from '../src/main/productivity/watchers.js';
import { hermesTools } from '../src/main/tools/hermes.js';
import { paperclipTools } from '../src/main/tools/paperclip.js';
import { defaultConfig } from '../src/main/config.js';
import { serve, sendSSE, json } from './helpers/http.mjs';

const tmpFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'waifu-watch-')), 'watch.json');

function fakeTracker(initial) {
  const issues = new Map(Object.entries(initial));
  return {
    issues,
    getIssue: async (id) => {
      const i = issues.get(id);
      if (i === 'net') throw new Error('ECONNRESET');
      if (!i) throw new Error('404');
      return { id, identifier: `PAP-${id}`, title: `Tarea ${id}`, status: i };
    },
  };
}

test('PaperclipWatcher: avisa solo de los estados importantes y deja de vigilar las cerradas', async () => {
  const tr = fakeTracker({ 1: 'todo' });
  const changes = [];
  const w = new PaperclipWatcher({ file: tmpFile(), getIssue: tr.getIssue, onChange: (issue, from, to) => changes.push([issue.identifier, from, to]) });
  w.watch('1', 'todo');
  w.watch('1', 'todo');
  assert.equal(w.list().length, 1);
  tr.issues.set('1', 'in_progress');
  await w.poll();
  assert.deepEqual(changes, []);
  assert.equal(w.list()[0].status, 'in_progress');
  tr.issues.set('1', 'done');
  const r = await w.poll();
  assert.deepEqual(changes, [['PAP-1', 'in_progress', 'done']]);
  assert.deepEqual(r, [{ id: '1', from: 'in_progress', to: 'done' }]);
  assert.equal(w.list().length, 0);
  await w.poll();
  assert.equal(changes.length, 1);
});

test('PaperclipWatcher: bloqueada y en revisión avisan pero se siguen vigilando; sin estado inicial no avisa', async () => {
  const tr = fakeTracker({ 2: 'in_progress', 3: 'blocked' });
  const changes = [];
  const w = new PaperclipWatcher({ file: tmpFile(), getIssue: tr.getIssue, onChange: (issue, from, to) => changes.push(to) });
  w.watch('2', 'in_progress');
  w.watch('3');
  tr.issues.set('2', 'blocked');
  await w.poll();
  assert.deepEqual(changes, ['blocked']);
  tr.issues.set('2', 'in_review');
  await w.poll();
  assert.deepEqual(changes, ['blocked', 'in_review']);
  assert.deepEqual(
    w.list().map((x) => [x.id, x.status]),
    [
      ['2', 'in_review'],
      ['3', 'blocked'],
    ],
  );
  w.unwatch('3');
  assert.equal(w.list().length, 1);
});

test('PaperclipWatcher: persiste y un error de red no rompe el resto', async () => {
  const file = tmpFile();
  const tr = fakeTracker({ 4: 'todo', 5: 'todo' });
  const changes = [];
  const a = new PaperclipWatcher({ file, getIssue: tr.getIssue, onChange: (i, f, to) => changes.push([i.id, to]) });
  a.watch('4', 'todo', 'Migrar BD');
  a.watch('5', 'todo');
  const b = new PaperclipWatcher({ file, getIssue: tr.getIssue, onChange: (i, f, to) => changes.push([i.id, to]) });
  assert.deepEqual(
    b.list().map((x) => [x.id, x.title]),
    [
      ['4', 'Migrar BD'],
      ['5', ''],
    ],
  );
  tr.issues.set('4', 'net');
  tr.issues.set('5', 'cancelled');
  await b.poll();
  assert.deepEqual(changes, [['5', 'cancelled']]);
  assert.deepEqual(
    b.list().map((x) => x.id),
    ['4'],
  );
});

test('las herramientas de Paperclip vigilan lo que crean y comentan; paperclip_watch', async () => {
  const srv = await serve((req, res) => {
    if (req.url === '/api/companies/c1/issues' && req.method === 'POST') return json(res, { id: 'i9', identifier: 'PAP-9', title: req.body.title, status: 'todo' });
    if (req.url === '/api/issues/i9/comments') return json(res, { id: 'cm1' });
    if (req.url === '/api/issues/i9') return json(res, { id: 'i9', identifier: 'PAP-9', title: 'X', status: 'todo' });
    return json(res, {}, 404);
  });
  try {
    const cfg = defaultConfig('es');
    cfg.connectors.paperclip = { enabled: true, baseUrl: srv.url, companyId: 'c1' };
    const watched = [];
    const tools = Object.fromEntries(paperclipTools(cfg, { watchIssue: (...a) => watched.push(a) }).map((x) => [x.name, x]));
    await tools.paperclip_create_issue.run({ title: 'Nueva' }, {});
    await tools.paperclip_add_comment.run({ issueId: 'i9', body: 'ojo' }, {});
    assert.match(await tools.paperclip_watch.run({ issueId: 'i9' }, {}), /PAP-9/);
    assert.deepEqual(watched, [
      ['i9', 'todo', 'PAP-9 · Nueva'],
      ['i9', null, ''],
      ['i9', 'todo', 'PAP-9 · X'],
    ]);
  } finally {
    await srv.close();
  }
});

test('hermes_task en segundo plano: responde al momento y el resultado llega por runBackground', async () => {
  const srv = await serve((req, res) => sendSSE(res, [{ choices: [{ delta: { content: '12 contenedores en marcha' } }] }, '[DONE]']));
  try {
    const cfg = defaultConfig('es');
    cfg.connectors.hermes = { enabled: true, baseUrl: srv.url, model: 'hermes-agent' };
    let job = null;
    const [tool] = hermesTools(cfg, { runBackground: (label, factory) => (job = { label, promise: factory() }) });
    const r = await tool.run({ task: 'docker ps', background: true }, {});
    assert.match(r, /background/);
    assert.match(job.label, /Hermes/);
    assert.equal(await job.promise, '12 contenedores en marcha');
    // Sin segundo plano espera y devuelve el resultado.
    assert.equal(await tool.run({ task: 'docker ps' }, {}), '12 contenedores en marcha');
  } finally {
    await srv.close();
  }
});
