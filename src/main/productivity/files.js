// Archivos del usuario, solo dentro de las carpetas que autorizó (productivity.folders).
// Toda ruta pasa por resolveInside: se resuelven los enlaces simbólicos y se rechaza lo que salga.
import fs from 'node:fs';
import path from 'node:path';

const fail = (code, message) => Object.assign(new Error(message), { code });
export const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|jsonl|log|ini|cfg|conf|toml|ya?ml|xml|html?|css|s[ac]ss|js|mjs|cjs|jsx|ts|tsx|py|rb|go|rs|java|kt|c|h|cpp|hpp|cs|php|sh|bash|zsh|ps1|bat|sql|lua|r|swift|dart|vue|svelte|env|gitignore|dockerfile|tf|hcl|srt|vtt|tex|rst|org)$/i;
const SKIP_DIRS = new Set(['node_modules', '.git', '.svn', '.hg', '__pycache__', '.venv', 'venv', '.cache', 'dist', 'build', '.next', 'target']);
const MAX_RESULTS = 50;
const MAX_VISITS = 20000;

// realpath de una ruta que quizá no existe aún: el de su antepasado existente + el resto.
function realish(p) {
  let cur = p;
  const rest = [];
  for (;;) {
    try {
      return path.join(fs.realpathSync.native(cur), ...rest.reverse());
    } catch {
      const parent = path.dirname(cur);
      if (parent === cur) return p;
      rest.push(path.basename(cur));
      cur = parent;
    }
  }
}

const inside = (root, p) => {
  const rel = path.relative(root, p);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};

export function resolveInside(roots, p) {
  const list = (roots || []).filter(Boolean);
  if (!list.length) throw fail('noRoots', 'No authorized folders');
  const raw = String(p ?? '').trim();
  const abs = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(list[0], raw);
  const real = realish(abs);
  for (const r of list) {
    const root = realish(path.resolve(r));
    if (inside(root, real)) return real;
  }
  throw fail('outside', `Path is outside the authorized folders: ${raw}`);
}

export function listDir(abs) {
  return fs
    .readdirSync(abs, { withFileTypes: true })
    .filter((e) => !e.name.startsWith('.'))
    .slice(0, 500)
    .map((e) => {
      let st = null;
      try {
        st = fs.statSync(path.join(abs, e.name));
      } catch {
        /* enlace roto */
      }
      return { name: e.name, dir: !!st?.isDirectory(), size: st && !st.isDirectory() ? st.size : undefined, mtime: st?.mtime.toISOString() };
    })
    .sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name));
}

function firstLine(file, q) {
  try {
    if (fs.statSync(file).size > 2 * 1024 * 1024) return null;
    const text = fs.readFileSync(file, 'utf8');
    const at = text.toLowerCase().indexOf(q);
    if (at < 0) return null;
    const start = text.lastIndexOf('\n', at) + 1;
    const end = text.indexOf('\n', at);
    return text.slice(start, end < 0 ? undefined : end).trim().slice(0, 200);
  } catch {
    return null;
  }
}

// Busca por nombre (cualquier archivo) y por contenido (solo texto < 2 MB). base: subcarpeta.
export function searchFiles(roots, query, base) {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return [];
  const out = [];
  let visits = 0;
  const walk = (dir, depth) => {
    if (depth > 8 || out.length >= MAX_RESULTS || visits > MAX_VISITS) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (out.length >= MAX_RESULTS || ++visits > MAX_VISITS) return;
      if (e.name.startsWith('.')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(p, depth + 1);
      } else if (e.isFile()) {
        if (e.name.toLowerCase().includes(q)) out.push({ path: p });
        else if (TEXT_EXT.test(e.name)) {
          const line = firstLine(p, q);
          if (line != null) out.push({ path: p, line });
        }
      }
    }
  };
  const starts = base ? [resolveInside(roots, base)] : roots.map((r) => realish(path.resolve(r)));
  for (const s of starts) walk(s, 0);
  return out.slice(0, MAX_RESULTS);
}
