import { net } from 'electron';
import { t } from '../../shared/i18n/index.js';

// Recorta objetos grandes para no saturar el contexto del modelo.
export function compact(value, depth = 0) {
  if (value == null) return undefined;
  if (typeof value === 'string') return value.length > 1500 ? `${value.slice(0, 1500)}…` : value;
  if (typeof value !== 'object') return value;
  if (depth > 4) return '…';
  if (Array.isArray(value)) {
    const arr = value.slice(0, 50).map((v) => compact(v, depth + 1));
    if (value.length > 50) arr.push(`…(${value.length - 50} more)`);
    return arr;
  }
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    const c = compact(v, depth + 1);
    if (c === undefined || (Array.isArray(c) && !c.length) || (typeof c === 'object' && c && !Array.isArray(c) && !Object.keys(c).length)) continue;
    out[k] = c;
  }
  return out;
}

export function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj?.[k] != null) out[k] = obj[k];
  return out;
}

export async function jsonRequest(url, { method = 'GET', headers = {}, body, signal, timeoutMs = 60000, label = 'HTTP' } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error('timeout')), timeoutMs);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await net.fetch(url, {
      method,
      headers: { accept: 'application/json', ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      /* texto plano */
    }
    if (!res.ok) {
      const msg = typeof data === 'object' && data ? data.error?.message || data.error || data.message || JSON.stringify(data) : text;
      const err = new Error(`${label} ${res.status}: ${String(msg).slice(0, 500)}`);
      err.status = res.status;
      throw err;
    }
    return data;
  } catch (e) {
    if (ctrl.signal.aborted && !signal?.aborted) throw new Error(t('errors.timeout', { label }), { cause: e });
    throw e;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export const slug = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || 'x';
