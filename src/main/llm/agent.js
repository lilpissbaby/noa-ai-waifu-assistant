// Bucle de agente: llama al modelo, ejecuta herramientas y repite hasta tener respuesta final.
import os from 'node:os';
import { streamAnthropic } from './anthropic.js';
import { streamOpenAI } from './openai.js';

const MAX_STEPS = 10;

export function buildSystemPrompt(cfg, toolList) {
  const a = cfg.assistant;
  const now = new Date();
  const fecha = now.toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short' });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const groups = [...new Set(toolList.map((t) => t.group).filter(Boolean))];
  const lines = [
    `Eres ${a.name}, una asistente con forma de personaje anime que vive flotando en el escritorio del PC de ${a.userName || 'tu usuario'}.`,
    `Personalidad: ${a.personality}`,
    `Responde siempre en ${a.language} salvo que te pidan otro idioma.`,
    'Muchas de tus respuestas se leen en voz alta: sé breve y natural (1-4 frases) salvo que te pidan detalle.',
    'Cuando entregues código, comandos, listas largas o datos, ponlos en markdown; en voz solo se leerá el texto normal.',
    `Fecha y hora local: ${fecha} (${tz}). Sistema: ${os.type()} ${os.release()}.`,
  ];
  if (groups.length) {
    lines.push(
      `Tienes herramientas para: ${groups.join(', ')}. Úsalas cuando ayuden de verdad, sin pedir permiso para consultas de solo lectura.`,
      'Antes de acciones con efectos (crear o cambiar tareas, despertar agentes, ejecutar comandos, llamar webhooks) asegúrate de que la petición es clara; si es ambigua, pregunta una sola cosa.',
      'Tras usar herramientas, resume el resultado en una o dos frases; no vuelques JSON en crudo.',
    );
  }
  if (a.extraInstructions?.trim()) lines.push(a.extraInstructions.trim());
  return lines.join('\n');
}

/**
 * Ejecuta un turno completo.
 * @param {object} p
 * @param {object} p.cfg configuración
 * @param {object} p.profile perfil de modelo activo
 * @param {string} p.apiKey
 * @param {Array} p.history historial neutro (se modifica añadiendo los mensajes nuevos)
 * @param {object} p.toolbox { list: [...], run(name, input, ctx) }
 * @param {function} p.emit eventos para la UI
 * @param {AbortSignal} p.signal
 */
export async function runTurn({ cfg, profile, apiKey, history, toolbox, emit, signal }) {
  repairHistory(history);
  const useTools = profile.toolsEnabled !== false && toolbox.list.length > 0;
  const tools = useTools ? toolbox.list : [];
  const system = buildSystemPrompt(cfg, tools);
  const stream = profile.kind === 'anthropic' ? streamAnthropic : streamOpenAI;
  let finalText = '';

  for (let step = 0; step < MAX_STEPS; step++) {
    emit({ type: 'step', step });
    const window = trimHistory(history);
    const result = await stream({
      profile,
      apiKey,
      system,
      history: window,
      tools,
      signal,
      onText: (delta) => emit({ type: 'text', delta }),
    });
    const assistantMsg = { role: 'assistant', content: result.text, toolCalls: result.toolCalls, ts: Date.now() };
    history.push(assistantMsg);
    emit({ type: 'step_end' }); // síncrono con el push: el texto parcial ya está en el historial
    finalText += result.text;

    if (!result.toolCalls.length) break;

    for (const call of result.toolCalls) {
      if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
      emit({ type: 'tool_start', id: call.id, name: call.name, input: call.input });
      let content;
      let isError = false;
      try {
        const out = await toolbox.run(call.name, call.input, {
          signal,
          progress: (msg) => emit({ type: 'tool_progress', id: call.id, name: call.name, message: msg }),
        });
        content = typeof out === 'string' ? out : JSON.stringify(out, null, 1);
      } catch (e) {
        isError = true;
        content = `Error: ${e.message || e}`;
      }
      if (content.length > 16000) content = `${content.slice(0, 16000)}\n…(recortado)`;
      history.push({ role: 'tool', toolCallId: call.id, name: call.name, content, isError, ts: Date.now() });
      emit({ type: 'tool_end', id: call.id, name: call.name, ok: !isError, result: content.slice(0, 1200) });
    }
    if (finalText && !/\s$/.test(finalText)) {
      finalText += '\n\n';
      emit({ type: 'text', delta: '\n\n' });
    }
  }
  return finalText;
}

// Si un turno se canceló a mitad, quedan llamadas a herramientas sin resultado y la API las rechaza.
export function repairHistory(history) {
  for (let i = 0; i < history.length; i++) {
    const m = history[i];
    if (m.role !== 'assistant' || !m.toolCalls?.length) continue;
    const missing = new Map(m.toolCalls.map((t) => [t.id, t.name]));
    let j = i + 1;
    while (j < history.length && history[j].role === 'tool') missing.delete(history[j++].toolCallId);
    if (!missing.size) continue;
    const fill = [...missing].map(([id, name]) => ({ role: 'tool', toolCallId: id, name, content: '(cancelado por el usuario)', isError: true }));
    history.splice(j, 0, ...fill);
    i = j + fill.length - 1;
  }
}

// Mantiene las últimas ~60 entradas sin cortar un par llamada/resultado de herramienta.
export function trimHistory(history, max = 60) {
  if (history.length <= max) return history;
  let start = history.length - max;
  while (start < history.length && history[start].role !== 'user') start++;
  return history.slice(start);
}
