// Cliente MCP: conecta servidores (stdio o HTTP) y expone sus herramientas a la asistente.
// Así se puede enchufar casi cualquier cosa: paperclip-mcp, filesystem, GitHub, Home Assistant...
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { getSecret } from '../config.js';
import { slug } from './util.js';

const clients = new Map(); // id -> { client, transport, tools, signature, error }

const signatureOf = (s) => JSON.stringify([s.type, s.command, s.args, s.env, s.url, s.headersJson, s.enabled]);

function parseArgs(args) {
  if (Array.isArray(args)) return args;
  if (!args) return [];
  // admite "-y @org/server --flag" o JSON
  const t = String(args).trim();
  if (t.startsWith('[')) {
    try {
      return JSON.parse(t);
    } catch {
      /* cae a split */
    }
  }
  return t.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((a) => a.replace(/^"|"$/g, '')) || [];
}

function parseEnv(env) {
  if (!env) return {};
  if (typeof env === 'object') return env;
  const out = {};
  for (const line of String(env).split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function connect(server) {
  const client = new Client({ name: 'waifu-desk', version: '0.1.0' });
  let transport;
  if (server.type === 'http') {
    let headers = {};
    try {
      headers = server.headersJson ? JSON.parse(server.headersJson) : {};
    } catch {
      /* ignorado */
    }
    const token = getSecret(`mcp:${server.id}`);
    if (token) headers.authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    transport = new StreamableHTTPClientTransport(new URL(server.url), { requestInit: { headers } });
  } else {
    transport = new StdioClientTransport({
      command: server.command,
      args: parseArgs(server.args),
      env: { ...getDefaultEnvironment(), ...parseEnv(server.env) },
      stderr: 'pipe',
    });
  }
  await client.connect(transport);
  const { tools } = await client.listTools();
  return { client, transport, tools: tools || [] };
}

// Sincroniza conexiones con la configuración (conecta nuevas, cierra las quitadas).
export async function syncMcp(cfg) {
  const wanted = (cfg.connectors.mcpServers || []).filter((s) => s.enabled !== false);
  const wantedIds = new Set(wanted.map((s) => s.id));
  for (const [id, entry] of clients) {
    if (!wantedIds.has(id)) {
      await entry.client?.close().catch(() => {});
      clients.delete(id);
    }
  }
  await Promise.all(
    wanted.map(async (s) => {
      const sig = signatureOf(s);
      const existing = clients.get(s.id);
      if (existing && existing.signature === sig && !existing.error) return;
      if (existing) await existing.client?.close().catch(() => {});
      try {
        const conn = await withTimeout(connect(s), 30000, `MCP ${s.name}`);
        clients.set(s.id, { ...conn, signature: sig, server: s, error: null });
      } catch (e) {
        clients.set(s.id, { client: null, tools: [], signature: sig, server: s, error: e.message || String(e) });
      }
    }),
  );
}

export function mcpStatus() {
  return [...clients.entries()].map(([id, e]) => ({
    id,
    name: e.server?.name,
    connected: !!e.client && !e.error,
    error: e.error,
    tools: (e.tools || []).map((t) => t.name),
  }));
}

export function mcpTools(cfg) {
  const out = [];
  const used = new Set();
  for (const s of cfg.connectors.mcpServers || []) {
    const entry = clients.get(s.id);
    if (!entry?.client || entry.error) continue;
    for (const t of entry.tools) {
      let name = `mcp_${slug(s.name).slice(0, 16)}_${t.name}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
      while (used.has(name)) name = `${name.slice(0, 60)}_${used.size}`;
      used.add(name);
      out.push({
        name,
        group: `herramientas MCP de ${s.name}`,
        description: (t.description || t.name).slice(0, 1000),
        schema: t.inputSchema && t.inputSchema.type === 'object' ? t.inputSchema : { type: 'object', properties: {} },
        confirm: s.confirm
          ? (i) => ({ title: `MCP ${s.name}`, message: `¿Ejecutar ${t.name}?`, detail: JSON.stringify(i, null, 1).slice(0, 800), allowAlways: true })
          : undefined,
        run: async (input) => {
          const res = await entry.client.callTool({ name: t.name, arguments: input || {} });
          const parts = (res.content || []).map((c) =>
            c.type === 'text' ? c.text : c.type === 'resource' ? c.resource?.text || c.resource?.uri : `[${c.type}]`,
          );
          const text = parts.join('\n') || JSON.stringify(res.structuredContent || res);
          if (res.isError) throw new Error(text);
          return text;
        },
      });
    }
  }
  return out;
}

export async function closeAllMcp() {
  for (const e of clients.values()) await e.client?.close().catch(() => {});
  clients.clear();
}

function withTimeout(p, ms, label) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`${label}: no respondió en ${ms / 1000}s`)), ms))]);
}
