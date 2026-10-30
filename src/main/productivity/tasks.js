// Lista de tareas pendientes (to-do): título, notas, fecha límite, prioridad y proyecto.
// Vive en userData/tasks.json. Las fechas se guardan como hora local: «2026-10-30» (todo el día)
// o «2026-10-30T18:00».
import crypto from 'node:crypto';
import { readJson, writeJson, dayKey } from './json-file.js';

export const PRIORITIES = ['low', 'normal', 'high'];
export const TASK_FILTERS = ['open', 'done', 'all', 'today', 'overdue', 'week'];
const RANK = { high: 0, normal: 1, low: 2 };
const MAX_TASKS = 2000;

// Acepta «2026-10-30», «2026-10-30T18:00», «2026-10-30 18:00» o vacío (sin fecha).
export function normalizeDue(due) {
  if (due == null || due === '') return null;
  const s = String(due).trim().replace(' ', 'T');
  const m = s.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/);
  if (!m) throw new Error(`Invalid due date "${due}". Use YYYY-MM-DD or YYYY-MM-DDTHH:MM (local time).`);
  const d = new Date(m[2] ? `${m[1]}T${m[2]}` : `${m[1]}T00:00`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid due date "${due}".`);
  return m[2] ? `${m[1]}T${m[2]}` : m[1];
}

// Momento a partir del cual una tarea está vencida: el final del día o la hora exacta.
export function dueMoment(due) {
  if (!due) return null;
  return due.length === 10 ? new Date(`${due}T23:59:59.999`) : new Date(due);
}

export function normalizePriority(p) {
  if (p == null || p === '') return 'normal';
  const v = String(p).toLowerCase();
  if (!PRIORITIES.includes(v)) throw new Error(`priority must be one of: ${PRIORITIES.join(', ')}`);
  return v;
}

const clean = (s, max) => String(s ?? '').trim().slice(0, max);

export class Tasks {
  constructor({ file, now = () => new Date(), onChange = () => {} }) {
    Object.assign(this, { file, now, onChange });
    const raw = readJson(file, []);
    this.items = Array.isArray(raw) ? raw.filter((x) => x && typeof x.id === 'string' && typeof x.title === 'string') : [];
  }

  #save() {
    writeJson(this.file, this.items);
    this.onChange(this.list({ filter: 'all' }));
  }

  get(id) {
    const t = this.items.find((x) => x.id === String(id));
    return t ? { ...t } : null;
  }

  // filter: open | done | all | today (pendientes de hoy o vencidas) | overdue | week (próximos 7 días)
  list({ filter = 'open', project = '', query = '' } = {}) {
    if (!TASK_FILTERS.includes(filter)) throw new Error(`filter must be one of: ${TASK_FILTERS.join(', ')}`);
    const now = this.now();
    const today = dayKey(now);
    const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59);
    const q = String(query || '').toLowerCase();
    const proj = String(project || '').toLowerCase();
    const out = this.items.filter((t) => {
      if (filter === 'done' && !t.done) return false;
      if (filter !== 'done' && filter !== 'all' && t.done) return false;
      const due = dueMoment(t.due);
      if (filter === 'overdue' && !(due && due < now)) return false;
      if (filter === 'today' && !(t.due && (t.due.slice(0, 10) <= today))) return false;
      if (filter === 'week' && !(due && due <= weekEnd)) return false;
      if (proj && String(t.project || '').toLowerCase() !== proj) return false;
      if (q && !`${t.title}\n${t.notes || ''}\n${t.project || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return out
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        if (a.done) return String(b.doneAt || '').localeCompare(String(a.doneAt || ''));
        const r = RANK[a.priority] - RANK[b.priority];
        if (r) return r;
        const da = dueMoment(a.due);
        const db = dueMoment(b.due);
        if (da && db && da - db) return da - db;
        if (da && !db) return -1;
        if (db && !da) return 1;
        return String(a.created).localeCompare(String(b.created));
      })
      .map((t) => ({ ...t, overdue: !t.done && !!t.due && dueMoment(t.due) < now }));
  }

  projects() {
    return [...new Set(this.items.filter((t) => !t.done && t.project).map((t) => t.project))].sort();
  }

  add({ title, notes = '', due = null, priority = 'normal', project = '' }) {
    const ttl = clean(title, 300);
    if (!ttl) throw new Error('A task needs a title.');
    if (this.items.length >= MAX_TASKS) throw new Error('Too many tasks: delete some done tasks first.');
    const task = {
      id: crypto.randomBytes(4).toString('hex'),
      title: ttl,
      notes: clean(notes, 4000),
      due: normalizeDue(due),
      priority: normalizePriority(priority),
      project: clean(project, 60),
      done: false,
      created: this.now().toISOString(),
      doneAt: null,
    };
    this.items.push(task);
    this.#save();
    return { ...task };
  }

  update(id, patch = {}) {
    const t = this.items.find((x) => x.id === String(id));
    if (!t) throw new Error(`No task with id ${id}. Use task_list to see the ids.`);
    if (patch.title !== undefined) {
      const ttl = clean(patch.title, 300);
      if (!ttl) throw new Error('The title cannot be empty.');
      t.title = ttl;
    }
    if (patch.notes !== undefined) t.notes = clean(patch.notes, 4000);
    if (patch.due !== undefined) t.due = normalizeDue(patch.due);
    if (patch.priority !== undefined) t.priority = normalizePriority(patch.priority);
    if (patch.project !== undefined) t.project = clean(patch.project, 60);
    if (patch.done !== undefined) {
      t.done = Boolean(patch.done);
      t.doneAt = t.done ? this.now().toISOString() : null;
    }
    this.#save();
    return { ...t };
  }

  complete(id, done = true) {
    return this.update(id, { done });
  }

  remove(id) {
    const before = this.items.length;
    this.items = this.items.filter((x) => x.id !== String(id));
    if (this.items.length === before) return false;
    this.#save();
    return true;
  }

  clearDone() {
    const before = this.items.length;
    this.items = this.items.filter((x) => !x.done);
    if (this.items.length !== before) this.#save();
    return before - this.items.length;
  }

  // Resumen para el resumen diario y la bandeja.
  counts() {
    const now = this.now();
    const open = this.items.filter((t) => !t.done);
    return {
      open: open.length,
      overdue: open.filter((t) => t.due && dueMoment(t.due) < now).length,
      today: open.filter((t) => t.due && t.due.slice(0, 10) === dayKey(now)).length,
    };
  }
}
