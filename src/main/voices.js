// Voces locales Piper: catálogo oficial (rhasspy/piper-voices), descarga con comprobación md5,
// importación de .onnx + .onnx.json o de un .zip con varias, y la lista de las instaladas.
// Cada voz vive en userData/voices/<key>/ con model.onnx, model.onnx.json, MODEL_CARD y voice.json.
import { net } from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { userDir } from './config.js';
import { readZip } from './zip.js';
import { t } from '../shared/i18n/index.js';

export const CATALOG_URL = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/voices.json';
export const VOICES_BASE_URL = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/';
export const VOICE_MAX_BYTES = 300 * 1024 * 1024;
const ZIP_MAX_BYTES = 2 * VOICE_MAX_BYTES;
const CATALOG_TTL = 24 * 3600 * 1000;

const fail = (code, message) => Object.assign(new Error(message || code), { code });
const voicesDir = () => path.join(userDir(), 'voices');
const catalogPath = () => path.join(voicesDir(), 'catalog.json');
const validKey = (key) => typeof key === 'string' && /^[\w][\w.-]{0,119}$/.test(key) && !key.includes('..');
const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex');

// ------------------------------------------------------------ licencias

export function licenseFromModelCard(text) {
  if (!text) return '';
  for (const line of String(text).split(/\r?\n/)) {
    const m = line.match(/licen[cs]e\s*:\s*(.+)$/i);
    if (m) return m[1].replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').trim();
  }
  const para = String(text)
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .find((p) => p && !p.startsWith('#'));
  return para ? para.replace(/\s*\r?\n\s*/g, ' ').slice(0, 200) : '';
}

// ------------------------------------------------------------ instaladas

const urls = (key) => {
  const base = `app://local/user/voices/${encodeURIComponent(key)}/`;
  return { modelUrl: `${base}model.onnx`, configUrl: `${base}model.onnx.json` };
};

export function listVoices() {
  let names;
  try {
    names = fs.readdirSync(voicesDir(), { withFileTypes: true }).filter((d) => d.isDirectory() && validKey(d.name));
  } catch {
    return [];
  }
  const out = [];
  for (const d of names) {
    const dir = path.join(voicesDir(), d.name);
    try {
      if (!fs.existsSync(path.join(dir, 'model.onnx'))) continue;
      const info = JSON.parse(fs.readFileSync(path.join(dir, 'voice.json'), 'utf8'));
      out.push({ ...info, key: d.name, ...urls(d.name) });
    } catch {
      /* carpeta a medias: se ignora */
    }
  }
  return out.sort((a, b) => a.language.localeCompare(b.language) || a.name.localeCompare(b.name));
}

export function deleteVoice(key) {
  if (!validKey(key)) throw fail('badKey', `Bad voice key: ${key}`);
  fs.rmSync(path.join(voicesDir(), key), { recursive: true, force: true });
}

// Nombre y calidad salen del nombre de archivo de Piper: <idioma>-<nombre>-<calidad>.
function parseKey(key) {
  const parts = key.split('-');
  const quality = /^(x_low|low|medium|high)$/.test(parts.at(-1)) ? parts.at(-1) : '';
  return { name: parts.length >= 3 ? parts.slice(1, quality ? -1 : undefined).join('-') : key, quality };
}

function parseConfig(buf, fileName) {
  let c = null;
  try {
    c = JSON.parse(buf.toString('utf8'));
  } catch {
    /* abajo */
  }
  if (!c || typeof c !== 'object' || !c.phoneme_id_map || !c.audio?.sample_rate) throw fail('badConfig', t('errors.piperBadConfig', { file: fileName }));
  return c;
}

