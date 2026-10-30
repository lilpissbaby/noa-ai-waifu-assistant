// Avisos al móvil: ntfy (ntfy.sh o tu servidor), un bot de Telegram o Gotify. La asistente puede
// mandarte algo al teléfono y, si quieres, los avisos de la app (recordatorios, servicios caídos,
// CI…) te llegan también allí.
import { net } from 'electron';

export const PUSH_PROVIDERS = ['none', 'ntfy', 'telegram', 'gotify'];
export const FORWARD_MODES = ['off', 'important', 'all'];
const IMPORTANT = new Set(['reminder', 'monitor', 'ci', 'agent', 'routine', 'phone']);

export function shouldForward(mode, kind) {
  if (mode === 'all') return kind !== 'presence';
  if (mode === 'important') return IMPORTANT.has(kind);
  return false;
}

async function post(fetchImpl, url, { headers = {}, body }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ctrl.signal });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

// cfg = connectors.push; secret = token de ntfy (opcional), token del bot de Telegram o token de app de Gotify.
export async function sendPush(cfg, secret, { title = '', message, priority = 'default', click = '' }, { fetchImpl = net.fetch } = {}) {
  const msg = String(message || '').trim();
  if (!msg) throw new Error('Empty message.');
  const prio = { low: 2, default: 3, high: 4, urgent: 5 }[priority] || 3;
  switch (cfg?.provider) {
    case 'ntfy': {
      const server = String(cfg.server || 'https://ntfy.sh').replace(/\/+$/, '');
      if (!cfg.topic) throw new Error('ntfy: missing topic.');
      await post(fetchImpl, server, {
        headers: secret ? { authorization: `Bearer ${secret}` } : {},
        body: { topic: cfg.topic, message: msg.slice(0, 4000), title: String(title).slice(0, 200) || undefined, priority: prio, tags: ['sparkles'], ...(click ? { click } : {}) },
      });
      return 'ntfy';
    }
    case 'telegram': {
      if (!secret) throw new Error('Telegram: missing bot token.');
      if (!cfg.chatId) throw new Error('Telegram: missing chat id.');
      await post(fetchImpl, `https://api.telegram.org/bot${secret}/sendMessage`, {
        body: { chat_id: cfg.chatId, text: (title ? `${title}\n\n${msg}` : msg).slice(0, 4000), disable_web_page_preview: true },
      });
      return 'telegram';
    }
    case 'gotify': {
      if (!secret) throw new Error('Gotify: missing app token.');
      if (!cfg.server) throw new Error('Gotify: missing server URL.');
      await post(fetchImpl, `${String(cfg.server).replace(/\/+$/, '')}/message`, {
        headers: { 'x-gotify-key': secret },
        body: { title: String(title).slice(0, 200) || 'Waifu Desk', message: msg.slice(0, 4000), priority: prio * 2 },
      });
      return 'gotify';
    }
    default:
      throw new Error('Phone notifications are not configured (Settings → Connectors → Phone).');
  }
}
