// Alta de la asistente como servidor MCP en Claude Desktop (claude_desktop_config.json) y el
// comando equivalente para Claude Code. Sin Electron: las rutas y el entorno llegan por parámetro.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const SERVER_NAME = 'noa';
const FILE = 'claude_desktop_config.json';

/**
 * Dónde puede estar la configuración de Claude Desktop. En Windows, la versión de la Microsoft
 * Store (MSIX) la guarda virtualizada dentro de %LOCALAPPDATA%\Packages\Claude_…; se miran todas.
 */
export function claudeConfigCandidates({ platform = process.platform, env = process.env, home = os.homedir(), fsImpl = fs } = {}) {
  const P = platform === 'win32' ? path.win32 : path.posix;
  const out = [];
  if (platform === 'win32') {
    const roaming = env.APPDATA || P.join(home, 'AppData', 'Roaming');
    out.push({ path: P.join(roaming, 'Claude', FILE), kind: 'standard' });
    const local = env.LOCALAPPDATA || P.join(home, 'AppData', 'Local');
    const pkgs = P.join(local, 'Packages');
    let names = [];
    try {
      names = fsImpl.readdirSync(pkgs).filter((n) => /^(Claude|AnthropicPBC\.Claude|Anthropic\.Claude)/i.test(n));
    } catch {
      /* no hay Packages */
    }
    for (const n of names) out.push({ path: P.join(pkgs, n, 'LocalCache', 'Roaming', 'Claude', FILE), kind: 'store' });
  } else if (platform === 'darwin') {
    out.push({ path: P.join(home, 'Library', 'Application Support', 'Claude', FILE), kind: 'standard' });
  } else {
    const cfg = env.XDG_CONFIG_HOME || P.join(home, '.config');
    out.push({ path: P.join(cfg, 'Claude', FILE), kind: 'standard' });
  }
  return out.map((c) => ({ ...c, exists: exists(fsImpl, c.path), dirExists: exists(fsImpl, (platform === 'win32' ? path.win32 : path.posix).dirname(c.path)) }));
}

const exists = (fsImpl, p) => {
  try {
    fsImpl.statSync(p);
    return true;
  } catch {
    return false;
  }
};

/** Entrada del servidor: el ejecutable de la app hace de Node (ELECTRON_RUN_AS_NODE) y corre el puente. */
export function serverEntry({ command, bridgePath, endpointPath, useNode = false }) {
  return {
    command: useNode ? 'node' : command,
    args: [bridgePath],
    env: { ...(useNode ? {} : { ELECTRON_RUN_AS_NODE: '1' }), NOA_MCP_ENDPOINT: endpointPath },
  };
}

export function snippet(entry) {
  return JSON.stringify({ mcpServers: { [SERVER_NAME]: entry } }, null, 2);
}

const q = (s) => (/[\s"]/.test(s) ? `"${String(s).replaceAll('"', '\\"')}"` : s);

/** Comando para Claude Code (claude mcp add …, en el ámbito del usuario). */
export function claudeCodeCommand(entry) {
  const envs = Object.entries(entry.env || {}).map(([k, v]) => `-e ${k}=${q(v)}`);
  return ['claude mcp add --scope user', SERVER_NAME, ...envs, '--', q(entry.command), ...entry.args.map(q)].join(' ');
}

export function readClaudeConfig(file, fsImpl = fs) {
  let text;
  try {
    text = fsImpl.readFileSync(file, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return { ok: true, data: {}, missing: true };
    return { ok: false, error: e.message };
  }
  if (!text.trim()) return { ok: true, data: {} };
  try {
    const data = JSON.parse(text.replace(/^\uFEFF/, ''));
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, error: 'not a JSON object' };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: `invalid JSON: ${e.message}` };
  }
}

const sameEntry = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** 'missing' | 'current' | 'outdated' | 'error' */
export function entryState(file, entry, fsImpl = fs) {
  const r = readClaudeConfig(file, fsImpl);
  if (!r.ok) return 'error';
  const cur = r.data.mcpServers?.[SERVER_NAME];
  if (!cur) return 'missing';
  const want = { command: entry.command, args: entry.args, env: { ...(cur.env || {}), ...entry.env } };
  return sameEntry({ command: cur.command, args: cur.args, env: cur.env }, want) ? 'current' : 'outdated';
}

function writeJson(file, data, fsImpl) {
  fsImpl.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.noa-tmp`;
  fsImpl.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  fsImpl.renameSync(tmp, file);
}

/** Añade o actualiza la entrada sin tocar el resto. Guarda una copia la primera vez. */
export function installEntry(file, entry, fsImpl = fs) {
  const r = readClaudeConfig(file, fsImpl);
  if (!r.ok) throw new Error(`${file}: ${r.error}`);
  const data = r.data;
  const prev = data.mcpServers?.[SERVER_NAME];
  // Se conservan las variables de entorno que el usuario hubiera añadido a mano.
  const next = { ...(prev || {}), command: entry.command, args: entry.args, env: { ...(prev?.env || {}), ...entry.env } };
  if (sameEntry(prev, next)) return { changed: false };
  const backup = `${file}.noa-backup`;
  if (!r.missing && !exists(fsImpl, backup)) fsImpl.copyFileSync(file, backup);
  data.mcpServers = { ...(data.mcpServers || {}), [SERVER_NAME]: next };
  writeJson(file, data, fsImpl);
  return { changed: true };
}

export function removeEntry(file, fsImpl = fs) {
  const r = readClaudeConfig(file, fsImpl);
  if (!r.ok || !r.data.mcpServers?.[SERVER_NAME]) return { changed: false };
  delete r.data.mcpServers[SERVER_NAME];
  writeJson(file, r.data, fsImpl);
  return { changed: true };
}

/** Dónde instalar: las configuraciones que ya existen (o su carpeta); si no hay ninguna, la normal. */
export function installTargets(candidates) {
  const found = candidates.filter((c) => c.exists || c.dirExists);
  return found.length ? found : candidates.filter((c) => c.kind === 'standard');
}
