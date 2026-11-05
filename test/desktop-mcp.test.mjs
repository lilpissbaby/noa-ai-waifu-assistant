// Claude Desktop (MCP) como cerebro: la cola, el anfitrión, el servidor local, el puente stdio
// (con un cliente MCP de verdad) y el alta en claude_desktop_config.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Relay } from '../src/main/desktop-mcp/relay.js';
import { createDesktopHost } from '../src/main/desktop-mcp/host.js';
import { startServer, newToken } from '../src/main/desktop-mcp/server.js';
import { describeTools, harnessTools, listenResult } from '../src/main/desktop-mcp/tools.js';
import * as cc from '../src/main/desktop-mcp/claude-config.js';

const BRIDGE = path.resolve(import.meta.dirname, '../src/main/desktop-mcp/bridge.cjs');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'noa-mcp-'));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const textOf = (r) => r.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');

// ---------------------------------------------------------------- cola
test('relay: lo que ya está en cola sale al momento y lo nuevo despierta a quien espera', async () => {
  const r = new Relay();
  r.enqueue({ text: 'hola' });
  const first = await r.listen({ timeoutMs: 1000 });
  assert.deepEqual(first.messages.map((m) => m.text), ['hola']);
  assert.equal(r.pending().length, 1);

  const pending = r.listen({ timeoutMs: 5000, session: 's1', client: 'Claude Desktop' });
  assert.equal(r.listening, true);
  r.enqueue({ text: '¿qué tiempo hace?' });
  const second = await pending;
  assert.deepEqual(second.messages.map((m) => m.text), ['¿qué tiempo hace?']);
  // El primero se entregó y nadie lo contestó con final=true: vuelve como «unanswered».
  assert.deepEqual(second.unanswered.map((m) => m.text), ['hola']);
  assert.equal(r.status().connected, true);
  assert.deepEqual(r.status().clients, ['Claude Desktop']);
});

test('relay: sin mensajes, la espera acaba por tiempo o al cancelarla', async () => {
  const r = new Relay();
  assert.equal(r.connected(), false);
  r.note('aviso');
  assert.deepEqual(await r.listen({ timeoutMs: 20 }), { timeout: true, notes: ['aviso'], unanswered: [] });
  const ctrl = new AbortController();
  const p = r.listen({ timeoutMs: 5000, signal: ctrl.signal });
  ctrl.abort();
  assert.equal((await p).cancelled, true);
  assert.equal(r.listening, false);
});

test('relay: «conectado» caduca si Claude deja de llamar', async () => {
  let now = 1_000_000;
  const r = new Relay({ now: () => now, idleAfterMs: 60_000 });
  await r.listen({ timeoutMs: 0 });
  assert.equal(r.connected(), true);
  now += 61_000;
  assert.equal(r.connected(), false);
});

test('relay: parar tira la cola y lo que se estaba contestando', async () => {
  const r = new Relay();
  r.enqueue({ text: 'a' });
  await r.listen({ timeoutMs: 10 });
  r.enqueue({ text: 'b' });
  assert.deepEqual(r.cancel().map((m) => m.text), ['b', 'a']);
  assert.equal(r.status().queued, 0);
  assert.equal(r.pending().length, 0);
});

// ---------------------------------------------------------------- anfitrión
function fakeHost(extra = {}) {
  const log = { said: [], delivered: [], expressed: [], tools: [], settled: 0 };
  let key = 'k1';
  const toolbox = {
    list: [
      { name: 'task_add', group: 'manage tasks', description: 'Adds a task to the list. Returns the task.', schema: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] } },
      { name: 'weather_now', group: 'check the weather', description: 'Current weather.', schema: { type: 'object', properties: {} } },
    ],
    run: async (name, input) => {
      log.tools.push({ name, input });
      if (name === 'task_add') return { ok: true, title: input.title };
      throw new Error('no internet');
    },
  };
  const host = createDesktopHost({
    name: () => 'Noa',
    mode: () => extra.mode || 'compact',
    version: '9.9.9',
    briefing: ({ history }) => `BRIEF(${history})`,
    briefKey: () => key,
    toolbox: () => toolbox,
    readImage: (att) => ({ data: `IMG:${att.file}`, mimeType: 'image/jpeg' }),
    promptTitle: () => 'Modo Noa',
    ui: {
      delivered: (items) => log.delivered.push(items.map((i) => i.text)),
      said: (e) => {
        log.said.push(e);
        return { spoken: true };
      },
      expressed: (e) => log.expressed.push(e),
      toolStart: () => {},
      toolEnd: (e) => log.tools.push({ end: e.name, ok: e.ok }),
      settled: () => log.settled++,
    },
  });
  return { host, log, setKey: (k) => (key = k) };
}

