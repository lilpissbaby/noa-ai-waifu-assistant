// Delegar tareas a Hermes Agent (Nous Research) corriendo en el VPS con su API server activado.
// En el VPS: ~/.hermes/.env -> API_SERVER_ENABLED=true, API_SERVER_KEY=..., (API_SERVER_HOST=0.0.0.0) y `hermes gateway`.
import { net } from 'electron';
import { readSSE, httpError } from '../llm/sse.js';
import { getSecret } from '../config.js';
import { t } from '../../shared/i18n/index.js';
import { assistantName } from '../../shared/personas.js';

// services.runBackground(etiqueta, () => promesa): tareas largas que avisan al terminar.
export function hermesTools(cfg, services = {}) {
  const h = cfg.connectors.hermes;
  if (!h?.enabled || !h.baseUrl) return [];
  return [
    {
      name: 'hermes_task',
      group: "delegate long tasks to the Hermes agent on the user's VPS (it has its own terminal, browser, memory and skills)",
      description:
        "Sends a task to the Hermes agent running on the user's VPS and waits for its answer. Hermes can run commands on the server, browse the web, schedule jobs and remember things across sessions. Use it for work that must happen on the server or for long research/automation tasks. Describe the task in a self-contained way. With background: true it returns immediately and the user is notified (chat, bubble, notification) when Hermes finishes: use it for tasks that may take minutes.",
      schema: {
        type: 'object',
        properties: {
          task: { type: 'string', description: 'Complete, self-contained instruction for Hermes' },
          context: { type: 'string', description: 'Optional extra context (data, paths, preferences)' },
          background: { type: 'boolean', description: 'Run in the background and notify the user when done' },
        },
        required: ['task'],
      },
      run: async ({ task, context, background }, { signal, progress } = {}) => {
        if (background && services.runBackground) {
          services.runBackground(`Hermes · ${String(task).slice(0, 60)}`, () => askHermes(h, cfg, { task, context }, {}));
          return 'Started in background; the user will be notified when Hermes answers.';
        }
        return askHermes(h, cfg, { task, context }, { signal, progress });
      },
    },
  ];
}

async function askHermes(h, cfg, { task, context }, { signal, progress }) {
  const base = h.baseUrl.replace(/\/+$/, '');
  const key = getSecret('hermes');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), (h.timeoutSec || 900) * 1000);
  signal?.addEventListener('abort', () => ctrl.abort());
  try {
    const res = await net.fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify({
        model: h.model || 'hermes-agent',
        stream: true,
        messages: [
          {
            role: 'system',
            content: `Request forwarded by ${assistantName(cfg)}, the user's desktop assistant. Return a clear, concise result.`,
          },
          { role: 'user', content: context ? `${task}\n\nContext:\n${context}` : task },
        ],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw await httpError(res, 'Hermes');
    const ctype = res.headers.get('content-type') || '';
    if (!ctype.includes('event-stream')) {
      const j = await res.json();
      return j.choices?.[0]?.message?.content || JSON.stringify(j);
    }
    let text = '';
    let lastPing = 0;
    for await (const evt of readSSE(res.body, ctrl.signal)) {
      if (evt.data === '[DONE]') break;
      let d;
      try {
        d = JSON.parse(evt.data);
      } catch {
        continue;
      }
      const delta = d.choices?.[0]?.delta?.content;
      if (delta) text += delta;
      // Hermes emite eventos propios de progreso de herramientas: se muestran tal cual.
      const toolNote = d.tool || d.tool_name || d.event || (evt.event !== 'message' ? evt.event : null);
      const now = Date.now();
      if (now - lastPing > 700) {
        lastPing = now;
        progress?.(toolNote ? `Hermes: ${toolNote}` : text.length ? t('hermes.workingChars', { count: text.length }) : t('state.tool.hermes'));
      }
    }
    return text || '(Hermes returned no text)';
  } catch (e) {
    if (ctrl.signal.aborted && !signal?.aborted) throw new Error(t('hermes.timeout'), { cause: e });
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function testHermes(h) {
  const base = h.baseUrl.replace(/\/+$/, '');
  const key = getSecret('hermes');
  const res = await net.fetch(`${base}/models`, { headers: key ? { authorization: `Bearer ${key}` } : {} });
  if (!res.ok) throw await httpError(res, 'Hermes /models');
  const j = await res.json();
  return t('hermes.connected', { models: (j.data || []).map((m) => m.id).join(', ') || t('common.none') });
}
