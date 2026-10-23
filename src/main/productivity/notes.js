// Notas en Markdown dentro de una carpeta (por defecto userData/notes; puede ser la de Obsidian).
// Los títulos se sanean y ninguna ruta sale de la carpeta.
import fs from 'node:fs';
import path from 'node:path';

const MAX_RESULTS = 20;
const MAX_FILES = 3000;
const TEXT_EXT = /\.(md|markdown|txt)$/i;

export function safeTitle(title) {
  const t = [...String(title ?? '')]
    .map((c) => (c.charCodeAt(0) < 32 ? ' ' : c))
    .join('')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\.{2,}/g, '.')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 120);
  if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(t)) return `_${t}`; // nombres reservados de Windows
  return t || 'Note';
}

export function noteFile(dir, title) {
  return path.join(path.resolve(dir), `${safeTitle(title)}.md`);
}

// Lista recursiva de notas: [{ title: 'sub/carpeta/Nombre', file }]
function walk(dir) {
  const out = [];
  const root = path.resolve(dir);
  const visit = (d, depth) => {
    if (depth > 6 || out.length >= MAX_FILES) return;
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) visit(p, depth + 1);
      else if (e.isFile() && TEXT_EXT.test(e.name)) out.push({ title: path.relative(root, p).replace(TEXT_EXT, '').split(path.sep).join('/'), file: p });
    }
  };
  visit(root, 0);
  return out;
}

function find(dir, title) {
  const direct = noteFile(dir, title);
  if (fs.existsSync(direct)) return { title: safeTitle(title), file: direct };
  const want = String(title ?? '').trim().toLowerCase();
  const all = walk(dir);
  return all.find((n) => n.title.toLowerCase() === want) || all.find((n) => n.title.split('/').pop().toLowerCase() === want || n.title.split('/').pop().toLowerCase() === safeTitle(title).toLowerCase()) || null;
}

export function noteCreate(dir, { title, content = '' }) {
  fs.mkdirSync(dir, { recursive: true });
  const base = safeTitle(title);
  let name = base;
  for (let i = 2; fs.existsSync(noteFile(dir, name)); i++) name = `${base} (${i})`;
  const file = noteFile(dir, name);
  fs.writeFileSync(file, String(content), { flag: 'wx' });
  return { title: name, file };
}

export function noteAppend(dir, { title, content = '' }) {
  const hit = find(dir, title);
  if (!hit) return noteCreate(dir, { title, content });
  const prev = fs.readFileSync(hit.file, 'utf8');
  fs.writeFileSync(hit.file, prev ? `${prev.replace(/\s+$/, '')}\n\n${content}` : String(content));
  return hit;
}

export function noteRead(dir, { title }) {
  const hit = find(dir, title);
  if (!hit) throw new Error(`No note titled "${title}". Use note_search to find it.`);
  return { title: hit.title, content: fs.readFileSync(hit.file, 'utf8') };
}

export function noteSearch(dir, query) {
  const q = String(query ?? '').trim().toLowerCase();
  const all = walk(dir);
  if (!q) return all.slice(0, MAX_RESULTS).map((n) => ({ title: n.title, snippet: '' }));
  const byTitle = [];
  const byContent = [];
  for (const n of all) {
    let text;
    try {
      text = fs.readFileSync(n.file, 'utf8');
    } catch {
      continue;
    }
    const at = text.toLowerCase().indexOf(q);
    const snippet = at >= 0 ? text.slice(Math.max(0, at - 60), at + q.length + 100).replace(/\s+/g, ' ').trim() : text.slice(0, 120).replace(/\s+/g, ' ').trim();
    if (n.title.toLowerCase().includes(q)) byTitle.push({ title: n.title, snippet });
    else if (at >= 0) byContent.push({ title: n.title, snippet });
    if (byTitle.length >= MAX_RESULTS) break;
  }
  return [...byTitle, ...byContent].slice(0, MAX_RESULTS);
}
