// Memoria a largo plazo: datos sueltos sobre el usuario («su perro se llama Toby») en
// userData/memory.json. Se inyectan en el prompt de sistema, lo más reciente primero.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { userDir } from '../config.js';

const file = () => path.join(userDir(), 'memory.json');
const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ');

export function listMemory() {
  try {
    const raw = JSON.parse(fs.readFileSync(file(), 'utf8'));
    return Array.isArray(raw) ? raw.filter((m) => m && typeof m.id === 'string' && typeof m.text === 'string') : [];
  } catch {
    return [];
  }
}

function write(list) {
  fs.mkdirSync(userDir(), { recursive: true });
  fs.writeFileSync(`${file()}.tmp`, JSON.stringify(list, null, 2));
  fs.renameSync(`${file()}.tmp`, file());
}

export function saveMemory(text) {
  const clean = norm(text).slice(0, 500);
  if (!clean) throw new Error('Nothing to remember');
  const list = listMemory();
  const same = list.find((m) => norm(m.text).toLowerCase() === clean.toLowerCase());
  if (same) return same;
  const entry = { id: crypto.randomUUID().slice(0, 8), text: clean, created: new Date().toISOString() };
  write([...list, entry]);
  return entry;
}

export function forgetMemory(id) {
  const list = listMemory();
  const next = list.filter((m) => m.id !== id);
  if (next.length === list.length) return false;
  write(next);
  return true;
}

export function memoryPrompt(entries, maxChars = 2000) {
  if (!entries?.length) return '';
  const head = 'Things you know about the user (saved memories, most recent first; ids in brackets for memory_forget):';
  let out = head;
  const sorted = [...entries].sort((a, b) => Date.parse(b.created) - Date.parse(a.created));
  for (const m of sorted) {
    const line = `\n- [${m.id}] ${m.text}`;
    if (out.length + line.length > maxChars) break;
    out += line;
  }
  return out === head ? '' : out;
}
