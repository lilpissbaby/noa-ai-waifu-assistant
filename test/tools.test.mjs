import { test } from 'node:test';
import assert from 'node:assert/strict';
import { __test } from 'electron';
import { setLocale } from '../src/shared/i18n/index.js';
import { compact, pick, slug, jsonRequest } from '../src/main/tools/util.js';
import { buildToolbox } from '../src/main/tools/index.js';
import { builtinTools } from '../src/main/tools/builtin.js';
import { paperclipTools, testPaperclip } from '../src/main/tools/paperclip.js';
import { webhookTools } from '../src/main/tools/webhooks.js';
import { defaultConfig } from '../src/main/config.js';
import { serve, json } from './helpers/http.mjs';

const baseCfg = () => defaultConfig('es');

test('util: compact, pick y slug', () => {
  const long = 'x'.repeat(2000);
  const c = compact({ a: long, b: null, c: [], d: {}, e: Array.from({ length: 60 }, (_, i) => i) });
  assert.equal(c.a.length, 1501);
  assert.equal('b' in c || 'c' in c || 'd' in c, false);
  assert.equal(c.e.length, 51);
  assert.equal(c.e.at(-1), '…(10 more)');
  assert.deepEqual(pick({ a: 1, b: null, c: 3 }, ['a', 'b']), { a: 1 });
  assert.equal(slug('Copia de Seguridad — VPS!'), 'copia_de_seguridad_vps');
  assert.equal(slug(''), 'x');
});

test('jsonRequest(): devuelve JSON y traduce el tiempo de espera', async () => {
  setLocale('es');
  const srv = await serve((req, res) => {
    if (req.url === '/slow') return setTimeout(() => json(res, {}), 500);
    json(res, { ok: true, echo: req.body });
  });
  try {
    assert.deepEqual(await jsonRequest(`${srv.url}/x`, { method: 'POST', body: { a: 1 } }), { ok: true, echo: { a: 1 } });
    await assert.rejects(jsonRequest(`${srv.url}/slow`, { timeoutMs: 50, label: 'Paperclip' }), /Paperclip: tiempo de espera agotado/);
  } finally {
    await srv.close();
  }
});

test('builtin: las herramientas básicas están y run_command solo si se activa', () => {
  const names = builtinTools(baseCfg()).map((t) => t.name);
  assert.deepEqual(names, ['get_current_time', 'open_url', 'clipboard_read', 'clipboard_write', 'show_notification']);
  const cfg = baseCfg();
  cfg.connectors.shell.enabled = true;
  assert.ok(builtinTools(cfg).some((t) => t.name === 'run_command'));
});

test('toolbox: la confirmación sale traducida y «Denegar» lanza un error', async () => {
  setLocale('en');
  const cfg = baseCfg();
  cfg.connectors.shell.enabled = true;
  const box = buildToolbox(cfg, () => null);
  __test.dialogResponses.push(1); // sin «Permitir siempre»: [Allow, Deny]
  await assert.rejects(box.run('run_command', { command: 'echo hi' }), /The user denied the action/);
  const d = __test.dialogs.at(-1);
  assert.deepEqual(d.buttons, ['Allow', 'Deny']);
  assert.equal(d.title, 'Run command');
  assert.equal(d.message, 'Noa wants to run this on your PC:');
});

test('toolbox: clipboard y notificación', async () => {
  const box = buildToolbox(baseCfg(), () => null);
  await box.run('clipboard_write', { text: 'hola' });
  assert.equal(await box.run('clipboard_read', {}), 'hola');
  await box.run('show_notification', { title: 'T', body: 'B' });
  assert.deepEqual(__test.notifications.at(-1), { title: 'T', body: 'B' });
});

test('paperclip: crea tareas en /api/companies/:id/issues con Bearer', async () => {
  const srv = await serve((req, res) => {
    if (req.url === '/api/companies') return json(res, [{ id: 'c1', name: 'Acme' }]);
    if (req.method === 'POST' && req.url === '/api/companies/c1/issues') return json(res, { id: 'i1', identifier: 'PAP-7', title: req.body.title, status: req.body.status, extra: 'x' });
    json(res, { error: 'no' }, 404);
  });
  try {
    setLocale('ru');
    const pc = { enabled: true, baseUrl: srv.url, companyId: 'c1' };
    const r = await testPaperclip(pc);
    assert.equal(r.message, 'Подключено. 1 компания.');
    const cfg = baseCfg();
    cfg.connectors.paperclip = pc;
    const tools = paperclipTools(cfg);
    const create = tools.find((t) => t.name === 'paperclip_create_issue');
    assert.match(create.confirm({ title: 'Migrar' }).message, /Создать задачу «Migrar»/);
    const out = await create.run({ title: 'Migrar' }, {});
    assert.deepEqual(out, { id: 'i1', identifier: 'PAP-7', title: 'Migrar', status: 'todo' });
  } finally {
    setLocale('es');
    await srv.close();
  }
});

test('webhooks: GET con query string y POST con payload', async () => {
  const srv = await serve((req, res) => json(res, { got: req.method, url: req.url, body: req.body }));
  try {
    const cfg = baseCfg();
    cfg.connectors.webhooks = [
      { id: 'a', name: 'Backup VPS', url: `${srv.url}/hook`, method: 'POST', enabled: true },
      { id: 'b', name: 'Luz', url: `${srv.url}/ha?x=1`, method: 'GET', enabled: true },
      { id: 'c', name: 'Apagado', url: `${srv.url}/off`, enabled: false },
    ];
    const tools = webhookTools(cfg);
    assert.deepEqual(
      tools.map((t) => t.name),
      ['webhook_backup_vps', 'webhook_luz'],
    );
    assert.deepEqual((await tools[0].run({ payload: { target: 'db' } }, {})).body, { target: 'db' });
    assert.equal((await tools[1].run({ payload: { on: true } }, {})).url, '/ha?x=1&on=true');
  } finally {
    await srv.close();
  }
});
