// «Claude Desktop (MCP)»: la asistente usa como cerebro una conversación de Claude Desktop (tu
// suscripción) en vez de una API key. Aquí se arranca el servidor local, se dejan en la carpeta de
// datos el puente y sus archivos, y se da de alta en claude_desktop_config.json.
import { app, nativeImage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { userDir } from '../config.js';
import { attachmentBase64 } from '../attachments.js';
import { createDesktopHost } from './host.js';
import { startServer, newToken } from './server.js';
import * as cc from './claude-config.js';

const BRIDGE_SOURCE = fileURLToPath(new URL('./bridge.cjs', import.meta.url));
const MAX_IMAGE_B64 = 110_000; // por imagen; Claude Desktop admite ~150 000 caracteres por resultado

export const desktopDir = () => path.join(userDir(), 'claude-desktop');
const file = (name) => path.join(desktopDir(), name);
export const bridgePath = () => file('noa-mcp-bridge.cjs');
export const endpointPath = () => file('endpoint.json');

// Ejecutable que Claude Desktop arranca en modo Node. En una AppImage, process.execPath apunta a
// un montaje temporal que cambia en cada arranque: se usa la AppImage misma.
const appCommand = () => process.env.APPIMAGE || process.execPath;
const launchSpec = () => (app.isPackaged ? { command: appCommand(), args: [] } : { command: process.execPath, args: [app.getAppPath()], cwd: app.getAppPath() });

function writePrivate(target, text) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text, { mode: 0o600 });
}

// Imagen para Claude: JPEG cada vez más pequeña hasta que cabe.
export function readImage(att) {
  const b64 = attachmentBase64(att);
  if (!b64) return null;
  const img = nativeImage.createFromBuffer(Buffer.from(b64, 'base64'));
  if (img.isEmpty()) return b64.length <= MAX_IMAGE_B64 ? { data: b64, mimeType: att.mime || 'image/png' } : null;
  const { width, height } = img.getSize();
  for (const side of [1568, 1280, 1024, 800, 640, 480]) {
    const scale = Math.min(1, side / Math.max(width, height, 1));
    const sized = scale < 1 ? img.resize({ width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), quality: 'good' }) : img;
    for (const q of [82, 68]) {
      const data = sized.toJPEG(q).toString('base64');
      if (data.length <= MAX_IMAGE_B64) return { data, mimeType: 'image/jpeg' };
    }
  }
  return null;
}

/**
 * deps: lo que pide createDesktopHost (name, mode, toolbox, briefing, briefKey, promptTitle, ui)
 * más shouldRun() (si el servidor tiene que estar encendido) y logger.
 */
export function createDesktopMcp(deps) {
  const logger = deps.logger || console;
  const host = createDesktopHost({ ...deps, version: app.getVersion(), readImage });
  let server = null;
  let token = null;
  let chain = Promise.resolve(); // arranques y paradas en orden

  const handler = {
    meta: () => host.meta(),
    call: async (name, args, ctx) => ({ ...(await host.call(name, args, ctx)), toolsVersion: host.meta().toolsVersion }),
    prompt: (name, args, ctx) => host.prompt(name, args, ctx),
  };

  // El puente, la caché de herramientas y cómo abrir la app: siempre al día (aunque esté apagado),
  // para que Claude Desktop pueda arrancar la app cuando la necesite.
  function writeFiles() {
    try {
      fs.mkdirSync(desktopDir(), { recursive: true });
      const src = fs.readFileSync(BRIDGE_SOURCE, 'utf8');
      let cur = '';
      try {
        cur = fs.readFileSync(bridgePath(), 'utf8');
      } catch {
        /* primera vez */
      }
      if (cur !== src) fs.writeFileSync(bridgePath(), src);
      writePrivate(file('launch.json'), JSON.stringify(launchSpec(), null, 1));
      writePrivate(file('meta.json'), JSON.stringify(host.meta()));
    } catch (e) {
      logger.warn?.(`Claude Desktop: no se pudieron escribir los archivos del puente: ${e.message}`);
    }
  }

  async function start() {
    if (server) return;
    token = newToken();
    server = await startServer({ token, handler, logger });
    writePrivate(endpointPath(), JSON.stringify({ port: server.port, token, pid: process.pid, version: app.getVersion() }));
    logger.info?.(`Claude Desktop: servidor MCP local en 127.0.0.1:${server.port}`);
  }

  async function stop() {
    if (!server) return;
    const s = server;
    server = null;
    removeEndpoint();
    host.cancel();
    await s.close().catch(() => {});
    logger.info?.('Claude Desktop: servidor MCP local parado');
  }

  function removeEndpoint() {
    try {
      fs.rmSync(endpointPath(), { force: true });
    } catch {
      /* da igual */
    }
  }

  /** Enciende o apaga según los ajustes y refresca los archivos. */
  function sync() {
    chain = chain
      .then(async () => {
        writeFiles();
        if (deps.shouldRun()) await start();
        else await stop();
      })
      .catch((e) => logger.error?.('Claude Desktop', e));
    return chain;
  }

  const entry = () => cc.serverEntry({ command: appCommand(), bridgePath: bridgePath(), endpointPath: endpointPath() });

  function candidates() {
    const want = entry();
    return cc.claudeConfigCandidates().map((c) => ({ ...c, state: c.exists ? cc.entryState(c.path, want) : 'missing' }));
  }

  function install() {
    writeFiles();
    const want = entry();
    const done = [];
    for (const c of cc.installTargets(cc.claudeConfigCandidates())) {
      const r = cc.installEntry(c.path, want);
      done.push({ path: c.path, changed: r.changed });
    }
    return done;
  }

  function uninstall() {
    return candidates()
      .filter((c) => c.exists)
      .map((c) => ({ path: c.path, ...cc.removeEntry(c.path) }));
  }

  // Si la app cambió de sitio (zip movido, otra versión), se corrige la entrada que ya había.
  function repair() {
    const fixed = [];
    for (const c of candidates())
      if (c.state === 'outdated')
        try {
          cc.installEntry(c.path, entry());
          fixed.push(c.path);
        } catch (e) {
          logger.warn?.(`Claude Desktop: ${c.path}: ${e.message}`);
        }
    if (fixed.length) logger.info?.(`Claude Desktop: entrada actualizada en ${fixed.join(', ')}`);
    return fixed;
  }

  function info() {
    const e = entry();
    return {
      running: !!server,
      port: server?.port || null,
      status: host.status(),
      candidates: candidates().map(({ path: p, kind, exists, state }) => ({ path: p, kind, exists, state })),
      snippet: cc.snippet(e),
      snippetNode: cc.snippet(cc.serverEntry({ command: 'node', bridgePath: bridgePath(), endpointPath: endpointPath(), useNode: true })),
      claudeCode: cc.claudeCodeCommand(e),
      bridgePath: bridgePath(),
      prompt: host.loopText(),
    };
  }

  return {
    host,
    sync,
    stop,
    removeEndpoint,
    install,
    uninstall,
    repair,
    info,
    writeFiles,
    running: () => !!server,
  };
}
