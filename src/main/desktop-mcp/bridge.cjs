#!/usr/bin/env node
// Puente MCP por stdio entre Claude Desktop (o Claude Code) y Waifu Desk.
//
// Claude Desktop lo arranca con el propio ejecutable de la app en modo Node
// (ELECTRON_RUN_AS_NODE=1) o con `node`. Habla MCP (JSON-RPC por líneas) con Claude y reenvía
// cada llamada a la app por HTTP local (127.0.0.1 + token, ver server.js). Sin dependencias: la
// app copia este archivo a su carpeta de datos y lo mantiene al día en cada arranque.
//
// Archivos junto a NOA_MCP_ENDPOINT (los escribe la app):
//   endpoint.json  { port, token, pid }  mientras la app está abierta
//   meta.json      herramientas, prompts e instrucciones (para cuando la app está cerrada)
//   launch.json    { command, args } para abrir la app si Claude la necesita y está cerrada
'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const ENDPOINT = process.env.NOA_MCP_ENDPOINT || path.join(__dirname, 'endpoint.json');
const DIR = path.dirname(ENDPOINT);
const META = path.join(DIR, 'meta.json');
const LAUNCH = path.join(DIR, 'launch.json');
const SESSION = crypto.randomBytes(6).toString('hex');
const SUPPORTED = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const LAUNCH_WAIT_MS = Number(process.env.NOA_MCP_LAUNCH_WAIT_MS) || 25_000;
const LISTEN_MAX_MS = 230_000; // Claude Desktop corta cada llamada a los 240 s
const FALLBACK_INSTRUCTIONS =
  'Noa is an anime assistant floating on the user\'s desktop (Waifu Desk). When the user asks for "Noa mode" / "modo Noa": call noa_context once, then loop noa_listen → work → noa_say → noa_listen until told to stop.';

let clientName = '';
let servedToolsVersion = null;
const inflight = new Map(); // id de la petición -> AbortController

const log = (...a) => process.stderr.write(`[noa-mcp] ${a.join(' ')}\n`);
const write = (msg) => process.stdout.write(`${JSON.stringify(msg)}\n`);
const reply = (id, result) => write({ jsonrpc: '2.0', id, result });
const error = (id, code, message) => write({ jsonrpc: '2.0', id, error: { code, message } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function request(ep, method, pathname, body, { signal, timeoutMs } = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const req = http.request(
      {
        host: '127.0.0.1',
        port: ep.port,
        path: pathname,
        method,
        signal,
        headers: {
          authorization: `Bearer ${ep.token}`,
          'x-noa-session': SESSION,
          'x-noa-client': encodeURIComponent(clientName),
          ...(data ? { 'content-type': 'application/json', 'content-length': data.length } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            /* no es JSON */
          }
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(json);
          else reject(Object.assign(new Error(json?.error || `HTTP ${res.statusCode}`), { status: res.statusCode }));
        });
        res.on('error', reject);
      },
    );
    if (timeoutMs) req.setTimeout(timeoutMs, () => req.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })));
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const closedError = () => Object.assign(new Error('Waifu Desk is not open'), { code: 'NOA_CLOSED' });
const gone = (e) => ['ECONNREFUSED', 'ECONNRESET', 'EPIPE', 'NOA_CLOSED'].includes(e?.code);

// Abre la app (si sabemos cómo) y espera a que su servidor responda.
let launching = null;
function launchNoa() {
  if (launching) return launching;
  launching = (async () => {
    const spec = readJson(LAUNCH);
    if (spec?.command) {
      const env = { ...process.env };
      delete env.ELECTRON_RUN_AS_NODE;
      delete env.NOA_MCP_ENDPOINT;
      try {
        const child = spawn(spec.command, Array.isArray(spec.args) ? spec.args : [], { detached: true, stdio: 'ignore', env, cwd: spec.cwd || undefined });
        child.on('error', (e) => log('could not open Waifu Desk:', e.message));
        child.unref();
        log('opening Waifu Desk');
      } catch (e) {
        log('could not open Waifu Desk:', e.message);
      }
    }
    const until = Date.now() + LAUNCH_WAIT_MS;
    while (Date.now() < until) {
      await sleep(600);
      const ep = readJson(ENDPOINT);
      if (!ep?.port) continue;
      try {
        await request(ep, 'GET', '/v1/health', undefined, { timeoutMs: 3000 });
        return ep;
      } catch {
        /* aún arrancando */
      }
    }
    return null;
  })().finally(() => setTimeout(() => (launching = null), 500));
  return launching;
}

/** Petición a la app. launch=true: si está cerrada, la abre y espera. */
async function noa(method, pathname, body, { signal, timeoutMs, launch = true } = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const ep = readJson(ENDPOINT);
    if (!ep?.port) {
      if (!launch || attempt > 0 || !(await launchNoa())) throw closedError();
      continue;
    }
    try {
      return await request(ep, method, pathname, body, { signal, timeoutMs });
    } catch (e) {
      if (signal?.aborted) throw e;
      // 401: la app se reinició y cambió el token; se relee endpoint.json.
      if (e.status === 401 && attempt < 2) {
        await sleep(400);
        continue;
      }
      if (e.code === 'ECONNREFUSED' && attempt === 0 && launch) {
        if (!(await launchNoa())) throw closedError();
        continue;
      }
      throw e;
    }
  }
  throw closedError();
}

function cachedMeta() {
  return readJson(META) || {};
}

