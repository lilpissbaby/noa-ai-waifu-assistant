process.env.TZ = 'Europe/Madrid';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { serve } from './helpers/http.mjs';
import { setSecret, userDir as userDirForTests } from '../src/main/config.js';
import { geocode, forecast, summarize, sky } from '../src/main/productivity/weather.js';
import { latestNews } from '../src/main/productivity/feeds.js';
import { Monitors, checkUrl, normalizeMonitor } from '../src/main/productivity/monitors.js';
import { CiWatcher } from '../src/main/productivity/ci-watch.js';
import { sendPush, shouldForward } from '../src/main/productivity/push.js';
import { UsageLog, normalizeUsage, estimateCost } from '../src/main/productivity/usage.js';
import { BreakCoach, Presence, ClipHistory } from '../src/main/productivity/activity.js';
import { cpuPercent, formatUptime, systemStatus } from '../src/main/productivity/system.js';
import { model3Files, safeRel, downloadLive2d } from '../src/main/gallery.js';
import { caseVariants } from '../src/shared/live2d-files.js';
import { GALLERY, galleryItem } from '../src/shared/gallery.js';
import { MCP_CATALOG, serverFromCatalog } from '../src/shared/mcp-catalog.js';
import { githubTools, checkRepo } from '../src/main/tools/github.js';
import { homeAssistantTools } from '../src/main/tools/homeassistant.js';
import { phoneTools } from '../src/main/tools/phone.js';
import { weatherTools, newsTools, clipboardHistoryTools, monitorTools, systemTools } from '../src/main/tools/info.js';
import { fileTools } from '../src/main/tools/files.js';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'wd-conn-'));
const json = (res, data, status = 200) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(data));

test('tiempo: geocodificar, previsión y resumen', async () => {
  const srv = await serve((req, res) => {
    if (req.url.startsWith('/geo')) return json(res, { results: [{ name: 'Valencia', admin1: 'Carabobo', country: 'Venezuela', country_code: 'VE', latitude: 10.1, longitude: -68 }, { name: 'Valencia', admin1: 'Comunidad Valenciana', country: 'España', country_code: 'ES', latitude: 39.47, longitude: -0.38, timezone: 'Europe/Madrid' }] });
    json(res, {
      latitude: 39.47,
      longitude: -0.38,
      timezone: 'Europe/Madrid',
      current: { time: '2026-10-30T12:00', temperature_2m: 21.4, apparent_temperature: 20.9, relative_humidity_2m: 60, precipitation: 0, weather_code: 2, wind_speed_10m: 11, is_day: 1 },
      current_units: { temperature_2m: '°C', apparent_temperature: '°C', relative_humidity_2m: '%', precipitation: 'mm', wind_speed_10m: 'km/h' },
      daily: { time: ['2026-10-30'], weather_code: [61], temperature_2m_max: [23], temperature_2m_min: [15], precipitation_probability_max: [70], precipitation_sum: [3.2], sunrise: ['2026-10-30T07:55'], sunset: ['2026-10-30T18:20'], uv_index_max: [3] },
      daily_units: { temperature_2m_max: '°C', temperature_2m_min: '°C', precipitation_sum: 'mm' },
    });
  });
  try {
    const place = await geocode('Valencia, ES', { baseUrl: `${srv.url}/geo` });
    assert.equal(place.lat, 39.47);
    assert.match(place.label, /España/);
    const raw = await forecast(place, { baseUrl: `${srv.url}/fc`, units: 'imperial', days: 9 });
    const q = new URL(srv.requests.at(-1).url, srv.url).searchParams;
    assert.equal(q.get('temperature_unit'), 'fahrenheit');
    assert.equal(q.get('forecast_days'), '7');
    const s = summarize(raw, place.label);
    assert.equal(s.now.sky, 'partly cloudy');
    assert.equal(s.now.temperature, '21.4 °C');
    assert.equal(s.days[0].sky, 'rain');
    assert.equal(s.days[0].rainChance, '70%');
    assert.equal(s.days[0].sunset, '18:20');
    assert.equal(sky(95), 'thunderstorm');
    // La herramienta sin ciudad configurada pide una.
    const [tool] = weatherTools({ productivity: { weather: {} } });
    await assert.rejects(tool.run({}), /No city/);
  } finally {
    await srv.close();
  }
});

