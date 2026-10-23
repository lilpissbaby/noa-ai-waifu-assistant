// Live2D: el Cubism Core (propietario de Live2D: no va dentro de la app; se descarga del SDK oficial
// tras aceptar su licencia, o se importa) y la importación de modelos (.zip o carpeta) como skins.
import { net } from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { userDir } from './config.js';
import { readZip, isUnsafePath } from './zip.js';
import { t } from '../shared/i18n/index.js';

export const CORE_URLS = ['https://cubism.live2d.com/sdk-web/bin/CubismSdkForWeb-5-r.5.zip', 'https://cubism.live2d.com/sdk-web/bin/CubismSdkForWeb-5-r.4.zip'];
export const LICENSE_URL = 'https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html';
const CORE_FILE = 'live2dcubismcore.min.js';
const MODEL_MAX_BYTES = 300 * 1024 * 1024;
const MODEL_MAX_FILES = 2000;
const SDK_MAX_BYTES = 80 * 1024 * 1024;

const fail = (code, message) => Object.assign(new Error(message || code), { code });
const coreDir = () => path.join(userDir(), 'runtime', 'live2d');
const tmpRoot = () => path.join(userDir(), 'tmp', 'live2d');
const skinsDir = () => path.join(userDir(), 'skins');

// ------------------------------------------------------------ modelos dentro de un paquete

export function findModels(files) {
  const depth = (f) => f.split('/').length;
  const models = files.filter((f) => /\.model3\.json$/i.test(f)).sort((a, b) => depth(a) - depth(b) || a.localeCompare(b));
  const cubism2 = !models.length && files.some((f) => /\.moc$/i.test(f)) && files.some((f) => /model\.json$/i.test(f));
  return { models, cubism2 };
}

// ------------------------------------------------------------ Cubism Core

export function coreStatus() {
  const file = path.join(coreDir(), CORE_FILE);
  if (!fs.existsSync(file)) return { ready: false, url: null, version: null };
  let version = null;
  try {
    version = fs.readFileSync(path.join(coreDir(), 'VERSION'), 'utf8').trim() || null;
  } catch {
    /* importado a mano */
  }
  return { ready: true, url: `app://local/user/runtime/live2d/${CORE_FILE}`, version };
}

// Un Core válido empieza con su cabecera y define Live2DCubismCore.
function checkCore(text) {
  if (!/Live2D Cubism Core/.test(text.slice(0, 2000)) || !/Live2DCubismCore/.test(text)) throw fail('notCore', t('errors.live2dNotCore'));
}

function installCore(text, version) {
  checkCore(text);
  fs.mkdirSync(coreDir(), { recursive: true });
  fs.writeFileSync(path.join(coreDir(), `${CORE_FILE}.tmp`), text);
  fs.renameSync(path.join(coreDir(), `${CORE_FILE}.tmp`), path.join(coreDir(), CORE_FILE));
  fs.writeFileSync(path.join(coreDir(), 'VERSION'), `${version}\n`);
  return coreStatus();
}

function coreFromSdkZip(buffer) {
  const [entry] = readZip(buffer, { want: (n) => /(^|\/)Core\/live2dcubismcore\.min\.js$/i.test(n), maxBytes: 20 * 1024 * 1024, maxFiles: 20000 });
  if (!entry) throw fail('notCore', t('errors.live2dNotCore'));
  return entry.data.toString('utf8');
}

// .zip del SDK de Cubism para Web o el propio live2dcubismcore(.min).js.
export function importCore(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length > SDK_MAX_BYTES) throw fail('tooBig', t('errors.live2dNotCore'));
  const isZip = buf.subarray(0, 2).toString('latin1') === 'PK';
  return installCore(isZip ? coreFromSdkZip(buf) : buf.toString('utf8'), `import:${path.basename(filePath)}`);
}

let downloading = null;
export function downloadCore(onProgress, { urls = CORE_URLS } = {}) {
  if (downloading) return downloading;
  downloading = (async () => {
    let lastError = null;
    for (const url of urls) {
      try {
        const res = await net.fetch(url);
        if (!res.ok) throw new Error(t('errors.download', { status: res.status }));
        const total = Number(res.headers.get('content-length')) || 30e6;
        const chunks = [];
        let got = 0;
        const reader = res.body.getReader();
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          got += value.length;
          if (got > SDK_MAX_BYTES) throw fail('tooBig', 'SDK too large');
          chunks.push(Buffer.from(value));
          onProgress?.(Math.min(0.99, got / total));
        }
        const st = installCore(coreFromSdkZip(Buffer.concat(chunks)), path.basename(new URL(url).pathname, '.zip'));
        onProgress?.(1);
        return st;
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError || new Error('download failed');
  })().finally(() => {
    downloading = null;
  });
  return downloading;
}

// ------------------------------------------------------------ importar modelos

const README = /(^|\/)(readme|license|licence|terms|規約|利用規約|readme_[a-z]+)[^/]*\.(txt|md)$/i;

// Lista recursiva de una carpeta como rutas relativas con «/»; rechaza enlaces simbólicos.
function walkFolder(root) {
  const out = [];
  let bytes = 0;
  const visit = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isSymbolicLink()) throw fail('unsafe', t('errors.live2dUnsafe'));
      if (e.isDirectory()) visit(p);
      else if (e.isFile()) {
        bytes += fs.statSync(p).size;
        out.push(path.relative(root, p).split(path.sep).join('/'));
        if (out.length > MODEL_MAX_FILES) throw fail('tooMany', t('errors.live2dTooMany'));
        if (bytes > MODEL_MAX_BYTES) throw fail('tooBig', t('errors.live2dTooBig'));
      }
    }
  };
  visit(root);
  return out;
}