test('host: noa_listen entrega el mensaje con el contexto la primera vez, y noa_say lo dice', async () => {
  const { host, log, setKey } = fakeHost();
  const ctx = { session: 'b1', client: 'Claude Desktop 1.0' };
  let reply = null;
  host.enqueue({ text: 'apúntame comprar pan', via: 'voice', speak: true, onDone: (t) => (reply = t), attachments: [{ kind: 'image', file: 'x.png', name: 'x.png' }] });
  const r1 = await host.call('noa_listen', { timeout_seconds: 5 }, ctx);
  const t1 = textOf(r1);
  assert.match(t1, /BRIEF\(12\)/);
  assert.match(t1, /apúntame comprar pan/);
  assert.match(t1, /spoken/);
  assert.deepEqual(r1.content.find((c) => c.type === 'image'), { type: 'image', data: 'IMG:x.png', mimeType: 'image/jpeg' });
  assert.deepEqual(log.delivered, [['apúntame comprar pan']]);

  const interim = await host.call('noa_say', { text: '<emo:thinking>Un segundo…', final: false }, ctx);
  assert.match(textOf(interim), /Continue/);
  const s = await host.call('noa_say', { text: '<emo:happy> <act:thumbsup>¡Apuntado!' }, ctx);
  assert.match(textOf(s), /noa_listen/);
  assert.equal(log.said[1].text, '¡Apuntado!');
  assert.deepEqual(log.said[1].emotions, ['happy']);
  assert.deepEqual(log.said[1].gestures, ['thumbsup']);
  assert.equal(log.said[1].items.length, 1);
  assert.equal(reply, 'Un segundo…\n\n¡Apuntado!');

  // La segunda vez ya no repite el contexto… salvo que cambie el personaje.
  host.enqueue({ text: 'gracias' });
  assert.doesNotMatch(textOf(await host.call('noa_listen', {}, ctx)), /BRIEF/);
  setKey('k2');
  host.enqueue({ text: 'otra' });
  assert.match(textOf(await host.call('noa_listen', {}, ctx)), /BRIEF/);
});

test('host: espera sin mensajes, y «parar» calla lo que Claude estaba contestando', async () => {
  const { host, log } = fakeHost();
  const ctx = { session: 'b2' };
  const p = host.call('noa_listen', { timeout_seconds: 5 }, ctx);
  await wait(10);
  assert.equal(host.status().listening, true);
  host.enqueue({ text: 'cuéntame un chiste largo' });
  await p;
  assert.equal(host.cancel().length, 1);
  const muted = await host.call('noa_say', { text: 'Había una vez…' }, ctx);
  assert.match(textOf(muted), /pressed stop/);
  assert.equal(log.said.length, 0);
  // El aviso no despierta a Claude: va con el siguiente mensaje.
  host.enqueue({ text: 'otra cosa' });
  const next = await host.call('noa_listen', { timeout_seconds: 5 }, ctx);
  assert.match(textOf(next), /pressed stop[\s\S]*otra cosa/);
});

test('host: si Claude vuelve a escuchar sin noa_say final, la respuesta se cierra al momento', async () => {
  const { host, log } = fakeHost();
  let done = null;
  host.enqueue({ text: 'pon música', onDone: (t) => (done = t) });
  await host.call('noa_listen', {}, { session: 'c' });
  await host.call('noa_say', { text: 'Voy…', final: false }, { session: 'c' });
  const ctrl = new AbortController();
  const waiting = host.call('noa_listen', { timeout_seconds: 30 }, { session: 'c', signal: ctrl.signal });
  await wait(10);
  assert.equal(log.settled, 1);
  assert.equal(done, 'Voy…');
  ctrl.abort();
  assert.match(textOf(await waiting), /Cancelled/);
});