test('noticias: varias fuentes mezcladas por fecha y errores aparte', async () => {
  const srv = await serve((req, res) => {
    if (req.url === '/a') return res.writeHead(200, { 'content-type': 'application/rss+xml' }).end('<rss><channel><title>A</title><item><title>Viejo</title><link>https://a/1</link><pubDate>Wed, 28 Oct 2026 10:00:00 GMT</pubDate></item><item><title>Nuevo sobre Postgres</title><link>https://a/2</link><pubDate>Fri, 30 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>');
    if (req.url === '/b') return res.writeHead(200).end('<feed xmlns="http://www.w3.org/2005/Atom"><title>B</title><entry><title>Medio</title><link href="https://b/1"/><updated>2026-10-29T10:00:00Z</updated></entry></feed>');
    res.writeHead(404).end();
  });
  try {
    const feeds = [
      { name: 'A', url: `${srv.url}/a` },
      { name: 'B', url: `${srv.url}/b` },
      { name: 'Rota', url: `${srv.url}/x` },
    ];
    const r = await latestNews(feeds, { limit: 5 });
    assert.deepEqual(
      r.items.map((i) => i.title),
      ['Nuevo sobre Postgres', 'Medio', 'Viejo'],
    );
    assert.equal(r.items[1].source, 'B');
    assert.match(r.errors[0], /Rota: HTTP 404/);
    assert.equal((await latestNews(feeds, { query: 'postgres' })).items.length, 1);
    const [tool] = newsTools({ productivity: { feeds } });
    await assert.rejects(tool.run({ feed: 'nada' }), /No feed/);
    assert.deepEqual(newsTools({ productivity: { feeds: [] } }), []);
  } finally {
    await srv.close();
  }
});

test('monitor de servicios: dos fallos para avisar de caída y aviso al volver', async () => {
  let up = true;
  const srv = await serve((req, res) => res.writeHead(up ? 200 : 503).end(up ? 'all good' : 'down'));
  try {
    const m = normalizeMonitor({ name: 'VPS', url: `${srv.url}/health`, keyword: 'good' }, 'm1');
    assert.throws(() => normalizeMonitor({ url: 'ftp://x' }), /http/);
    assert.equal((await checkUrl(m)).up, true);
    assert.equal((await checkUrl({ ...m, keyword: 'nope' })).error, '"nope" not found');
    const events = [];
    const mon = new Monitors({ file: path.join(tmpDir(), 'm.json'), list: () => [m], onChange: (x, to) => events.push(to) });
    await mon.runOnce();
    up = false;
    await mon.runOnce();
    assert.deepEqual(events, []); // un fallo suelto no avisa
    assert.equal(mon.states()[0].up, true);
    await mon.runOnce();
    assert.deepEqual(events, ['down']);
    assert.equal(mon.states()[0].up, false);
    up = true;
    await mon.runOnce();
    assert.deepEqual(events, ['down', 'up']);
    const [tool] = monitorTools({ productivity: { monitors: { list: [m] } } }, { monitors: mon });
    assert.equal((await tool.run({}))[0].up, true);
    // Sin respuesta: error de red, caído desde el principio y sin aviso.
    const dead = new Monitors({ file: path.join(tmpDir(), 'd.json'), list: () => [{ ...m, url: 'http://127.0.0.1:9/' }], onChange: () => events.push('x') });
    await dead.runOnce();
    assert.equal(dead.states()[0].up, false);
    assert.equal(events.length, 2);
  } finally {
    await srv.close();
  }
});

