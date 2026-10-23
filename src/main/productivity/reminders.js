// Recordatorios y temporizadores: lista en userData/reminders.json y un único temporizador al más
// próximo (troceado si queda a más de 24 días, el máximo de setTimeout). Las repeticiones se
// calculan en hora local, así que un «todos los días a las 9» sigue a las 9 tras el cambio de hora.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const REPEATS = ['daily', 'weekdays', 'weekly', 'monthly'];
const DAY = 24 * 3600 * 1000;
const MAX_TIMER = 24 * DAY;

const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();

// Siguiente vez después de `due`. anchorDay: día del mes original (31 → 28 en febrero → 31 en marzo).
export function nextDue(due, repeat, anchorDay = due.getDate()) {
  const d = new Date(due);
  const at = (y, m, day) => new Date(y, m, day, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
  const [y, m, day] = [d.getFullYear(), d.getMonth(), d.getDate()];
  switch (repeat) {
    case 'daily':
      return at(y, m, day + 1);
    case 'weekly':
      return at(y, m, day + 7);
    case 'weekdays': {
      let n = at(y, m, day + 1);
      while (n.getDay() === 0 || n.getDay() === 6) n = at(n.getFullYear(), n.getMonth(), n.getDate() + 1);
      return n;
    }
    case 'monthly': {
      const ty = m === 11 ? y + 1 : y;
      const tm = (m + 1) % 12;
      return at(ty, tm, Math.min(anchorDay, daysIn(ty, tm)));
    }
    default:
      throw new Error(`Unknown repeat: ${repeat}`);
  }
}

export class Reminders {
  constructor({ file, now = () => new Date(), setTimer = setTimeout, clearTimer = clearTimeout, onFire, onChange = () => {} }) {
    Object.assign(this, { file, now, setTimer, clearTimer, onFire, onChange });
    this.items = [];
    this.timer = null;
  }

  load() {
    let raw = [];
    try {
      raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch (e) {
      if (e.code !== 'ENOENT' && fs.existsSync(this.file)) fs.renameSync(this.file, `${this.file}.bad`);
    }
    this.items = (Array.isArray(raw) ? raw : []).filter((r) => r && typeof r.id === 'string' && typeof r.text === 'string' && !Number.isNaN(Date.parse(r.due)));
    return this;
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.items, null, 2));
    fs.renameSync(tmp, this.file);
    this.onChange(this.list());
  }

  list() {
    return this.items.map((r) => ({ ...r })).sort((a, b) => Date.parse(a.due) - Date.parse(b.due));
  }

  add({ text, due, repeat = null }) {
    const when = new Date(due);
    if (!String(text || '').trim()) throw new Error('A reminder needs a text');
    if (Number.isNaN(when.getTime())) throw new Error('Invalid date');
    if (repeat && !REPEATS.includes(repeat)) throw new Error(`repeat must be one of: ${REPEATS.join(', ')}`);
    const r = { id: crypto.randomUUID().slice(0, 8), text: String(text).trim(), due: when.toISOString(), repeat: repeat || null, created: this.now().toISOString() };
    if (repeat === 'monthly') r.day = when.getDate();
    this.items.push(r);
    this.save();
    this.schedule();
    return { ...r };
  }

  cancel(id) {
    const before = this.items.length;
    this.items = this.items.filter((r) => r.id !== id);
    if (this.items.length === before) return false;
    this.save();
    this.schedule();
    return true;
  }

  // Vencidos al arrancar: < 24 h → aviso «con retraso»; más viejos → se descartan (o se reprograman).
  start() {
    this.load();
    const now = this.now();
    for (const r of [...this.items]) {
      const due = new Date(r.due);
      if (due > now) continue;
      if (now - due < DAY) this.onFire({ ...r }, { late: true });
      this.#advance(r, now);
    }
    this.save();
    this.schedule();
    return this;
  }

  stop() {
    if (this.timer) this.clearTimer(this.timer);
    this.timer = null;
  }

  #advance(r, now) {
    if (!r.repeat) {
      this.items = this.items.filter((x) => x !== r);
      return;
    }
    let d = new Date(r.due);
    while (d <= now) d = nextDue(d, r.repeat, r.day);
    r.due = d.toISOString();
  }

  #tick() {
    this.timer = null;
    const now = this.now();
    const due = this.items.filter((r) => Date.parse(r.due) <= now.getTime());
    for (const r of due) {
      this.#advance(r, now);
      try {
        this.onFire({ ...r }, { late: false });
      } catch {
        /* un aviso que falla no para los demás */
      }
    }
    if (due.length) this.save();
    this.schedule();
  }

  schedule() {
    this.stop();
    if (!this.items.length) return;
    const next = Math.min(...this.items.map((r) => Date.parse(r.due)));
    const delay = Math.min(Math.max(0, next - this.now().getTime()), MAX_TIMER);
    this.timer = this.setTimer(() => this.#tick(), delay);
  }
}