test('host: noa_tools y noa_run_tool llegan a las herramientas de la app', async () => {
  const { host, log } = fakeHost();
  assert.deepEqual(
    host.listTools().map((t) => t.name),
    ['noa_listen', 'noa_say', 'noa_express', 'noa_context', 'noa_tools', 'noa_run_tool'],
  );
  assert.match(textOf(await host.call('noa_tools', {})), /To manage tasks:\n- task_add: Adds a task to the list\./);
  assert.match(textOf(await host.call('noa_tools', { query: 'task_add' })), /input schema: \{"type":"object"/);
  const ok = await host.call('noa_run_tool', { name: 'task_add', input: { title: 'pan' } });
  assert.match(textOf(ok), /"title": "pan"/);
  const bad = await host.call('noa_run_tool', { name: 'weather_now' });
  assert.equal(bad.isError, true);
  assert.match(textOf(bad), /no internet/);
  assert.equal((await host.call('noa_run_tool', { name: 'nope' })).isError, true);
  assert.deepEqual(log.tools.filter((x) => x.end), [
    { end: 'task_add', ok: true },
    { end: 'weather_now', ok: false },
  ]);
  const ex = await host.call('noa_express', { emotion: 'feliz', gesture: 'wave' });
  assert.equal(ex.isError, undefined);
  assert.deepEqual(log.expressed, [{ emotion: 'happy', gesture: 'wave' }]);
});

test('host: modo «all» expone sus herramientas sueltas y «none» ninguna', async () => {
  const all = fakeHost({ mode: 'all' }).host;
  assert.ok(all.listTools().some((t) => t.name === 'task_add' && t.inputSchema.required[0] === 'title'));
  assert.match(textOf(await all.call('task_add', { title: 'x' })), /"ok": true/);
  const none = fakeHost({ mode: 'none' }).host;
  assert.deepEqual(
    none.listTools().map((t) => t.name),
    ['noa_listen', 'noa_say', 'noa_express', 'noa_context'],
  );
  assert.equal((await none.call('noa_run_tool', { name: 'task_add' })).isError, true);
});

test('host: el prompt «noa» explica el bucle y trae el personaje', () => {
  const { host } = fakeHost();
  const p = host.prompt('noa', {}, { session: 'p' });
  assert.match(p.messages[0].content.text, /noa_listen/);
  assert.match(p.messages[0].content.text, /BRIEF\(12\)/);
  assert.equal(host.prompt('otro'), null);
  assert.equal(host.meta().prompts[0].title, 'Modo Noa');
  assert.match(host.meta().instructions, /modo Noa/);
});

test('tools: textos para el modelo', () => {
  assert.ok(harnessTools().every((t) => t.inputSchema.type === 'object' && t.description.length > 40));
  assert.match(listenResult({ messages: [], timeout: true, waitedSec: 30 }).content[0].text, /No message yet \(waited 30 s\)/);
  const r = listenResult({ messages: [{ text: 'resumen', hidden: true, ts: Date.now(), attachments: [{ kind: 'text', name: 'a.txt', text: 'x'.repeat(50) }] }], maxTextChars: 10 });
  assert.match(r.content[0].text, /Automatic request/);
  assert.match(r.content[0].text, /x{10}\n…\(truncated\)/);
  assert.match(describeTools([], ''), /no tools/);
});

// ---------------------------------------------------------------- servidor local
async function withServer(fn, handler) {
  const token = newToken();
  const srv = await startServer({ token, handler, logger: { error() {} } });
  try {
    await fn({ port: srv.port, token, base: `http://127.0.0.1:${srv.port}` });
  } finally {
    await srv.close();
  }
}

test('servidor: pide token, no acepta navegadores y deja de esperar si el puente cuelga', async () => {
  let aborted = false;
  await withServer(
    async ({ base, token }) => {
      assert.equal((await fetch(`${base}/v1/health`)).status, 401);
      assert.equal((await fetch(`${base}/v1/health`, { headers: { authorization: 'Bearer nope' } })).status, 401);
      assert.equal((await fetch(`${base}/v1/health`, { headers: { authorization: `Bearer ${token}`, origin: 'https://evil.example' } })).status, 403);
      const auth = { authorization: `Bearer ${token}`, 'x-noa-session': 'abc', 'x-noa-client': encodeURIComponent('Claude Desktop') };
      assert.deepEqual(await (await fetch(`${base}/v1/health`, { headers: auth })).json(), { ok: true });
      const r = await fetch(`${base}/v1/call`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'echo', arguments: { a: 1 } }) });
      assert.deepEqual(await r.json(), { name: 'echo', args: { a: 1 }, session: 'abc', client: 'Claude Desktop' });
      assert.equal((await fetch(`${base}/v1/call`, { method: 'POST', headers: auth, body: '{nope' })).status, 400);
      const ctrl = new AbortController();
      const slow = fetch(`${base}/v1/call`, { method: 'POST', headers: auth, body: JSON.stringify({ name: 'slow' }), signal: ctrl.signal }).catch(() => 'cut');
      await wait(50);
      ctrl.abort();
      assert.equal(await slow, 'cut');
      await wait(50);
      assert.equal(aborted, true);
    },
    {
      meta: () => ({}),
      prompt: () => null,
      call: (name, args, ctx) =>
        name === 'slow'
          ? new Promise((resolve) =>
              ctx.signal.addEventListener('abort', () => {
                aborted = true;
                resolve({});
              }),
            )
          : { name, args, session: ctx.session, client: ctx.client },
    },
  );
});