// Escribe la voz en una carpeta temporal y la mueve al final: o se instala entera o nada.
function installVoice({ key, onnx, json, card, source, catalogEntry }) {
  if (!validKey(key)) throw fail('badKey', `Bad voice key: ${key}`);
  const c = parseConfig(json, `${key}.onnx.json`);
  const fromKey = parseKey(key);
  const speakerMap = c.speaker_id_map && typeof c.speaker_id_map === 'object' ? c.speaker_id_map : {};
  const info = {
    key,
    name: catalogEntry?.name || fromKey.name || c.dataset || key,
    language: c.language?.code || catalogEntry?.language?.code || c.espeak?.voice || '',
    quality: c.audio?.quality || catalogEntry?.quality || fromKey.quality,
    speakers: Math.max(1, Number(c.num_speakers) || 1),
    speakerNames: Object.entries(speakerMap)
      .sort((a, b) => a[1] - b[1])
      .map(([n]) => n),
    sampleRate: c.audio.sample_rate,
    license: card ? licenseFromModelCard(card.toString('utf8')) : '',
    source,
  };
  fs.mkdirSync(voicesDir(), { recursive: true });
  const tmp = path.join(voicesDir(), `.tmp-${key}-${crypto.randomBytes(4).toString('hex')}`);
  const final = path.join(voicesDir(), key);
  try {
    fs.mkdirSync(tmp);
    if (Buffer.isBuffer(onnx)) fs.writeFileSync(path.join(tmp, 'model.onnx'), onnx);
    else fs.copyFileSync(onnx, path.join(tmp, 'model.onnx'));
    fs.writeFileSync(path.join(tmp, 'model.onnx.json'), json);
    if (card) fs.writeFileSync(path.join(tmp, 'MODEL_CARD'), card);
    fs.writeFileSync(path.join(tmp, 'voice.json'), JSON.stringify(info, null, 2));
    fs.rmSync(final, { recursive: true, force: true });
    fs.renameSync(tmp, final);
  } catch (e) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw e;
  }
  return { ...info, ...urls(key) };
}

const keyFromFile = (name) => path.basename(name).replace(/\.onnx$/i, '').replace(/[^\w.-]+/g, '-').slice(0, 120);

// ------------------------------------------------------------ importar

// paths: .onnx (con su .json al lado o elegido también), .json sueltos y .zip con una o varias voces.
export async function importVoiceFiles(paths) {
  const list = paths.map((p) => path.resolve(p));
  const jsons = list.filter((p) => /\.json$/i.test(p));
  const plan = [];
  for (const p of list) {
    if (/\.zip$/i.test(p)) {
      if (fs.statSync(p).size > ZIP_MAX_BYTES) throw fail('tooBig', t('errors.voiceTooBig', { file: path.basename(p) }));
      let files;
      try {
        files = readZip(fs.readFileSync(p), { want: (n) => /\.onnx(\.json)?$|\.json$|(^|\/)MODEL_CARD$/i.test(n), maxBytes: ZIP_MAX_BYTES });
      } catch (e) {
        const key = { unsafe: 'zipUnsafe', tooMany: 'zipTooMany', corrupt: 'zipCorrupt', tooBig: 'voiceTooBig' }[e.code];
        throw key ? fail(e.code, t(`errors.${key}`, { file: path.basename(p) })) : e;
      }
      const byName = new Map(files.map((f) => [f.name, f.data]));
      const models = files.filter((f) => /\.onnx$/i.test(f.name));
      if (!models.length) throw fail('noVoice', t('errors.piperNoVoice', { file: path.basename(p) }));
      for (const m of models) {
        const json = byName.get(`${m.name}.json`) || byName.get(m.name.replace(/\.onnx$/i, '.json'));
        if (!json) throw fail('noConfig', t('errors.piperNoConfig', { file: path.basename(m.name) }));
        if (m.data.length > VOICE_MAX_BYTES) throw fail('tooBig', t('errors.voiceTooBig', { file: path.basename(m.name) }));
        const dir = path.posix.dirname(m.name);
        plan.push({ key: keyFromFile(m.name), onnx: m.data, json, card: byName.get(dir === '.' ? 'MODEL_CARD' : `${dir}/MODEL_CARD`) || null });
      }
    } else if (/\.onnx$/i.test(p)) {
      const onnxCount = list.filter((x) => /\.onnx$/i.test(x)).length;
      const candidates = [`${p}.json`, p.replace(/\.onnx$/i, '.json')];
      const jsonPath =
        candidates.find((c) => jsons.includes(c)) || candidates.find((c) => fs.existsSync(c)) || (onnxCount === 1 && jsons.length === 1 ? jsons[0] : null);
      if (!jsonPath) throw fail('noConfig', t('errors.piperNoConfig', { file: path.basename(p) }));
      if (fs.statSync(p).size > VOICE_MAX_BYTES) throw fail('tooBig', t('errors.voiceTooBig', { file: path.basename(p) }));
      const cardPath = path.join(path.dirname(p), 'MODEL_CARD');
      plan.push({ key: keyFromFile(p), onnx: p, json: fs.readFileSync(jsonPath), card: fs.existsSync(cardPath) ? fs.readFileSync(cardPath) : null });
    }
  }
  if (!plan.length) throw fail('noVoice', t('errors.piperNoVoice', { file: paths.map((p) => path.basename(p)).join(', ') }));
  // Se validan todas las configuraciones antes de instalar ninguna.
  for (const v of plan) parseConfig(v.json, `${v.key}.onnx.json`);
  return plan.map((v) => installVoice({ ...v, source: 'import' }));
}

