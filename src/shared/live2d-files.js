// Archivos que nombra un .model3.json de Live2D. Sin dependencias: lo usan la descarga de la galería
// (proceso principal) y la herramienta que prepara las imágenes de la documentación.

// Rutas relativas que nombra el modelo (sin duplicados), y si son imprescindibles para dibujarlo.
export function model3Files(json) {
  const r = json?.FileReferences || {};
  const out = [];
  const add = (file, required = false) => typeof file === 'string' && file.trim() && !out.some((x) => x.file === file) && out.push({ file, required });
  add(r.Moc, true);
  for (const tex of r.Textures || []) add(tex, true);
  for (const f of [r.Physics, r.Pose, r.DisplayInfo, r.UserData]) add(f);
  for (const group of Object.values(r.Motions || {})) for (const m of group || []) add(m?.File), add(m?.Sound);
  for (const e of r.Expressions || []) add(e?.File);
  return out;
}

export function safeRel(rel) {
  const s = String(rel || '');
  const parts = s.replaceAll('\\', '/').split('/');
  if (!s || s.startsWith('/') || /^[a-z]:/i.test(s) || parts.some((p) => p === '..' || p === '')) throw new Error(`Unsafe path in model: ${rel}`);
  return parts;
}

// Modelos hechos en Windows a veces nombran «hiyori_m01» un archivo que se llama «Hiyori_m01»: en
// un servidor web eso es un 404. Variante con la inicial del nombre en mayúscula y en minúscula.
export function caseVariants(rel) {
  const parts = safeRel(rel);
  const base = parts.at(-1);
  const head = parts.slice(0, -1);
  return [...new Set([base[0].toUpperCase() + base.slice(1), base[0].toLowerCase() + base.slice(1)])].filter((b) => b !== base).map((b) => [...head, b].join('/'));
}

// Cambia en el .model3.json las rutas renombradas y quita las que no se encontraron.
export function rewriteModel3(json, renamed = {}, dropped = new Set()) {
  const r = json.FileReferences || {};
  const fix = (f) => renamed[f] || f;
  for (const k of ['Physics', 'Pose', 'DisplayInfo', 'UserData']) {
    if (dropped.has(r[k])) delete r[k];
    else if (r[k]) r[k] = fix(r[k]);
  }
  for (const [name, group] of Object.entries(r.Motions || {})) {
    r.Motions[name] = (group || [])
      .filter((m) => !dropped.has(m?.File))
      .map((m) => {
        const out = { ...m, File: fix(m.File) };
        if (m.Sound && dropped.has(m.Sound)) delete out.Sound;
        else if (m.Sound) out.Sound = fix(m.Sound);
        return out;
      });
    if (!r.Motions[name].length) delete r.Motions[name];
  }
  if (r.Expressions) r.Expressions = r.Expressions.filter((e) => !dropped.has(e?.File)).map((e) => ({ ...e, File: fix(e.File) }));
  return json;
}

// Descarga un modelo con fetch: get(url) → Buffer o lanza un error con .status.
// Devuelve { name, main (Buffer del model3.json corregido), files: [[ruta, Buffer]] }.
export async function fetchLive2dModel(modelUrl, get, { onProgress = () => {}, maxBytes = 300 * 1024 * 1024, concurrency = 4 } = {}) {
  const json = JSON.parse((await get(modelUrl)).toString('utf8'));
  const list = model3Files(json);
  if (!list.length || list.length > 2000) throw new Error('Not a Live2D model3.json.');
  const urlOf = (rel) => new URL(safeRel(rel).map(encodeURIComponent).join('/'), modelUrl).href;
  const files = [];
  const renamed = {};
  const dropped = new Set();
  let total = 0;
  let done = 0;
  const queue = [...list];
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      let rel = item.file;
      let buf = null;
      let lastErr = null;
      for (const candidate of [rel, ...caseVariants(rel)]) {
        try {
          buf = await get(urlOf(candidate));
          if (candidate !== rel) renamed[rel] = candidate;
          rel = candidate;
          break;
        } catch (e) {
          lastErr = e;
          if (e.status !== 404) break;
        }
      }
      if (!buf) {
        if (item.required || lastErr?.status !== 404) throw lastErr;
        dropped.add(item.file);
      } else {
        total += buf.length;
        if (total > maxBytes) throw new Error('Model too large.');
        files.push([rel, buf]);
      }
      onProgress(++done / list.length);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  const name = decodeURIComponent(new URL(modelUrl).pathname.split('/').pop());
  const main = Buffer.from(JSON.stringify(rewriteModel3(json, renamed, dropped), null, '\t'));
  return { name, main, files, renamed, dropped: [...dropped] };
}
