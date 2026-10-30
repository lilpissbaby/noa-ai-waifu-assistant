// Adaptador OpenAI-compatible (OpenAI, OpenRouter, Groq, Gemini, Ollama, LM Studio, Hermes Agent...)
import { net } from 'electron';
import { readSSE, httpError } from './sse.js';
import { contentFilterMessage } from './azure.js';
import { attachmentBase64 } from '../attachments.js';

function imagePart(att) {
  const data = attachmentBase64(att);
  return data ? { type: 'image_url', image_url: { url: `data:${att.mime};base64,${data}` } } : { type: 'text', text: `[image: ${att.name} (missing)]` };
}

export function toOpenAIMessages(system, history) {
  const out = [];
  if (system) out.push({ role: 'system', content: system });
  // Las imágenes de herramientas no caben en el mensaje «tool»: van en un mensaje de usuario
  // justo después del bloque de resultados.
  let pending = [];
  const flush = () => {
    if (!pending.length) return;
    out.push({ role: 'user', content: [{ type: 'text', text: `Images returned by ${[...new Set(pending.map((p) => p.name))].join(', ')}:` }, ...pending.flatMap((p) => p.images.map(imagePart))] });
    pending = [];
  };
  for (const m of history) {
    if (m.role !== 'tool') flush();
    if (m.role === 'user') {
      if (!m.attachments?.length) out.push({ role: 'user', content: m.content });
      else {
        const parts = m.content ? [{ type: 'text', text: m.content }] : [];
        for (const a of m.attachments) if (a.kind !== 'image') parts.push({ type: 'text', text: `Attached file: ${a.name}\n\n${a.text}` });
        for (const a of m.attachments) if (a.kind === 'image') parts.push(imagePart(a));
        out.push({ role: 'user', content: parts });
      }
    } else if (m.role === 'assistant') {
      const msg = { role: 'assistant', content: m.content || '' };
      if (m.toolCalls?.length) {
        msg.tool_calls = m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.input || {}) },
        }));
        if (!m.content) msg.content = null;
      }
      out.push(msg);
    } else if (m.role === 'tool') {
      out.push({ role: 'tool', tool_call_id: m.toolCallId, content: m.content || '(no output)' });
      if (m.images?.length) pending.push({ name: m.name, images: m.images });
    }
  }
  flush();
  return out;
}

// Azure OpenAI con clave usa la cabecera api-key; el resto, Bearer.
const authHeaders = (apiKey, profile) => (!apiKey ? {} : profile?.auth === 'api-key' ? { 'api-key': apiKey } : { authorization: `Bearer ${apiKey}` });

async function failure(res, label) {
  try {
    const cf = contentFilterMessage(JSON.parse(await res.clone().text()));
    if (cf) return Object.assign(new Error(cf), { status: res.status, contentFilter: true });
  } catch {
    /* no es JSON */
  }
  return httpError(res, label);
}

const USAGE_HOSTS = /^https:\/\/(api\.openai\.com|openrouter\.ai|api\.groq\.com|api\.deepseek\.com|api\.mistral\.ai|[\w-]+\.openai\.azure\.com|generativelanguage\.googleapis\.com)\//i;

export async function streamOpenAI({ profile, apiKey, system, history, tools, signal, onText, extraHeaders }) {
  const base = profile.baseUrl.replace(/\/+$/, '');
  const body = {
    model: profile.model,
    messages: toOpenAIMessages(system, history),
    stream: true,
  };
  // Uso de tokens al final del stream, solo donde se sabe que se admite (otros servidores podrían
  // rechazar el parámetro).
  if (USAGE_HOSTS.test(base)) body.stream_options = { include_usage: true };
  if (profile.maxTokens) body.max_tokens = profile.maxTokens;
  if (profile.temperature != null && profile.temperature !== '') body.temperature = Number(profile.temperature);
  if (tools?.length) {
    body.tools = tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.schema },
    }));
  }

  const res = await net.fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...authHeaders(apiKey, profile),
      'HTTP-Referer': 'https://github.com/lilpissbaby/noa-ai-waifu-assistant',
      'X-Title': 'Waifu Desk',
      ...(extraHeaders || {}),
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw await failure(res, profile.name || 'OpenAI-compatible');

  const ctype = res.headers.get('content-type') || '';
  // Algunos servidores ignoran stream:true y devuelven JSON normal.
  if (!ctype.includes('event-stream')) {
    const j = await res.json();
    const msg = j.choices?.[0]?.message || {};
    const text = msg.content || '';
    if (text) onText?.(text);
    const toolCalls = (msg.tool_calls || []).map((tc) => ({
      id: tc.id,
      name: tc.function?.name,
      input: safeJSON(tc.function?.arguments),
    }));
    return { text, toolCalls, stopReason: j.choices?.[0]?.finish_reason, usage: j.usage || {} };
  }

  let text = '';
  const partial = {}; // index -> {id, name, args}
  let stopReason = null;
  let usage = {};
  for await (const evt of readSSE(res.body, signal)) {
    if (evt.data === '[DONE]') break;
    let d;
    try {
      d = JSON.parse(evt.data);
    } catch {
      continue;
    }
    const cf = contentFilterMessage(d);
    if (cf) {
      // Bloqueo a mitad de respuesta: si ya había texto se avisa al final; si no, es un error.
      if (!text) throw Object.assign(new Error(cf), { contentFilter: true });
      text += `\n\n_${cf}_`;
      onText?.(`\n\n_${cf}_`);
      stopReason = 'content_filter';
      break;
    }
    if (d.error) throw new Error(`${profile.name}: ${d.error.message || JSON.stringify(d.error)}`);
    if (d.usage) usage = d.usage;
    const choice = d.choices?.[0];
    if (!choice) continue;
    const delta = choice.delta || {};
    if (delta.content) {
      text += delta.content;
      onText?.(delta.content);
    }
    for (const tc of delta.tool_calls || []) {
      const i = tc.index ?? 0;
      const p = (partial[i] ||= { id: '', name: '', args: '' });
      if (tc.id) p.id = tc.id;
      if (tc.function?.name) p.name += tc.function.name;
      if (tc.function?.arguments) p.args += tc.function.arguments;
    }
    if (choice.finish_reason) stopReason = choice.finish_reason;
  }
  const toolCalls = Object.values(partial)
    .filter((p) => p.name)
    .map((p, i) => ({ id: p.id || `call_${Date.now()}_${i}`, name: p.name, input: safeJSON(p.args) }));
  return { text, toolCalls, stopReason, usage };
}

function safeJSON(s) {
  if (!s) return {};
  try {
    return JSON.parse(s);
  } catch {
    return { _raw: s };
  }
}

export async function listOpenAIModels(profile, apiKey) {
  const base = profile.baseUrl.replace(/\/+$/, '');
  const res = await net.fetch(`${base}/models`, { headers: authHeaders(apiKey, profile) });
  if (!res.ok) throw await httpError(res, `${profile.name} /models`);
  const j = await res.json();
  return (j.data || j.models || []).map((m) => m.id || m.name).filter(Boolean);
}