async function meta(launch = false) {
  try {
    const m = await noa('GET', '/v1/meta', undefined, { timeoutMs: 8000, launch });
    if (m) {
      try {
        fs.writeFileSync(META, JSON.stringify(m));
      } catch {
        /* solo caché */
      }
      return m;
    }
  } catch (e) {
    if (!gone(e)) log('meta:', e.message);
  }
  return cachedMeta();
}

const closedText = (name) =>
  `Waifu Desk (${name || 'Noa'}) is closed or its Claude Desktop connection is turned off, so this could not reach her. ` +
  'Stop the loop and tell the user here, in this chat. They can open the app (and check Settings → Connectors → Claude Desktop) and then ask you to continue.';

async function callTool(id, params) {
  const name = String(params?.name || '');
  const args = params?.arguments || {};
  const progressToken = params?._meta?.progressToken;
  const ctrl = new AbortController();
  inflight.set(id, ctrl);
  let ticker = null;
  try {
    if (name === 'noa_listen') {
      // Aviso de vida cada 20 s mientras se espera (algunos clientes alargan el plazo con esto).
      if (progressToken !== undefined) {
        let n = 0;
        ticker = setInterval(() => write({ jsonrpc: '2.0', method: 'notifications/progress', params: { progressToken, progress: ++n, message: 'Waiting for the user to talk to Noa…' } }), 20_000);
      }
      const until = Date.now() + LISTEN_MAX_MS;
      let closedSince = 0;
      // Si la app se reinicia a mitad de la espera, se vuelve a escuchar sin molestar a Claude.
      // Cerrada de verdad (más de 12 s sin volver): se avisa para que Claude pare el bucle.
      for (;;) {
        const left = Math.floor((until - Date.now()) / 1000) - 5;
        const wait = { ...args, timeout_seconds: Math.max(5, Math.min(Number(args.timeout_seconds) || 180, left)) };
        try {
          const out = await noa('POST', '/v1/call', { name, arguments: wait }, { signal: ctrl.signal, launch: false });
          return finish(id, out);
        } catch (e) {
          if (ctrl.signal.aborted) return;
          if (!gone(e)) throw e;
          closedSince ||= Date.now();
          if (Date.now() - closedSince > 12_000 || Date.now() > until - 5_000) throw e;
          await sleep(1500);
        }
      }
    }
    const out = await noa('POST', '/v1/call', { name, arguments: args }, { signal: ctrl.signal, launch: true });
    return finish(id, out);
  } catch (e) {
    if (ctrl.signal.aborted) return; // cancelada: no se responde
    const text = gone(e) ? closedText(cachedMeta().title) : `Waifu Desk error: ${e.message}`;
    reply(id, { content: [{ type: 'text', text }], isError: true });
  } finally {
    clearInterval(ticker);
    inflight.delete(id);
  }
}

function finish(id, out) {
  const { toolsVersion, ...result } = out || {};
  if (!Array.isArray(result.content)) result.content = [{ type: 'text', text: '(empty result)' }];
  reply(id, result);
  if (toolsVersion && servedToolsVersion && toolsVersion !== servedToolsVersion) {
    servedToolsVersion = null;
    write({ jsonrpc: '2.0', method: 'notifications/tools/list_changed' });
  }
}

async function handle(msg) {
  if (!msg || typeof msg !== 'object') return;
  const { id, method, params } = msg;
  if (!method) return; // respuesta del cliente: este servidor no le pide nada
  if (id === undefined || id === null) {
    if (method === 'notifications/cancelled') inflight.get(params?.requestId)?.abort();
    return;
  }
  try {
    switch (method) {
      case 'initialize': {
        if (params?.clientInfo?.name) clientName = [params.clientInfo.name, params.clientInfo.version].filter(Boolean).join(' ');
        const asked = params?.protocolVersion;
        const m = cachedMeta();
        return reply(id, {
          protocolVersion: SUPPORTED.includes(asked) ? asked : SUPPORTED[0],
          capabilities: { tools: { listChanged: true }, prompts: { listChanged: false } },
          serverInfo: { name: 'noa', title: m.title || 'Noa · Waifu Desk', version: m.version || '0.0.0' },
          instructions: m.instructions || FALLBACK_INSTRUCTIONS,
        });
      }
      case 'ping':
        return reply(id, {});
      case 'tools/list': {
        const m = await meta(false);
        servedToolsVersion = m.toolsVersion || null;
        return reply(id, { tools: m.tools || [] });
      }
      case 'tools/call':
        return callTool(id, params);
      case 'prompts/list': {
        const m = await meta(false);
        return reply(id, { prompts: m.prompts || [] });
      }
      case 'prompts/get': {
        const out = await noa('POST', '/v1/prompt', { name: params?.name, arguments: params?.arguments || {} }, { timeoutMs: 30_000, launch: true });
        return reply(id, out);
      }
      default:
        // server/discover (MCP 2026-07-28) incluido: «no existe» hace que el cliente use initialize.
        return error(id, -32601, `Method not found: ${method}`);
    }
  } catch (e) {
    if (gone(e)) return error(id, -32603, closedText(cachedMeta().title));
    return error(id, e.status === 404 ? -32602 : -32603, String(e.message || e));
  }
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let nl;
  while ((nl = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, nl).replace(/\r$/, '').trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
      continue;
    }
    for (const m of Array.isArray(msg) ? msg : [msg]) handle(m).catch((e) => log('error:', e.message));
  }
});
process.stdin.on('end', () => {
  for (const c of inflight.values()) c.abort();
  process.exit(0);
});
process.on('uncaughtException', (e) => log('uncaught:', e.stack || e.message));