test('vigilante de CI: aprende primero, luego avisa de fallos y de arreglos', async () => {
  let runs = [{ id: 1, name: 'CI', head_branch: 'main', status: 'completed', conclusion: 'success' }];
  const events = [];
  const w = new CiWatcher({ file: path.join(tmpDir(), 'ci.json'), repos: () => ['o/r'], latestRuns: async () => runs, onFinish: (repo, run, kind) => events.push(`${repo}:${run.id}:${kind}`) });
  await w.poll();
  assert.deepEqual(events, []);
  runs = [...runs, { id: 2, name: 'CI', head_branch: 'main', status: 'completed', conclusion: 'failure' }, { id: 3, name: 'CI', head_branch: 'main', status: 'in_progress', conclusion: null }];
  await w.poll();
  assert.deepEqual(events, ['o/r:2:failed']);
  await w.poll();
  assert.equal(events.length, 1); // no repite
  runs = [...runs.slice(0, 2), { id: 3, name: 'CI', head_branch: 'main', status: 'completed', conclusion: 'success' }];
  await w.poll();
  assert.deepEqual(events, ['o/r:2:failed', 'o/r:3:fixed']);
});

test('avisos al móvil: ntfy, Telegram y Gotify', async () => {
  const srv = await serve((req, res) => json(res, { ok: true }));
  try {
    await sendPush({ provider: 'ntfy', server: srv.url, topic: 'noa-test' }, 'tk', { title: 'Noa', message: 'Hola ñ', priority: 'high' });
    const r = srv.requests.at(-1);
    assert.equal(r.url, '/');
    assert.equal(r.headers.authorization, 'Bearer tk');
    assert.deepEqual([r.body.topic, r.body.message, r.body.title, r.body.priority], ['noa-test', 'Hola ñ', 'Noa', 4]);
    await sendPush({ provider: 'gotify', server: `${srv.url}/` }, 'app', { message: 'x' });
    assert.equal(srv.requests.at(-1).url, '/message');
    assert.equal(srv.requests.at(-1).headers['x-gotify-key'], 'app');
    let tgUrl = '';
    await sendPush({ provider: 'telegram', chatId: '42' }, 'bot:1', { title: 'T', message: 'M' }, { fetchImpl: async (url, init) => ((tgUrl = url), new Response(init.body)) });
    assert.equal(tgUrl, 'https://api.telegram.org/botbot:1/sendMessage');
    await assert.rejects(sendPush({ provider: 'none' }, '', { message: 'x' }), /not configured/);
    await assert.rejects(sendPush({ provider: 'ntfy' }, '', { message: 'x' }), /topic/);
    assert.equal(shouldForward('important', 'reminder'), true);
    assert.equal(shouldForward('important', 'briefing'), false);
    assert.equal(shouldForward('all', 'briefing'), true);
    assert.equal(shouldForward('off', 'reminder'), false);
    assert.deepEqual(phoneTools({ connectors: { push: { provider: 'none' } } }), []);
    const [tool] = phoneTools({ connectors: { push: { provider: 'ntfy', server: srv.url, topic: 't' } } });
    assert.match(await tool.run({ message: 'Lista: pan' }), /ntfy/);
  } finally {
    await srv.close();
  }
});

test('uso de tokens: Anthropic y OpenAI, periodos y coste', () => {
  assert.deepEqual(normalizeUsage({ input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 900, cache_creation_input_tokens: 0 }), { input: 1000, output: 50, cacheRead: 900, requests: 1 });
  assert.deepEqual(normalizeUsage({ prompt_tokens: 300, completion_tokens: 20, prompt_tokens_details: { cached_tokens: 100 } }), { input: 300, output: 20, cacheRead: 100, requests: 1 });
  assert.equal(normalizeUsage({}).requests, 0);
  let now = new Date(2026, 9, 30, 12);
  const log = new UsageLog({ file: path.join(tmpDir(), 'u.json'), now: () => now });
  log.record('claude', 'claude-sonnet-5-5', { input_tokens: 1000, output_tokens: 500 });
  now = new Date(2026, 9, 1, 12);
  log.record('claude', 'claude-sonnet-5-5', { input_tokens: 2000, output_tokens: 0 });
  now = new Date(2026, 9, 30, 13);
  log.flush();
  const [row] = log.summary([{ id: 'claude', name: 'Claude Sonnet', priceIn: 3, priceOut: 15 }]);
  assert.equal(row.name, 'Claude Sonnet');
  assert.deepEqual([row.today.input, row.week.input, row.month.input], [1000, 1000, 3000]);
  assert.equal(row.cost.today, (1000 * 3 + 500 * 15) / 1e6);
  assert.equal(estimateCost({ input: 1e6, output: 0, cacheRead: 1e6 }, { priceIn: 3, priceOut: 15, priceCache: 0.3 }), 0.3);
  assert.equal(estimateCost({ input: 1, output: 1, cacheRead: 0 }, {}), null);
  assert.equal(new UsageLog({ file: log.file, now: () => now }).summary().length, 1);
});