// ---------------------------------------------------------------- puente stdio
async function withNoa(fn, { mode = 'compact' } = {}) {
  const dir = tmp();
  const { host, log } = fakeHost({ mode });
  const handler = {
    meta: () => host.meta(),
    call: async (name, args, ctx) => ({ ...(await host.call(name, args, ctx)), toolsVersion: host.meta().toolsVersion }),
    prompt: (name, args, ctx) => host.prompt(name, args, ctx),
  };
  const token = newToken();
  const srv = await startServer({ token, handler, logger: { error() {} } });
  const endpoint = path.join(dir, 'endpoint.json');
  fs.writeFileSync(endpoint, JSON.stringify({ port: srv.port, token }));
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(host.meta()));
  try {
    await fn({ host, log, endpoint, dir });
  } finally {
    await srv.close();
  }
}

test('puente: un cliente MCP de verdad (SDK oficial) escucha, contesta y usa herramientas', async () => {
  await withNoa(async ({ host, log, endpoint }) => {
    const transport = new StdioClientTransport({ command: process.execPath, args: [BRIDGE], env: { ...process.env, NOA_MCP_ENDPOINT: endpoint }, stderr: 'pipe' });
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(transport);
    try {
      assert.equal(client.getServerVersion().name, 'noa');
      assert.match(client.getInstructions(), /noa_listen/);
      const { tools } = await client.listTools();
      assert.ok(tools.some((t) => t.name === 'noa_listen'));
      const { prompts } = await client.listPrompts();
      assert.equal(prompts[0].name, 'noa');
      const prompt = await client.getPrompt({ name: 'noa' });
      assert.match(prompt.messages[0].content.text, /Loop/);

      const listening = client.callTool({ name: 'noa_listen', arguments: { timeout_seconds: 10 } });
      await wait(150);
      host.enqueue({ text: 'hola Noa', via: 'text' });
      const heard = await listening;
      assert.match(textOf(heard), /hola Noa/);
      const said = await client.callTool({ name: 'noa_say', arguments: { text: '<emo:happy>¡Hola!' } });
      assert.match(textOf(said), /noa_listen/);
      assert.equal(log.said[0].text, '¡Hola!');
      const ran = await client.callTool({ name: 'noa_run_tool', arguments: { name: 'task_add', input: { title: 'pan' } } });
      assert.match(textOf(ran), /pan/);
    } finally {
      await client.close();
    }
  });
});

// Cliente a pelo: server/discover (MCP 2026-07-28), ping, cancelar y la app cerrada.
function rawBridge(env) {
  const child = spawn(process.execPath, [BRIDGE], { env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
  let buf = '';
  const waiting = new Map();
  const notes = [];
  child.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const msg = JSON.parse(buf.slice(0, i));
      buf = buf.slice(i + 1);
      if (msg.id !== undefined && waiting.has(msg.id)) waiting.get(msg.id)(msg);
      else notes.push(msg);
    }
  });
  let n = 0;
  const send = (method, params, { notify = false } = {}) => {
    if (notify) return child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);
    const id = ++n;
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    return new Promise((resolve) => waiting.set(id, resolve));
  };
  return { child, send, notes, lastId: () => n, close: () => child.stdin.end() };
}

