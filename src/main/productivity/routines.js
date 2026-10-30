// Rutinas: peticiones a la asistente que se ejecutan solas a una hora y unos días («cada lunes a
// las 9, pregúntale a Hermes por las copias y dime qué tal»). Se guardan en la config
// (productivity.routines) y la última ejecución de cada una en userData/routines.json.
import crypto from 'node:crypto';
import { readJson, writeJson, dayKey } from './json-file.js';

export const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];
const DAY_SETS = { daily: ALL_DAYS, weekdays: [1, 2, 3, 4, 5], weekends: [6, 7] };
// Una rutina que no se ejecutó a su hora (app cerrada, otra respuesta en curso) se recupera
// durante este margen; pasado, se espera al siguiente día que toque.
export const ROUTINE_GRACE_MS = 30 * 60000;

export function normalizeTime(time) {
  const m = String(time ?? '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) throw new Error(`Invalid time "${time}". Use HH:MM (24 h).`);
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

// «weekdays», [1,3,5], «1,3,5», «mon,wed»… → [1..7] (1 = lunes).
export function normalizeDays(days) {
  if (days == null || days === '') return [...ALL_DAYS];
  if (typeof days === 'string' && DAY_SETS[days.trim().toLowerCase()]) return [...DAY_SETS[days.trim().toLowerCase()]];
  const names = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const list = (Array.isArray(days) ? days : String(days).split(/[\s,;]+/)).filter((x) => x !== '');
  const out = list.map((d) => {
    const n = typeof d === 'number' ? d : /^\d$/.test(String(d)) ? Number(d) : names.indexOf(String(d).slice(0, 3).toLowerCase()) + 1;
    if (!(n >= 1 && n <= 7)) throw new Error(`Invalid day "${d}". Use 1-7 (1 = Monday), mon..sun, daily, weekdays or weekends.`);
    return n;
  });
  if (!out.length) throw new Error('A routine needs at least one day.');
  return [...new Set(out)].sort();
}

export function makeRoutine({ name, prompt, time, days, enabled = true }, id = crypto.randomBytes(4).toString('hex')) {
  const n = String(name ?? '').trim().slice(0, 80);
  const p = String(prompt ?? '').trim().slice(0, 4000);
  if (!n) throw new Error('A routine needs a name.');
  if (!p) throw new Error('A routine needs a prompt: what the assistant has to do.');
  return { id, name: n, prompt: p, time: normalizeTime(time), days: normalizeDays(days), enabled: enabled !== false };
}

export function routineDue(now, routine, lastRunDay) {
  if (!routine?.enabled) return false;
  if (!(routine.days || []).includes(now.getDay() || 7)) return false;
  if (lastRunDay === dayKey(now)) return false;
  const [h, m] = String(routine.time || '09:00').split(':').map(Number);
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h || 0, m || 0);
  return now >= at && now - at < ROUTINE_GRACE_MS;
}

export const ROUTINE_PROMPT = (routine, date) =>
  `[Scheduled routine "${routine.name}" — ${date}] The user set this up to run automatically. Do it now, using whatever tools you need:\n\n${routine.prompt}\n\nThen give the user a short report (two to five sentences) in their language. Do not mention that this was an automatic request.`;

// Última ejecución de cada rutina (por id).
export class RoutineLog {
  constructor(file) {
    this.file = file;
    const raw = readJson(file, {});
    this.last = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  }
  lastRun(id) {
    return this.last[id]?.day || null;
  }
  info(id) {
    return this.last[id] || null;
  }
  mark(id, now, result = '') {
    this.last[id] = { day: dayKey(now), at: now.toISOString(), result: String(result || '').slice(0, 600) };
    writeJson(this.file, this.last);
  }
  // Quita lo de rutinas que ya no existen.
  prune(ids) {
    const keep = new Set(ids);
    let changed = false;
    for (const id of Object.keys(this.last))
      if (!keep.has(id)) {
        delete this.last[id];
        changed = true;
      }
    if (changed) writeJson(this.file, this.last);
  }
}

// Las rutinas que tocan ahora, en orden de hora.
export function dueRoutines(now, routines, log) {
  return (routines || []).filter((r) => routineDue(now, r, log.lastRun(r.id))).sort((a, b) => a.time.localeCompare(b.time));
}
