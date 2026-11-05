// Servidor local (solo 127.0.0.1) al que habla el puente MCP de Claude Desktop. No es MCP: es una
// API JSON mínima con token; el MCP de verdad lo habla bridge.cjs por stdio con Claude Desktop.
// Sin Electron (http de Node), para poder probarlo con node --test.
import http from 'node:http';
import crypto from 'node:crypto';

const MAX_BODY = 4 * 1024 * 1024;
const LOCAL_HOST = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i;

export const newToken = () => crypto.randomBytes(24).toString('base64url');

function sameToken(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

function send(res, status, body) {
  if (res.writableEnded || res.destroyed) return;
  const data = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(data) });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Body too large'), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(text ? JSON.parse(text) : {});
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

/**
 * handler: { call(name, args, ctx), meta(ctx), prompt(name, args, ctx) }
 * Devuelve { port, close() }. port 0 = uno libre cualquiera.
 */
export function startServer({ host = '127.0.0.1', port = 0, token, handler, logger = console }) {
  if (!token) throw new Error('token required');
  const server = http.createServer(async (req, res) => {
    // Nada de navegadores (Origin) ni nombres que no sean locales (DNS rebinding).
    if (req.headers.origin || !LOCAL_HOST.test(String(req.headers.host || ''))) return send(res, 403, { error: 'forbidden' });
    const auth = String(req.headers.authorization || '');
    if (!sameToken(auth.replace(/^Bearer\s+/i, ''), token)) return send(res, 401, { error: 'unauthorized' });
    const url = new URL(req.url, 'http://local');
    const ctrl = new AbortController();
    // Si el puente cuelga (Claude canceló la llamada), se deja de esperar.
    res.on('close', () => {
      if (!res.writableEnded) ctrl.abort();
    });
    let client = '';
    try {
      client = decodeURIComponent(String(req.headers['x-noa-client'] || '')).slice(0, 120);
    } catch {
      /* cabecera rara */
    }
    const ctx = { session: String(req.headers['x-noa-session'] || 'default').slice(0, 64), client, signal: ctrl.signal };
    try {
      if (req.method === 'GET' && url.pathname === '/v1/health') return send(res, 200, { ok: true });
      if (req.method === 'GET' && url.pathname === '/v1/meta') return send(res, 200, await handler.meta(ctx));
      if (req.method === 'POST' && url.pathname === '/v1/call') {
        const body = await readBody(req);
        const out = await handler.call(String(body.name || ''), body.arguments || {}, ctx);
        return send(res, 200, out);
      }
      if (req.method === 'POST' && url.pathname === '/v1/prompt') {
        const body = await readBody(req);
        const out = await handler.prompt(String(body.name || ''), body.arguments || {}, ctx);
        return out ? send(res, 200, out) : send(res, 404, { error: 'unknown prompt' });
      }
      return send(res, 404, { error: 'not found' });
    } catch (e) {
      if (!e.status) logger.error?.('MCP local', e);
      return send(res, e.status || 500, { error: String(e.message || e) });
    }
  });
  // Las esperas de noa_listen duran minutos: sin cortes por inactividad.
  server.requestTimeout = 0;
  server.headersTimeout = 30_000;
  server.keepAliveTimeout = 5_000;
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      const addr = server.address();
      resolve({
        port: addr.port,
        close: () =>
          new Promise((done) => {
            server.closeAllConnections?.();
            server.close(() => done());
          }),
      });
    });
  });
}