test('puente: server/discover no existe (el cliente vuelve a initialize), ping y cancelar una espera', async () => {
  await withNoa(async ({ host, endpoint }) => {
    const b = rawBridge({ NOA_MCP_ENDPOINT: endpoint });
    try {
      const disc = await b.send('server/discover', {});
      assert.equal(disc.error.code, -32601);
      const init = await b.send('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'claude-ai', version: '0.14' } });
      assert.equal(init.result.protocolVersion, '2025-06-18');
      assert.equal(init.result.capabilities.tools.listChanged, true);
      const newer = await b.send('initialize', { protocolVersion: '2099-01-01', capabilities: {} });
      assert.equal(newer.result.protocolVersion, '2025-11-25');
      b.send('notifications/initialized', {}, { notify: true });
      assert.deepEqual((await b.send('ping', {})).result, {});
      // Espera que Claude cancela: Noa deja de esperar y el puente no contesta esa petición.
      b.send('tools/call', { name: 'noa_listen', arguments: { timeout_seconds: 30 } });
      const id = b.lastId();
      await wait(200);
      assert.equal(host.status().listening, true);
      b.send('notifications/cancelled', { requestId: id }, { notify: true });
      await wait(200);
      assert.equal(host.status().listening, false);
      assert.deepEqual(host.status().clients, ['claude-ai 0.14']);
    } finally {
      b.close();
    }
  });
});

test('puente: con la app cerrada lo dice como error de herramienta y lista desde la caché', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ title: 'Noa · Waifu Desk', tools: [{ name: 'noa_say', inputSchema: { type: 'object' } }] }));
  const b = rawBridge({ NOA_MCP_ENDPOINT: path.join(dir, 'endpoint.json'), NOA_MCP_LAUNCH_WAIT_MS: '300' });
  try {
    await b.send('initialize', { protocolVersion: '2025-11-25', capabilities: {} });
    const list = await b.send('tools/list', {});
    assert.equal(list.result.tools[0].name, 'noa_say');
    const r = await b.send('tools/call', { name: 'noa_say', arguments: { text: 'hola' } });
    assert.equal(r.result.isError, true);
    assert.match(r.result.content[0].text, /closed/);
  } finally {
    b.close();
  }
});

// ---------------------------------------------------------------- claude_desktop_config.json
test('config de Claude: rutas en Windows (normal y Microsoft Store), macOS y Linux', () => {
  const fakeFs = {
    readdirSync: (p) => (p === 'C:\\Users\\m\\AppData\\Local\\Packages' ? ['Claude_pzs8sxrjxfjjc', 'Microsoft.Paint_8wekyb'] : []),
    statSync: (p) => {
      if (p.startsWith('C:\\Users\\m\\AppData\\Local\\Packages\\Claude_pzs8sxrjxfjjc\\LocalCache\\Roaming\\Claude')) return {};
      throw Object.assign(new Error('no'), { code: 'ENOENT' });
    },
  };
  const win = cc.claudeConfigCandidates({ platform: 'win32', env: { APPDATA: 'C:\\Users\\m\\AppData\\Roaming', LOCALAPPDATA: 'C:\\Users\\m\\AppData\\Local' }, home: 'C:\\Users\\m', fsImpl: fakeFs });
  assert.deepEqual(
    win.map((c) => [c.kind, c.path, c.exists]),
    [
      ['standard', 'C:\\Users\\m\\AppData\\Roaming\\Claude\\claude_desktop_config.json', false],
      ['store', 'C:\\Users\\m\\AppData\\Local\\Packages\\Claude_pzs8sxrjxfjjc\\LocalCache\\Roaming\\Claude\\claude_desktop_config.json', true],
    ],
  );
  // Solo la de la Store existe: se instala ahí y no en la normal.
  assert.deepEqual(
    cc.installTargets(win).map((c) => c.kind),
    ['store'],
  );
  assert.deepEqual(
    cc.installTargets(win.map((c) => ({ ...c, exists: false, dirExists: false }))).map((c) => c.kind),
    ['standard'],
  );
  const mac = cc.claudeConfigCandidates({ platform: 'darwin', home: '/Users/m', env: {}, fsImpl: fakeFs });
  assert.equal(mac[0].path, '/Users/m/Library/Application Support/Claude/claude_desktop_config.json');
  const lin = cc.claudeConfigCandidates({ platform: 'linux', home: '/home/m', env: {}, fsImpl: fakeFs });
  assert.equal(lin[0].path, '/home/m/.config/Claude/claude_desktop_config.json');
});