// Copia el paquete (zip o carpeta) a userData/tmp/live2d/<tmpId>/ y dice qué hay dentro.
export function stageLive2d(srcPath) {
  const tmpId = crypto.randomBytes(6).toString('hex');
  const dest = path.join(tmpRoot(), tmpId);
  try {
    let files;
    if (fs.statSync(srcPath).isDirectory()) {
      files = walkFolder(srcPath);
      for (const f of files) {
        const to = path.join(dest, ...f.split('/'));
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(path.join(srcPath, ...f.split('/')), to);
      }
    } else {
      if (fs.statSync(srcPath).size > MODEL_MAX_BYTES) throw fail('tooBig', t('errors.live2dTooBig'));
      const entries = readZip(fs.readFileSync(srcPath), { maxFiles: MODEL_MAX_FILES, maxBytes: MODEL_MAX_BYTES });
      files = [];
      for (const e of entries) {
        if (isUnsafePath(e.name)) throw fail('unsafe', t('errors.live2dUnsafe'));
        const to = path.join(dest, ...e.name.split('/'));
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.writeFileSync(to, e.data);
        files.push(e.name);
      }
    }
    // Zips de macOS: fuera __MACOSX y ._*
    files = files.filter((f) => !/(^|\/)(__MACOSX\/|\._)/.test(f));
    const { models, cubism2 } = findModels(files);
    if (!models.length) {
      fs.rmSync(dest, { recursive: true, force: true });
      return { error: cubism2 ? 'cubism2' : 'noModel' };
    }
    const vts = files.filter((f) => /\.vtube\.json$/i.test(f));
    const readmes = files
      .filter((f) => README.test(f))
      .slice(0, 5)
      .map((f) => ({ name: f, text: fs.readFileSync(path.join(dest, ...f.split('/')), 'utf8').slice(0, 20000) }));
    return { tmpId, models, vts, readmes, base: `app://local/user/tmp/live2d/${tmpId}/` };
  } catch (e) {
    fs.rmSync(dest, { recursive: true, force: true });
    const code = ['unsafe', 'tooBig', 'tooMany'].includes(e.code) ? e.code : null;
    if (code) return { error: code };
    if (e.code === 'corrupt') return { error: 'corrupt' };
    throw e;
  }
}

const safeRel = (rel) => typeof rel === 'string' && rel && !isUnsafePath(rel) && !rel.includes('\\');

// Guarda (o actualiza) la skin: skins/<id>/model/… + skin.json + miniatura.
export function saveLive2dSkin({ id, tmpId, model, vts = null, name, framing, expressions, thumb }) {
  if (!safeRel(model) || (vts && !safeRel(vts))) throw fail('unsafe', t('errors.live2dUnsafe'));
  const skinId = id && /^live2d-[\w-]+$/.test(id) ? id : `live2d-${crypto.randomBytes(5).toString('hex')}`;
  const dir = path.join(skinsDir(), skinId);
  if (tmpId) {
    if (!/^[0-9a-f]{12}$/.test(tmpId)) throw fail('unsafe', 'bad tmpId');
    const src = path.join(tmpRoot(), tmpId);
    if (!fs.existsSync(path.join(src, ...model.split('/')))) throw fail('noModel', t('errors.live2dNoModel'));
    fs.rmSync(path.join(dir, 'model'), { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    fs.renameSync(src, path.join(dir, 'model'));
  } else if (!fs.existsSync(path.join(dir, 'model', ...model.split('/')))) throw fail('noModel', t('errors.live2dNoModel'));
  const files = { model: `model/${model}` };
  if (thumb && /^data:image\/png;base64,/.test(thumb)) {
    fs.writeFileSync(path.join(dir, 'thumb.png'), Buffer.from(thumb.split(',')[1], 'base64'));
    files.thumb = 'thumb.png';
  } else if (fs.existsSync(path.join(dir, 'thumb.png'))) files.thumb = 'thumb.png';
  const manifest = {
    id: skinId,
    type: 'live2d',
    name: String(name || path.basename(model, '.model3.json')).slice(0, 80),
    files,
    vts: vts ? `model/${vts}` : null,
    framing: framing || { preset: 'half', zoom: 1, offsetY: 0 },
    expressions: expressions && typeof expressions === 'object' ? expressions : {},
    created: Date.now(),
  };
  fs.writeFileSync(path.join(dir, 'skin.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}

export function clearLive2dTmp() {
  fs.rmSync(tmpRoot(), { recursive: true, force: true });
}
