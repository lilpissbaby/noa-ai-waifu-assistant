// Webhooks definidos por el usuario (n8n, Make, Home Assistant, scripts propios...). Cada uno es una herramienta.
import { getSecret } from '../config.js';
import { jsonRequest, slug, compact } from './util.js';
import { t } from '../../shared/i18n/index.js';

export function webhookTools(cfg) {
  return (cfg.connectors.webhooks || [])
    .filter((w) => w.enabled !== false && w.url && w.name)
    .map((w) => {
      let extraHeaders = {};
      try {
        extraHeaders = w.headersJson ? JSON.parse(w.headersJson) : {};
      } catch {
        /* cabeceras mal formadas: se ignoran */
      }
      const token = getSecret(`webhook:${w.id}`);
      if (token) extraHeaders.authorization = token.startsWith('Bearer ') || token.includes(' ') ? token : `Bearer ${token}`;
      return {
        name: `webhook_${slug(w.name)}`.slice(0, 60),
        group: "trigger the user's automations (webhooks)",
        description: `${w.description || `Webhook "${w.name}"`} (${w.method || 'POST'} to one of the user's automations).`,
        schema: {
          type: 'object',
          properties: { payload: { type: 'object', description: 'JSON data sent to the webhook', additionalProperties: true } },
        },
        confirm: w.confirm
          ? (i) => ({ title: `Webhook ${w.name}`, message: t('confirm.webhook', { name: w.name }), detail: JSON.stringify(i.payload || {}, null, 1).slice(0, 800), allowAlways: true })
          : undefined,
        run: async ({ payload }, { signal }) => {
          const method = (w.method || 'POST').toUpperCase();
          let url = w.url;
          let body;
          if (method === 'GET') {
            const q = new URLSearchParams(Object.entries(payload || {}).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
            if ([...q].length) url += (url.includes('?') ? '&' : '?') + q;
          } else body = payload || {};
          const data = await jsonRequest(url, { method, headers: extraHeaders, body, signal, timeoutMs: 120000, label: `Webhook ${w.name}` });
          return compact(data ?? 'OK');
        },
      };
    });
}
