// Bucle de agente: llama al modelo, ejecuta herramientas y repite hasta tener respuesta final.
import os from 'node:os';
import { streamAnthropic } from './anthropic.js';
import { streamOpenAI } from './openai.js';
import { getLocale, localeTag, LANGUAGES, t } from '../../shared/i18n/index.js';
import { EmotionTagFilter, EMOTION_PROMPT, stripEmotionTags } from './emotion.js';
import { activePersona, buildPersonaPrompt, effectiveFilters } from '../../shared/personas.js';
import { azurePolicyFor } from './azure.js';
import { listMemory, memoryPrompt } from '../productivity/memory.js';
import { prepareImages, hasImages, attachmentUrl } from '../attachments.js';

const MAX_STEPS = 10;

// Idioma de las respuestas: el que se escribió en Ajustes o, si está vacío, el de la interfaz.
export function replyLanguage(cfg, locale = getLocale()) {
  const custom = cfg.assistant?.language?.trim();
  if (custom) return custom;
  const l = LANGUAGES[locale] || LANGUAGES.en;
  return `${l.english} (${l.native})`;
}

// El prompt de sistema va en inglés (lo entienden igual todos los modelos); la respuesta sale
// en el idioma elegido.
// extras.memory: bloque «Things you know about the user» (memoryPrompt) o vacío.
export function buildSystemPrompt(cfg, toolList, locale = getLocale(), extras = {}) {
  const now = new Date();
  const date = now.toLocaleString(localeTag(locale), { dateStyle: 'full', timeStyle: 'short' });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const groups = [...new Set(toolList.map((t) => t.group).filter(Boolean))];
  const persona = buildPersonaPrompt(activePersona(cfg), cfg).split('\n');
  const [intro] = persona;
  const lines = [
    intro,
    `Always reply in ${replyLanguage(cfg, locale)} unless you are asked to use another language.`,
    'Many of your replies are read aloud: keep them short and natural (1-4 sentences) unless asked for detail.',
    'When you give code, commands, long lists or data, use markdown; only the plain text is spoken.',
    `Local date and time: ${date} (${tz}). System: ${os.type()} ${os.release()}.`,
  ];
  if (extras.memory) lines.push(extras.memory);
  if (groups.length) {
    lines.push(
      `You have tools to: ${groups.join('; ')}. Use them when they really help, without asking permission for read-only lookups.`,
      'Before actions with side effects (creating or changing tasks, waking agents, running commands, calling webhooks) make sure the request is clear; if it is ambiguous, ask one single question.',
      'After using tools, summarise the result in one or two sentences; never dump raw JSON.',
    );
  }
  if (cfg.ui?.emotions !== false) lines.push(EMOTION_PROMPT);
  // Personalidad, filtros, instrucciones extra y, al final, los límites fijos.
  lines.push(...persona.slice(1));
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
  const memory = cfg.productivity?.memory !== false ? memoryPrompt(listMemory()) : '';
  const system = buildSystemPrompt(cfg, tools, getLocale(), { memory });
  const stream = profile.kind === 'anthropic' ? streamAnthropic : streamOpenAI;
  // Azure OpenAI: política de contenido según los filtros del personaje activo.
  const policy = azurePolicyFor(profile, effectiveFilters(activePersona(cfg), cfg));
  const extraHeaders = policy ? { 'x-policy-id': policy } : undefined;
  let finalText = '';

  for (let step = 0; step < MAX_STEPS; step++) {
    emit({ type: 'step', step });
    if (step > 0) repairHistory(history); // por si llegó un aviso mientras corrían las herramientas
    const window = prepareImages(trimHistory(history));
    // Las etiquetas de emoción se quitan del texto y se mandan aparte a la cara del avatar.
    const filter = new EmotionTagFilter();
    const pass = ({ text, emotions }) => {
      if (text) emit({ type: 'text', delta: text });
      for (const name of emotions) emit({ type: 'emotion', name });
    };
    let result;
    try {
      result = await stream({
        profile,
        apiKey,
        system,
        history: window,
        tools,
        signal,
        extraHeaders,
        onText: (delta) => pass(filter.push(delta)),
      });
    } catch (e) {
      // Un 400 con imágenes suele ser un modelo sin visión: se dice claro, con el detalle del proveedor.
      if (hasImages(window) && [400, 415, 422].includes(e.status) && !e.contentFilter)
        throw Object.assign(new Error(t('errors.visionUnsupported', { model: profile.model, detail: e.message })), { status: e.status });
      throw e;
    }
    pass(filter.flush());
    result.text = stripEmotionTags(result.text);
    const assistantMsg = { role: 'assistant', content: result.text, toolCalls: result.toolCalls, ts: Date.now() };
    history.push(assistantMsg);
    emit({ type: 'step_end' }); // síncrono con el push: el texto parcial ya está en el historial
    finalText += result.text;

    if (!result.toolCalls.length) break;

    for (const call of result.toolCalls) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      emit({ type: 'tool_start', id: call.id, name: call.name, input: call.input });
      let content;
      let images = null;
      let isError = false;
      try {
        const out = await toolbox.run(call.name, call.input, {
          signal,
          progress: (msg) => emit({ type: 'tool_progress', id: call.id, name: call.name, message: msg }),
        });
        // Herramientas que devuelven imágenes (captura de pantalla…): { content, images: [adjuntos] }.
        if (out && typeof out === 'object' && Array.isArray(out.images)) {
          images = out.images;
          content = typeof out.content === 'string' ? out.content : JSON.stringify(out.content ?? '', null, 1);
        } else content = typeof out === 'string' ? out : JSON.stringify(out, null, 1);
      } catch (e) {
        isError = true;
        content = `Error: ${e.message || e}`;
      }
      if (content.length > 16000) content = `${content.slice(0, 16000)}\n…(truncated)`;
      history.push({ role: 'tool', toolCallId: call.id, name: call.name, content, isError, ts: Date.now(), ...(images?.length ? { images } : {}) });
      emit({ type: 'tool_end', id: call.id, name: call.name, ok: !isError, result: content.slice(0, 1200), ...(images?.length ? { images: images.map(attachmentUrl) } : {}) });
    }
    if (finalText && !/\s$/.test(finalText)) {
      finalText += '\n\n';
      emit({ type: 'text', delta: '\n\n' });
    }
  }
  return finalText;
}

