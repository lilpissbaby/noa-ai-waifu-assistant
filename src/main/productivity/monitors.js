// Monitor de servicios: comprueba cada pocos minutos una lista de webs o APIs (las de tu VPS, tu
// router, tu Home Assistant…) y avisa cuando una se cae o vuelve. Para no avisar por un fallo
// suelto, una caída se da por buena tras dos comprobaciones fallidas seguidas.
import { net } from 'electron';
import crypto from 'node:crypto';
import { readJson, writeJson } from './json-file.js';

export const FAILS_TO_DOWN = 2;

export function normalizeMonitor({ name, url, keyword = '' }, id = crypto.randomBytes(4).toString('hex')) {
  const u = String(url || '').trim();
  if (!/^https?:\/\/[^\s/]+/i.test(u)) throw new Error('A monitor needs an http(s) URL.');
  return { id, name: String(name || '').trim().slice(0, 60) || new URL(u).host, url: u, keyword: String(keyword || '').trim().slice(0, 120) };
}

// { up, status, ms, error }
export async function checkUrl(m, { fetchImpl = net.fetch, timeoutMs = 10000, now = () => Date.now() } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = now();
  try {
    const res = await fetchImpl(m.url, { method: 'GET', redirect: 'follow', headers: { 'user-agent': 'WaifuDesk-monitor', 'cache-control': 'no-cache' }, signal: ctrl.signal });
    let ok = res.status < 400;
    let error;
    if (ok && m.keyword) {
      const body = await res.text();
      ok = body.includes(m.keyword);
      if (!ok) error = `"${m.keyword}" not found`;
    } else await res.body?.cancel?.().catch?.(() => {});
    return { up: ok, status: res.status, ms: now() - t0, ...(ok ? {} : { error: error || `HTTP ${res.status}` }) };
  } catch (e) {
    return { up: false, status: 0, ms: now() - t0, error: ctrl.signal.aborted ? `timeout (${Math.round(timeoutMs / 1000)} s)` : e.cause?.code || e.message };
  } finally {
    clearTimeout(timer);
  }
}

export class Monitors {
  // onChange(monitor, 'down' | 'up', result)
  constructor({ file, list = () => [], check = (m) => checkUrl(m), onChange = () => {}, onUpdate = () => {}, now = () => new Date() }) {
    Object.assign(this, { file, list, check, onChange, onUpdate, now });
    const raw = readJson(file, {});
    this.state = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    this.running = null;
  }

  states() {
    return this.list().map((m) => ({ ...m, ...(this.state[m.id] || { up: null }) }));
  }

  async checkOne(m) {
    const r = await this.check(m);
    const prev = this.state[m.id] || { up: null, fails: 0 };
    const at = this.now().toISOString();
    const fails = r.up ? 0 : (prev.fails || 0) + 1;
    let up = prev.up;
    let since = prev.since || at;
    if (r.up && prev.up !== true) {
      if (prev.up === false) this.onChange(m, 'up', r);
      up = true;
      since = at;
    } else if (!r.up && prev.up !== false && (fails >= FAILS_TO_DOWN || prev.up === null)) {
      // La primera vez que se mira no hay aviso: solo se apunta como caído.
      if (prev.up === true) this.onChange(m, 'down', r);
      up = false;
      since = at;
    }
    this.state[m.id] = { up, since, fails, lastCheck: at, status: r.status, ms: r.ms, error: r.error || null };
    return { ...m, ...this.state[m.id] };
  }

  runOnce() {
    if (this.running) return this.running;
    this.running = (async () => {
      const list = this.list();
      const results = await Promise.all(list.map((m) => this.checkOne(m).catch((e) => ({ ...m, up: null, error: e.message }))));
      const ids = new Set(list.map((m) => m.id));
      for (const id of Object.keys(this.state)) if (!ids.has(id)) delete this.state[id];
      writeJson(this.file, this.state);
      this.onUpdate(this.states());
      return results;
    })().finally(() => {
      this.running = null;
    });
    return this.running;
  }
}