test('pausas, modo mascota e historial del portapapeles', () => {
  const breaks = [];
  let paused = false;
  const coach = new BreakCoach({ settings: () => ({ enabled: true, every: 30, idleResetMin: 5 }), onBreak: (tip, min) => breaks.push([tip, min]), paused: () => paused });
  for (let i = 0; i < 29; i++) coach.tick(0);
  assert.deepEqual(breaks, []);
  coach.tick(0);
  assert.deepEqual(breaks, [[0, 30]]);
  for (let i = 0; i < 20; i++) coach.tick(0);
  coach.tick(400); // te fuiste: se reinicia
  for (let i = 0; i < 20; i++) coach.tick(0);
  assert.equal(breaks.length, 1);
  paused = true;
  for (let i = 0; i < 40; i++) coach.tick(0);
  assert.equal(breaks.length, 1);

  const log = [];
  const p = new Presence({ settings: () => ({ sleep: true, sleepAfterMin: 10, welcomeBack: true }), onSleep: (on) => log.push(on ? 'sleep' : 'wake'), onWelcome: (m) => log.push(`hi:${m}`) });
  assert.equal(p.tick(300), null);
  assert.equal(p.tick(600, { busy: true }), null); // pensando o hablando no se duerme
  assert.equal(p.tick(600), 'sleep');
  p.tick(1500);
  assert.equal(p.tick(10), 'wake');
  assert.deepEqual(log, ['sleep', 'wake', 'hi:25']);
  p.tick(700);
  p.wake();
  assert.deepEqual(log.slice(-2), ['sleep', 'wake']);

  const clip = new ClipHistory({ max: 3 });
  assert.equal(clip.push('a'), true);
  assert.equal(clip.push('a'), false);
  clip.push('b');
  clip.push('c');
  clip.push('a'); // vuelve arriba sin duplicarse
  clip.push('d');
  assert.deepEqual(
    clip.list().map((x) => x.text),
    ['d', 'a', 'c'],
  );
  assert.equal(clip.push('   '), false);
  assert.deepEqual(
    clip.list({ query: 'A' }).map((x) => x.text),
    ['a'],
  );
  assert.deepEqual(clipboardHistoryTools({ productivity: { clipboardHistory: { enabled: false } } }, { clipHistory: clip }), []);
  assert.equal(clipboardHistoryTools({ productivity: { clipboardHistory: { enabled: true } } }, { clipHistory: clip }).length, 1);
});

test('estado del PC', async () => {
  const a = [{ times: { user: 100, nice: 0, sys: 100, idle: 800, irq: 0 } }];
  const b = [{ times: { user: 150, nice: 0, sys: 150, idle: 900, irq: 0 } }];
  assert.equal(cpuPercent(a, b), 50);
  assert.equal(formatUptime(90061), '1d 1h 1m');
  const s = await systemStatus({ sampleMs: 50, onBattery: false });
  assert.ok(s.cpu.cores > 0);
  assert.ok(s.memory.totalGB > 0);
  assert.equal(s.power, 'plugged in');
  assert.equal(systemTools().length, 1);
});

