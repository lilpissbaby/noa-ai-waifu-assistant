// Modo concentración (técnica Pomodoro): bloques de trabajo con descansos cortos y, cada N
// bloques, uno largo. Mientras dura un bloque de trabajo, los avisos pueden ir solo al bocadillo
// («no molestar»). Las estadísticas por día viven en userData/focus.json.
import { readJson, writeJson, dayKey } from './json-file.js';

export const FOCUS_DEFAULTS = { work: 25, short: 5, long: 15, every: 4, autoContinue: true, dnd: true };
const KEEP_DAYS = 90;

const minutesOf = (v, def, max) => {
  const n = Number(v);
  return n > 0 ? Math.min(max, n) : def;
};

export function focusSettings(s = {}) {
  return {
    work: minutesOf(s.work, FOCUS_DEFAULTS.work, 240),
    short: minutesOf(s.short, FOCUS_DEFAULTS.short, 60),
    long: minutesOf(s.long, FOCUS_DEFAULTS.long, 120),
    every: Math.max(1, Math.round(minutesOf(s.every, FOCUS_DEFAULTS.every, 12))),
    autoContinue: s.autoContinue !== false,
    dnd: s.dnd !== false,
  };
}

export class Focus {
  // onPhase(phase, info): phase = work | short | long | off; info = { label, minutes, reason }
  constructor({ file, settings = () => ({}), onPhase = () => {}, onChange = () => {}, now = () => new Date(), setTimer = setTimeout, clearTimer = clearTimeout }) {
    Object.assign(this, { file, settings, onPhase, onChange, now, setTimer, clearTimer });
    const raw = readJson(file, {});
    this.stats = raw && typeof raw.days === 'object' ? raw : { days: {} };
    this.state = { phase: 'off', label: '', startedAt: null, endsAt: null, cycle: 0, minutes: 0 };
    this.timer = null;
  }

  get active() {
    return this.state.phase !== 'off';
  }

  // ¿Hay que silenciar los avisos ahora mismo?
  get quiet() {
    return this.state.phase === 'work' && focusSettings(this.settings()).dnd;
  }

  #record(minutes, session) {
    const key = dayKey(this.now());
    const d = this.stats.days[key] || { sessions: 0, minutes: 0 };
    d.minutes = Math.round((d.minutes + minutes) * 10) / 10;
    if (session) d.sessions += 1;
    this.stats.days[key] = d;
    const keys = Object.keys(this.stats.days).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - KEEP_DAYS))) delete this.stats.days[k];
    writeJson(this.file, this.stats);
  }

  #enter(phase, minutes, reason) {
    this.clearTimer(this.timer);
    this.timer = null;
    const now = this.now();
    if (phase === 'off') this.state = { ...this.state, phase: 'off', startedAt: null, endsAt: null, minutes: 0 };
    else {
      this.state = { ...this.state, phase, startedAt: now.toISOString(), endsAt: new Date(now.getTime() + minutes * 60000).toISOString(), minutes };
      this.timer = this.setTimer(() => this.#finish(), minutes * 60000);
    }
    this.onChange(this.status());
    this.onPhase(phase, { label: this.state.label, minutes, reason, cycle: this.state.cycle });
  }

  #finish() {
    const s = focusSettings(this.settings());
    const { phase } = this.state;
    if (phase === 'work') {
      this.#record(this.state.minutes, true);
      this.state.cycle += 1;
      const long = this.state.cycle % s.every === 0;
      this.#enter(long ? 'long' : 'short', long ? s.long : s.short, 'workDone');
    } else if (phase === 'short' || phase === 'long') {
      if (s.autoContinue) this.#enter('work', s.work, 'breakDone');
      else this.#enter('off', 0, 'breakDone');
    }
  }

  start({ minutes, label = '' } = {}) {
    const s = focusSettings(this.settings());
    if (this.state.phase === 'work') this.#recordPartial();
    if (this.state.phase === 'off') this.state.cycle = 0;
    this.state.label = String(label || '').trim().slice(0, 80);
    this.#enter('work', minutesOf(minutes, s.work, 240), 'start');
    return this.status();
  }

  #recordPartial() {
    if (this.state.phase !== 'work' || !this.state.startedAt) return;
    const done = (this.now() - new Date(this.state.startedAt)) / 60000;
    if (done >= 1) this.#record(Math.min(done, this.state.minutes), false);
  }

  // Termina la sesión (lo trabajado de un bloque a medias también cuenta).
  stop() {
    if (!this.active) return this.status();
    this.#recordPartial();
    this.state.cycle = 0;
    this.#enter('off', 0, 'stopped');
    return this.status();
  }

  // Salta a la siguiente fase (acabar el bloque o el descanso antes de tiempo).
  skip() {
    if (!this.active) return this.status();
    if (this.state.phase === 'work') {
      const done = (this.now() - new Date(this.state.startedAt)) / 60000;
      this.state.minutes = Math.max(0, Math.min(done, this.state.minutes));
    }
    this.#finish();
    return this.status();
  }

  today() {
    return { sessions: 0, minutes: 0, ...(this.stats.days[dayKey(this.now())] || {}) };
  }

  // Minutos y bloques de los últimos `days` días (incluido hoy), del más antiguo al más nuevo.
  history(days = 7) {
    const now = this.now();
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const key = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
      out.push({ day: key, sessions: 0, minutes: 0, ...(this.stats.days[key] || {}) });
    }
    return out;
  }

  status() {
    const { phase, label, endsAt, cycle } = this.state;
    const remainingSec = endsAt ? Math.max(0, Math.round((new Date(endsAt) - this.now()) / 1000)) : 0;
    return { phase, label, endsAt, remainingSec, cycle, today: this.today() };
  }

  dispose() {
    this.clearTimer(this.timer);
    this.timer = null;
  }
}