test('config de Claude: añade la entrada sin tocar el resto, guarda copia y detecta si está vieja', () => {
  const dir = tmp();
  const file = path.join(dir, 'Claude', 'claude_desktop_config.json');
  const entry = cc.serverEntry({ command: 'C:\\Apps\\Waifu Desk\\Waifu Desk.exe', bridgePath: 'C:\\data\\noa-mcp-bridge.cjs', endpointPath: 'C:\\data\\endpoint.json' });
  assert.deepEqual(entry.env, { ELECTRON_RUN_AS_NODE: '1', NOA_MCP_ENDPOINT: 'C:\\data\\endpoint.json' });
  assert.equal(cc.entryState(file, entry), 'missing');
  // Sin archivo: se crea.
  assert.deepEqual(cc.installEntry(file, entry), { changed: true });
  assert.equal(cc.entryState(file, entry), 'current');
  assert.deepEqual(cc.installEntry(file, entry), { changed: false });
  // Con otros servidores y ajustes: se conservan, y la primera vez se guarda una copia.
  fs.writeFileSync(file, JSON.stringify({ mcpServers: { aeroforja: { command: 'node', args: ['x.js'] }, noa: { command: 'old.exe', args: ['b'], env: { MY_VAR: '1' } } }, globalShortcut: 'Ctrl+Space' }));
  assert.equal(cc.entryState(file, entry), 'outdated');
  assert.deepEqual(cc.installEntry(file, entry), { changed: true });
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(data.mcpServers.aeroforja, { command: 'node', args: ['x.js'] });
  assert.equal(data.globalShortcut, 'Ctrl+Space');
  assert.equal(data.mcpServers.noa.command, entry.command);
  assert.equal(data.mcpServers.noa.env.MY_VAR, '1');
  assert.ok(fs.existsSync(`${file}.noa-backup`));
  assert.equal(cc.entryState(file, entry), 'current');
  assert.deepEqual(cc.removeEntry(file), { changed: true });
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).mcpServers.aeroforja.command, 'node');
  // JSON roto: no se toca.
  fs.writeFileSync(file, '{ roto');
  assert.equal(cc.entryState(file, entry), 'error');
  assert.throws(() => cc.installEntry(file, entry), /invalid JSON/);
  assert.equal(fs.readFileSync(file, 'utf8'), '{ roto');
  // BOM al principio (lo deja el Bloc de notas): se lee bien.
  fs.writeFileSync(file, '\uFEFF{"mcpServers":{}}');
  assert.equal(cc.entryState(file, entry), 'missing');
});

test('config de Claude: fragmento JSON y comando de Claude Code', () => {
  const entry = cc.serverEntry({ command: 'C:\\Apps\\Waifu Desk\\Waifu Desk.exe', bridgePath: 'C:\\d\\noa-mcp-bridge.cjs', endpointPath: 'C:\\d\\endpoint.json' });
  assert.deepEqual(JSON.parse(cc.snippet(entry)).mcpServers.noa, entry);
  assert.equal(
    cc.claudeCodeCommand(entry),
    'claude mcp add --scope user noa -e ELECTRON_RUN_AS_NODE=1 -e NOA_MCP_ENDPOINT=C:\\d\\endpoint.json -- "C:\\Apps\\Waifu Desk\\Waifu Desk.exe" C:\\d\\noa-mcp-bridge.cjs',
  );
  const node = cc.serverEntry({ command: 'x', bridgePath: '/d/b.cjs', endpointPath: '/d/e.json', useNode: true });
  assert.deepEqual(node, { command: 'node', args: ['/d/b.cjs'], env: { NOA_MCP_ENDPOINT: '/d/e.json' } });
});
