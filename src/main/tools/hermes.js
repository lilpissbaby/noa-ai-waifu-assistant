// Delegar tareas a Hermes Agent (Nous Research) corriendo en el VPS con su API server activado.
// En el VPS: ~/.hermes/.env -> API_SERVER_ENABLED=true, API_SERVER_KEY=..., (API_SERVER_HOST=0.0.0.0) y `hermes gateway`.
import { net } from 'electron';
import { readSSE, httpError } from '../llm/sse.js';
import { getSecret } from '../config.js';

export function hermesTools(cfg) {
  const h = cfg.connectors.hermes;
  if (!h?.enabled || !h.baseUrl) return [];
  return [
    {
      name: 'hermes_task',
      group: 'delegar tareas largas al agente Hermes del VPS (tiene terminal, navegador, memoria y skills propias)',
      description:
        'Envía una tarea al agente Hermes que corre en el VPS del usuario y espera su respuesta. Hermes puede ejecutar comandos en el servidor, navegar, programar trabajos y recordar cosas entre sesiones. Úsalo para trabajo que deba hacerse en el servidor o tareas largas de investigación/automatización. Describe la tarea de forma autocontenida.',
      schema: {
        type: 'object',
        properties: {
          task: { type: 'string', description: 'Instrucción completa y autocontenida para Hermes' },
          context: { type: 'string', description: 'Contexto adicional opcional (datos, rutas, preferencias)' },
        },
        required: ['task'],
      },
      run: async ({ task, context }, { signal, progress }) => {
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
                  content: `Petición reenviada por ${cfg.assistant.name}, la asistente de escritorio del usuario. Devuelve un resultado claro y conciso.`,
                },
                { role: 'user', content: context ? `${task}\n\nContexto:\n${context}` : task },
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
              progress?.(toolNote ? `Hermes: ${toolNote}` : `Hermes trabajando… ${text.length ? `(${text.length} car.)` : ''}`);
            }
          }
          return text || '(Hermes no devolvió texto)';
        } catch (e) {
          if (ctrl.signal.aborted && !signal?.aborted) throw new Error('Hermes tardó demasiado (timeout)');
          throw e;
        } finally {
          clearTimeout(timer);
        }
      },
    },
  ];
}

export async function testHermes(h) {
  const base = h.baseUrl.replace(/\/+$/, '');
  const key = getSecret('hermes');
  const res = await net.fetch(`${base}/models`, { headers: key ? { authorization: `Bearer ${key}` } : {} });
  if (!res.ok) throw await httpError(res, 'Hermes /models');
  const j = await res.json();
  return `Conectado. Modelos: ${(j.data || []).map((m) => m.id).join(', ') || '(ninguno)'}`;
}