// Si un turno se canceló a mitad, quedan llamadas a herramientas sin resultado y la API las rechaza.
// Además, un mensaje del asistente que llegó mientras corría una herramienta (un aviso, el saludo de
// un personaje…) se mueve detrás de los resultados: la llamada y su resultado tienen que ir seguidos.
const isLoose = (m) => m.role === 'assistant' && !m.toolCalls?.length;
export function repairHistory(history) {
  for (let i = 0; i < history.length; i++) {
    const m = history[i];
    if (m.role !== 'assistant' || !m.toolCalls?.length) continue;
    const ids = new Set(m.toolCalls.map((t) => t.id));
    const missing = new Map(m.toolCalls.map((t) => [t.id, t.name]));
    const moved = [];
    let j = i + 1;
    while (j < history.length) {
      if (history[j].role === 'tool') {
        missing.delete(history[j++].toolCallId);
        continue;
      }
      let k = j;
      while (k < history.length && isLoose(history[k])) k++;
      if (k === j || k >= history.length || history[k].role !== 'tool' || !ids.has(history[k].toolCallId)) break;
      moved.push(...history.splice(j, k - j));
    }
    const fill = [...missing].map(([id, name]) => ({ role: 'tool', toolCallId: id, name, content: '(cancelled by the user)', isError: true }));
    history.splice(j, 0, ...fill, ...moved);
    i = j + fill.length + moved.length - 1;
  }
}

// Mantiene las últimas ~60 entradas sin cortar un par llamada/resultado de herramienta.
export function trimHistory(history, max = 60) {
  if (history.length <= max) return history;
  let start = history.length - max;
  while (start < history.length && history[start].role !== 'user') start++;
  return history.slice(start);
}
