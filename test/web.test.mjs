import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchReadable, searchWeb } from '../src/main/productivity/web.js';
import { webTools } from '../src/main/tools/web.js';
import { serve, json } from './helpers/http.mjs';
import { makePdf } from './helpers/pdf.mjs';

const ARTICLE = `<!doctype html><html><head><title>Guía de Live2D | Blog</title><script>window.evil = 1; document.write('MALO')</script></head>
<body><nav><a href="/">Inicio</a> <a href="/blog">Blog</a> Menú de navegación con muchos enlaces</nav>
<article><h1>Guía de Live2D</h1>
<p>Live2D permite animar ilustraciones en 2D con física de pelo y ropa. Es la base de muchos VTubers y funciona muy bien en tiempo real.</p>
<p>Los modelos se componen de un archivo model3.json, texturas y movimientos. VTube Studio añade un archivo .vtube.json con la configuración de los parámetros.</p>
<p>Para empezar basta con descargar un modelo de ejemplo y cargarlo en el visor oficial o en cualquier aplicación compatible.</p>
<script>console.log('dentro')</script></article>
<footer>© 2026 Pie de página</footer></body></html>`;

test('fetchReadable: el texto del artículo, con título y sin scripts ni menús', async () => {
  const srv = await serve((req, res) => res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(ARTICLE));
  try {
    const r = await fetchReadable(`${srv.url}/post`);
    assert.equal(r.url, `${srv.url}/post`);
    assert.match(r.title, /Guía de Live2D/);
    assert.match(r.text, /física de pelo y ropa/);
    assert.match(r.text, /vtube\.json/);
    assert.doesNotMatch(r.text, /MALO|evil|console\.log|Menú de navegación/);
    assert.equal(r.truncated, false);
    const short = await fetchReadable(`${srv.url}/post`, { maxChars: 50 });
    assert.equal(short.text.length, 50);
    assert.equal(short.truncated, true);
  } finally {
    await srv.close();
  }
});

test('fetchReadable: solo http(s) y con límite de tamaño', async () => {
  await assert.rejects(fetchReadable('file:///etc/passwd'), /http/);
  await assert.rejects(fetchReadable('javascript:alert(1)'), /http/);
  const big = Buffer.alloc(11 * 1024 * 1024, 97);
  const srv = await serve((req, res) => res.writeHead(200, { 'content-type': 'text/plain' }).end(big));
  try {
    await assert.rejects(fetchReadable(`${srv.url}/big`), (e) => e.code === 'tooBig');
  } finally {
    await srv.close();
  }
});

test('fetchReadable: PDF por content-type y texto plano', async () => {
  const srv = await serve((req, res) =>
    req.url === '/doc' ? res.writeHead(200, { 'content-type': 'application/pdf' }).end(makePdf('Memoria anual 2026')) : res.writeHead(200, { 'content-type': 'text/plain' }).end('solo texto'),
  );
  try {
    assert.match((await fetchReadable(`${srv.url}/doc`)).text, /Memoria anual 2026/);
    assert.equal((await fetchReadable(`${srv.url}/txt`)).text, 'solo texto');
  } finally {
    await srv.close();
  }
});

test('searchWeb: SearXNG, Brave y Tavily', async () => {
  const srv = await serve((req, res) => {
    if (req.url.startsWith('/searx/search')) return json(res, { results: [{ title: 'Uno', url: 'https://a.example', content: 'Resumen A' }, { title: 'Dos', url: 'https://b.example', content: 'Resumen B' }] });
    if (req.url.startsWith('/brave'))
      return req.headers['x-subscription-token'] === 'BRAVE' ? json(res, { web: { results: [{ title: 'Bravo', url: 'https://brave.example', description: '<strong>Hola</strong> mundo' }] } }) : json(res, {}, 401);
    if (req.url === '/tavily/search' && req.method === 'POST') return json(res, { results: [{ title: 'Tav', url: 'https://t.example', content: 'Texto T' }], echo: req.body });
    return json(res, {}, 404);
  });
  try {
    const sx = await searchWeb({ provider: 'searxng', baseUrl: `${srv.url}/searx` }, '', 'live2d', 1);
    assert.deepEqual(sx, [{ title: 'Uno', url: 'https://a.example', snippet: 'Resumen A' }]);
    assert.match(srv.requests[0].url, /format=json/);
    assert.match(srv.requests[0].url, /q=live2d/);
    const br = await searchWeb({ provider: 'brave', baseUrl: `${srv.url}/brave` }, 'BRAVE', 'hola');
    assert.deepEqual(br, [{ title: 'Bravo', url: 'https://brave.example', snippet: 'Hola mundo' }]);
    const tv = await searchWeb({ provider: 'tavily', baseUrl: `${srv.url}/tavily` }, 'TVLY', 'q');
    assert.deepEqual(tv, [{ title: 'Tav', url: 'https://t.example', snippet: 'Texto T' }]);
    const tavReq = srv.requests.find((r) => r.url === '/tavily/search');
    assert.equal(tavReq.body.api_key, 'TVLY');
    assert.equal(tavReq.body.query, 'q');
    await assert.rejects(searchWeb({ provider: 'brave', baseUrl: `${srv.url}/brave` }, 'MAL', 'x'), /401/);
  } finally {
    await srv.close();
  }
});

test('web_search solo existe con un buscador configurado', () => {
  assert.deepEqual(
    webTools({ productivity: { search: { provider: 'none' } } }, {}).map((t) => t.name),
    ['web_fetch'],
  );
  assert.deepEqual(
    webTools({ productivity: { search: { provider: 'searxng', baseUrl: 'http://x' } } }, {}).map((t) => t.name),
    ['web_fetch', 'web_search'],
  );
});

test('isPrivateHost y permiso para leer la red local', async () => {
  const { isPrivateHost } = await import('../src/main/productivity/web.js');
  for (const h of ['localhost', 'nas.local', 'router', '192.168.1.1', '10.0.0.5', '172.20.1.1', '127.0.0.1', '169.254.169.254', '[::1]', 'fe80::1', 'fd12::3', 'app.localhost']) assert.equal(isPrivateHost(h), true, h);
  // IPv4 dentro de IPv6: la URL las normaliza a hexadecimal ([::ffff:127.0.0.1] → [::ffff:7f00:1]).
  for (const u of ['http://[::ffff:127.0.0.1]/', 'http://[::ffff:192.168.1.1]/', 'http://[::ffff:10.0.0.5]/', 'http://[::ffff:169.254.169.254]/', 'http://[::ffff:172.16.0.1]/', 'http://[::127.0.0.1]/'])
    assert.equal(isPrivateHost(new URL(u).hostname), true, u);
  assert.equal(isPrivateHost(new URL('http://[::ffff:8.8.8.8]/').hostname), false);
  for (const h of ['example.com', '8.8.8.8', '172.32.0.1', '2001:db8::1', '[2606:4700::1111]', 'tenebrum.online']) assert.equal(isPrivateHost(h), false, h);
  const [fetchTool] = webTools({ productivity: {} }, {});
  assert.ok(fetchTool.confirm({ url: 'http://192.168.1.1/admin' }));
  assert.equal(fetchTool.confirm({ url: 'https://example.com' }), null);
});