// ------------------------------------------------------------ catálogo

const readCachedCatalog = () => {
  try {
    return JSON.parse(fs.readFileSync(catalogPath(), 'utf8'));
  } catch {
    return null;
  }
};

function compact(raw) {
  return Object.values(raw || {})
    .filter((e) => e && validKey(e.key) && e.files)
    .map((e) => {
      const onnx = Object.entries(e.files).find(([p]) => p.endsWith('.onnx'));
      const lang = e.language || {};
      return {
        key: e.key,
        name: e.name || e.key,
        language: lang.code || '',
        family: lang.family || String(lang.code || '').split('_')[0],
        languageName: lang.name_native ? `${lang.name_native}${lang.country_english ? ` (${lang.country_english})` : ''}` : lang.code || '',
        quality: e.quality || '',
        speakers: Number(e.num_speakers) || 1,
        sizeMB: onnx ? Math.round(onnx[1].size_bytes / 1e6) : 0,
      };
    })
    .sort((a, b) => a.language.localeCompare(b.language) || a.name.localeCompare(b.name));
}

export async function fetchCatalog({ force = false, url = CATALOG_URL } = {}) {
  let fresh = false;
  try {
    fresh = Date.now() - fs.statSync(catalogPath()).mtimeMs < CATALOG_TTL;
  } catch {
    /* sin caché */
  }
  const cached = readCachedCatalog();
  if (cached && fresh && !force) return compact(cached);
  try {
    const res = await net.fetch(url);
    if (!res.ok) throw new Error(t('errors.download', { status: res.status }));
    const raw = await res.json();
    fs.mkdirSync(voicesDir(), { recursive: true });
    fs.writeFileSync(catalogPath(), JSON.stringify(raw));
    return compact(raw);
  } catch (e) {
    if (cached) return compact(cached); // sin red: la última copia, aunque sea vieja
    throw e;
  }
}

export function catalogForLanguage(entries, lang) {
  const l = String(lang || '').toLowerCase();
  if (!l) return entries;
  return entries.filter((e) => e.family.toLowerCase() === l || e.language.toLowerCase() === l);
}

async function download(url, expectedSize, onBytes) {
  const res = await net.fetch(url);
  if (!res.ok) throw new Error(t('errors.download', { status: res.status }));
  const chunks = [];
  let got = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    got += value.length;
    if (got > Math.max(expectedSize, 1) * 1.1 + 1024 || got > VOICE_MAX_BYTES) throw fail('tooBig', t('errors.voiceTooBig', { file: path.basename(url) }));
    chunks.push(Buffer.from(value));
    onBytes(value.length);
  }
  return Buffer.concat(chunks);
}

const installing = new Map();
export function installFromCatalog(key, onProgress, { baseUrl = VOICES_BASE_URL } = {}) {
  if (installing.has(key)) return installing.get(key);
  const job = (async () => {
    const raw = readCachedCatalog() || {};
    const entry = raw[key];
    if (!entry || !validKey(key)) throw fail('notFound', t('errors.piperNotInCatalog', { voice: key }));
    const files = Object.entries(entry.files || {});
    const pick = (re) => files.find(([p]) => re.test(p));
    const wanted = [pick(/\.onnx$/), pick(/\.onnx\.json$/), pick(/(^|\/)MODEL_CARD$/)].filter(Boolean);
    if (wanted.length < 2) throw fail('notFound', t('errors.piperNotInCatalog', { voice: key }));
    const total = wanted.reduce((s, [, f]) => s + (f.size_bytes || 0), 0) || 1;
    let done = 0;
    const got = [];
    for (const [p, f] of wanted) {
      const buf = await download(baseUrl + p.split('/').map(encodeURIComponent).join('/'), f.size_bytes || 0, (n) => {
        done += n;
        onProgress?.(Math.min(0.99, done / total));
      });
      if (f.md5_digest && md5(buf) !== f.md5_digest) throw fail('integrity', t('errors.integrity'));
      got.push(buf);
    }
    const [onnx, json, card] = got;
    const v = installVoice({ key, onnx, json, card: card || null, source: 'catalog', catalogEntry: entry });
    onProgress?.(1);
    return v;
  })().finally(() => installing.delete(key));
  installing.set(key, job);
  return job;
}
