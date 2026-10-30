// Uso de tokens por perfil y día (userData/usage.json), con coste estimado si pones el precio de
// cada modelo en su perfil (dólares por millón de tokens de entrada y de salida).
import { readJson, writeJson, dayKey } from './json-file.js';

const KEEP_DAYS = 400;

// Anthropic: input_tokens, output_tokens, cache_*; OpenAI: prompt_tokens, completion_tokens.
export function normalizeUsage(u = {}) {
  const cacheRead = Number(u.cache_read_input_tokens || u.prompt_tokens_details?.cached_tokens || 0);
  const cacheWrite = Number(u.cache_creation_input_tokens || 0);
  const anthropic = u.input_tokens != null;
  const input = anthropic ? Number(u.input_tokens || 0) + cacheRead + cacheWrite : Number(u.prompt_tokens || 0);
  const output = Number(u.output_tokens ?? u.completion_tokens ?? 0);
  return { input, output, cacheRead, requests: input || output ? 1 : 0 };
}

const add = (a, b) => ({ input: a.input + b.input, output: a.output + b.output, cacheRead: a.cacheRead + b.cacheRead, requests: a.requests + b.requests });
const ZERO = { input: 0, output: 0, cacheRead: 0, requests: 0 };

// Precio en dólares por millón de tokens. Lo leído de caché se cobra al precio de entrada salvo
// que se indique otro (Anthropic lo cobra a una décima parte).
const hasPrice = (v) => v !== '' && v != null && Number(v) >= 0;
export function estimateCost(t, { priceIn, priceOut, priceCache } = {}) {
  if (!hasPrice(priceIn) && !hasPrice(priceOut)) return null;
  const pin = hasPrice(priceIn) ? Number(priceIn) : 0;
  const pout = hasPrice(priceOut) ? Number(priceOut) : 0;
  const pc = hasPrice(priceCache) ? Number(priceCache) : pin;
  return ((t.input - t.cacheRead) * pin + t.cacheRead * pc + t.output * pout) / 1e6;
}

export class UsageLog {
  constructor({ file, now = () => new Date() }) {
    Object.assign(this, { file, now });
    const raw = readJson(file, {});
    this.days = raw && typeof raw.days === 'object' ? raw.days : {};
    this.dirty = false;
    this.timer = null;
  }

  record(profileId, model, usage) {
    const u = normalizeUsage(usage);
    if (!u.requests) return null;
    const key = dayKey(this.now());
    const day = (this.days[key] ||= {});
    const id = `${profileId}|${model}`;
    day[id] = add(day[id] || ZERO, u);
    this.#scheduleSave();
    return u;
  }

  #scheduleSave() {
    this.dirty = true;
    if (this.timer) return;
    this.timer = setTimeout(() => this.flush(), 2000);
    this.timer.unref?.();
  }

  flush() {
    clearTimeout(this.timer);
    this.timer = null;
    if (!this.dirty) return;
    const keys = Object.keys(this.days).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - KEEP_DAYS))) delete this.days[k];
    writeJson(this.file, { days: this.days });
    this.dirty = false;
  }

  // Totales por perfil y modelo en tres periodos: hoy, últimos 7 días y este mes.
  summary(profiles = []) {
    const now = this.now();
    const today = dayKey(now);
    const weekStart = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
    const monthStart = dayKey(new Date(now.getFullYear(), now.getMonth(), 1));
    const rows = new Map();
    for (const [day, entries] of Object.entries(this.days)) {
      for (const [id, t] of Object.entries(entries)) {
        const [profileId, ...rest] = id.split('|');
        const row = rows.get(id) || { profileId, model: rest.join('|'), today: ZERO, week: ZERO, month: ZERO };
        if (day === today) row.today = add(row.today, t);
        if (day >= weekStart) row.week = add(row.week, t);
        if (day >= monthStart) row.month = add(row.month, t);
        rows.set(id, row);
      }
    }
    const byId = new Map(profiles.map((p) => [p.id, p]));
    return [...rows.values()]
      .filter((r) => r.month.requests || r.week.requests)
      .map((r) => {
        const p = byId.get(r.profileId) || {};
        return {
          ...r,
          name: p.name || r.profileId,
          cost: { today: estimateCost(r.today, p), week: estimateCost(r.week, p), month: estimateCost(r.month, p) },
        };
      })
      .sort((a, b) => b.month.input + b.month.output - (a.month.input + a.month.output));
  }

  reset() {
    this.days = {};
    this.dirty = true;
    this.flush();
  }
}