test('galería: catálogo coherente y descarga de un modelo Live2D por partes', async () => {
  const ids = new Set();
  for (const g of GALLERY) {
    assert.ok(!ids.has(g.id), `id repetido ${g.id}`);
    ids.add(g.id);
    assert.ok(['vrm', 'live2d'].includes(g.kind));
    assert.match(g.kind === 'vrm' ? g.url : g.model, /^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[0-9a-fv.]+\//);
    assert.ok(fs.existsSync(path.join(import.meta.dirname, '..', 'assets', 'gallery', `${g.id}.jpg`)), `falta la miniatura de ${g.id}`);
  }
  assert.equal(galleryItem('alicia-solid').kind, 'vrm');

  assert.deepEqual(
    model3Files({ FileReferences: { Moc: 'm.moc3', Textures: ['t/0.png'], Physics: 'p.json', Motions: { Idle: [{ File: 'mo/a.json', Sound: 's/a.wav' }, { File: 'mo/a.json' }] }, Expressions: [{ Name: 'F1', File: 'e/f1.json' }] } }).map((x) => `${x.file}${x.required ? '!' : ''}`),
    ['m.moc3!', 't/0.png!', 'p.json', 'mo/a.json', 's/a.wav', 'e/f1.json'],
  );
  assert.deepEqual(caseVariants('motions/hiyori_m01.json'), ['motions/Hiyori_m01.json']);
  assert.throws(() => safeRel('../x'), /Unsafe/);
  assert.throws(() => safeRel('/etc/passwd'), /Unsafe/);
  assert.deepEqual(safeRel('a/b c.png'), ['a', 'b c.png']);

  // El model3.json nombra «idle» en minúscula pero el archivo es «Idle» (modelo hecho en Windows), y
  // una expresión no está: se corrige la ruta y se quita la expresión.
  const files = {
    'Chica.model3.json': JSON.stringify({ Version: 3, FileReferences: { Moc: 'Chica.moc3', Textures: ['Chica.1024/texture 00.png'], Motions: { Idle: [{ File: 'motions/idle.motion3.json' }] }, Expressions: [{ Name: 'F1', File: 'exp/f1.exp3.json' }] } }),
    'Chica.moc3': 'MOC3\u0003',
    'Chica.1024/texture 00.png': 'png',
    'motions/Idle.motion3.json': '{}',
  };
  const srv = await serve((req, res) => {
    const rel = decodeURIComponent(req.url.replace(/^\/m\//, ''));
    if (files[rel] == null) return res.writeHead(404).end();
    res.writeHead(200).end(files[rel]);
  });
  try {
    const progress = [];
    const r = await downloadLive2d(`${srv.url}/m/Chica.model3.json`, { onProgress: (p) => progress.push(p) });
    assert.deepEqual(r.models, ['Chica.model3.json']);
    assert.equal(progress.at(-1), 1);
    assert.equal(srv.requests.filter((x) => x.url.includes('texture%2000.png')).length, 1);
    const saved = JSON.parse(fs.readFileSync(path.join(userDirForTests(), 'tmp', 'live2d', r.tmpId, 'Chica.model3.json'), 'utf8'));
    assert.equal(saved.FileReferences.Motions.Idle[0].File, 'motions/Idle.motion3.json');
    assert.deepEqual(saved.FileReferences.Expressions, []);
    delete files['Chica.moc3'];
    await assert.rejects(downloadLive2d(`${srv.url}/m/Chica.model3.json`), /404/);
  } finally {
    await srv.close();
  }
});

test('catálogo MCP: entradas válidas y servidor listo para guardar', () => {
  const ids = new Set(MCP_CATALOG.map((x) => x.id));
  assert.equal(ids.size, MCP_CATALOG.length);
  for (const x of MCP_CATALOG) {
    assert.ok(['stdio', 'http'].includes(x.type));
    assert.ok(['node', 'uv', 'remote'].includes(x.needs));
    assert.match(x.docs, /^https:\/\//);
  }
  const fsSrv = serverFromCatalog(MCP_CATALOG.find((x) => x.id === 'filesystem'), { id: 'a', folder: 'C:\\Users\\Mi Usuario\\Docs' });
  assert.equal(fsSrv.args, '-y @modelcontextprotocol/server-filesystem "C:\\Users\\Mi Usuario\\Docs"');
  assert.equal(fsSrv.enabled, false);
  const ha = serverFromCatalog(MCP_CATALOG.find((x) => x.id === 'homeassistant'), { id: 'b', haUrl: 'http://ha.lan:8123/' });
  assert.equal(ha.url, 'http://ha.lan:8123/api/mcp');
  assert.equal(ha.type, 'http');
});

test('GitHub y Home Assistant contra servidores simulados', async () => {
  const srv = await serve((req, res) => {
    if (req.url === '/notifications?per_page=30') return json(res, [{ repository: { full_name: 'o/r' }, subject: { type: 'PullRequest', title: 'Arreglar CI' }, reason: 'review_requested', unread: true }]);
    if (req.url.startsWith('/repos/o/r/actions/runs')) return json(res, { workflow_runs: [{ name: 'CI', display_title: 'fix', run_number: 7, head_branch: 'main', status: 'completed', conclusion: 'failure', html_url: 'https://x' }] });
    if (req.url === '/repos/o/r/issues' && req.method === 'POST') return json(res, { number: 12, html_url: 'https://github.com/o/r/issues/12' }, 201);
    if (req.url === '/api/states') return json(res, [{ entity_id: 'light.salon', state: 'on', attributes: { friendly_name: 'Salón', brightness: 128 } }, { entity_id: 'sensor.temp', state: '21.5', attributes: { friendly_name: 'Temperatura', unit_of_measurement: '°C' } }]);
    if (req.url === '/api/services/light/turn_off') return json(res, [{ entity_id: 'light.salon', state: 'off', attributes: {} }]);
    res.writeHead(404).end('{}');
  });
  try {
    setSecret('github', 'ghp_test');
    const gh = githubTools({ connectors: { github: { enabled: true, apiUrl: srv.url, watchRepos: ['o/r'] } } });
    const by = (name) => gh.find((x) => x.name === name);
    assert.equal((await by('github_notifications').run({}))[0].title, 'Arreglar CI');
    assert.equal(srv.requests.at(-1).headers.authorization, 'Bearer ghp_test');
    assert.equal((await by('github_ci').run({ repo: 'https://github.com/o/r' }))[0].conclusion, 'failure');
    assert.ok(by('github_create_issue').confirm({ repo: 'o/r', title: 'x' }).message);
    assert.equal((await by('github_create_issue').run({ repo: 'o/r', title: 'Bug', labels: ['bug'] })).number, 12);
    assert.deepEqual(srv.requests.at(-1).body, { title: 'Bug', body: '', labels: ['bug'] });
    assert.throws(() => checkRepo('nada'), /owner\/name/);
    assert.deepEqual(githubTools({ connectors: { github: { enabled: false } } }), []);

    setSecret('homeassistant', 'ha_token');
    const ha = homeAssistantTools({ connectors: { homeassistant: { enabled: true, baseUrl: `${srv.url}/api` } } });
    const states = await ha[0].run({ domain: 'light' });
    assert.deepEqual(states.entities, [{ entity: 'light.salon', name: 'Salón', state: 'on', brightness: '50%' }]);
    assert.equal((await ha[0].run({ search: 'temp' })).entities[0].unit, '°C');
    const call = ha[1];
    assert.ok(call.confirm({ domain: 'light', service: 'turn_off', entity_id: 'light.salon' }).message.includes('light.turn_off'));
    const r = await call.run({ domain: 'light', service: 'turn_off', entity_id: 'light.salon' });
    assert.equal(r.changed[0].state, 'off');
    assert.deepEqual(srv.requests.at(-1).body, { entity_id: 'light.salon' });
    assert.equal(srv.requests.at(-1).headers.authorization, 'Bearer ha_token');
    await assert.rejects(call.run({ domain: 'light; rm', service: 'x' }), /Invalid/);
  } finally {
    setSecret('github', '');
    setSecret('homeassistant', '');
    await srv.close();
  }
});

test('files_open no abre programas ni scripts', async () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, 'nota.txt'), 'hola');
  fs.writeFileSync(path.join(dir, 'virus.exe'), 'MZ');
  const open = fileTools({ productivity: { folders: [dir] } }).find((x) => x.name === 'files_open');
  assert.ok(open.confirm({ path: 'nota.txt' }).message.includes('nota.txt'));
  assert.match(await open.run({ path: 'nota.txt' }), /Opened/);
  await assert.rejects(open.run({ path: 'virus.exe' }), /program or script/);
  await assert.rejects(open.run({ path: '../fuera.txt' }));
});
