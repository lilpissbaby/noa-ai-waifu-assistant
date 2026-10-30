// Mandar un aviso al móvil del usuario (ntfy, Telegram o Gotify; Ajustes → Conectores → Móvil).
import { sendPush } from '../productivity/push.js';
import { getSecret } from '../config.js';

export function phoneTools(cfg, services = {}) {
  const push = cfg.connectors?.push;
  if (!push || push.provider === 'none' || !push.provider) return [];
  return [
    {
      name: 'phone_notify',
      group: "send notifications to the user's phone",
      description:
        "Sends a push notification to the user's own phone. Use it when they ask to be notified on the phone (\"send me the list to my phone\", \"let me know on the phone when Hermes finishes\"). priority: low | default | high | urgent.",
      schema: {
        type: 'object',
        properties: { message: { type: 'string' }, title: { type: 'string' }, priority: { type: 'string', enum: ['low', 'default', 'high', 'urgent'] }, url: { type: 'string', description: 'Optional link to open when tapped.' } },
        required: ['message'],
      },
      run: async ({ message, title, priority, url }) => {
        const via = await sendPush(push, getSecret('push'), { message, title, priority, click: /^https?:\/\//i.test(url || '') ? url : '' }, services.fetchImpl ? { fetchImpl: services.fetchImpl } : {});
        return `Sent to the phone (${via}).`;
      },
    },
  ];
}
