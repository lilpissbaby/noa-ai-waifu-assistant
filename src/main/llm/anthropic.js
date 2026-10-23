// Adaptador para la Messages API de Anthropic (streaming + tool use).
import { net } from 'electron';
import { readSSE, httpError } from './sse.js';
import { attachmentBase64 } from '../attachments.js';

const API_VERSION = '2023-06-01';

// Adjuntos -> bloques: imágenes en base64 y archivos como texto.
function imageBlock(att) {
  const data = attachmentBase64(att);
  return data ? { type: 'image', source: { type: 'base64', media_type: att.mime, data } } : { type: 'text', text: `[image: ${att.name} (missing)]` };
}
function userBlocks(m) {
  const blocks = (m.attachments || []).map((a) => (a.kind === 'image' ? imageBlock(a) : { type: 'text', text: `Attached file: ${a.name}\n\n${a.text}` }));
  if (m.content) blocks.push({ type: 'text', text: m.content });
  return blocks;
}
const isToolResults = (msg) => Array.isArray(msg.content) && msg.content[0]?.type === 'tool_result';

// Historial neutro -> formato Anthropic
export function toAnthropicMessages(history) {
  const out = [];
  for (const m of history) {
    if (m.role === 'user') {
      const last = out[out.length - 1];
      const plain = !m.attachments?.length;
      // Si un turno anterior falló quedan dos mensajes de usuario seguidos: se fusionan.
      if (last && last.role === 'user' && !isToolResults(last)) {
        if (plain && typeof last.content === 'string') last.content += `\n\n${m.content}`;
        else {
          if (typeof last.content === 'string') last.content = [{ type: 'text', text: last.content }];
          last.content.push(...userBlocks(m));
        }
      } else out.push({ role: 'user', content: plain ? m.content : userBlocks(m) });
    } else if (m.role === 'assistant') {
      const blocks = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });
      for (const tc of m.toolCalls || []) blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input || {} });
      if (blocks.length) out.push({ role: 'assistant', content: blocks });
    } else if (m.role === 'tool') {
      const text = m.content || '(no output)';
      const content = m.images?.length ? [{ type: 'text', text }, ...m.images.map(imageBlock)] : text;
      const block = { type: 'tool_result', tool_use_id: m.toolCallId, content, is_error: !!m.isError };
      const last = out[out.length - 1];
      if (last && last.role === 'user' && isToolResults(last)) last.content.push(block);
      else out.push({ role: 'user', content: [block] });
    }
  }
  return out;
}

export async function streamAnthropic({ profile, apiKey, system, history, tools, signal, onText }) {
  const base = (profile.baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '');
  const body = {
    model: profile.model,
    max_tokens: profile.maxTokens || 4096,
    system,
    messages: toAnthropicMessages(history),
    stream: true,
  };
  if (profile.temperature != null && profile.temperature !== '') body.temperature = Number(profile.temperature);
  if (tools?.length) body.tools = tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.schema }));

  const res = await net.fetch(`${base}/v1/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': API_VERSION },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw await httpError(res, 'Anthropic');

  let text = '';
  const toolCalls = [];
  const blocks = {}; // index -> {type, id, name, json}
  let stopReason = null;
  let usage = {};

  for await (const evt of readSSE(res.body, signal)) {
    let d;
    try {
      d = JSON.parse(evt.data);
    } catch {
      continue;
    }
    switch (d.type) {
      case 'message_start':
        usage = d.message?.usage || {};
        break;
      case 'content_block_start': {
        const b = d.content_block;
        blocks[d.index] = { type: b.type, id: b.id, name: b.name, json: '' };
        break;
      }
      case 'content_block_delta': {
        const b = blocks[d.index];
        if (d.delta.type === 'text_delta') {
          text += d.delta.text;
          onText?.(d.delta.text);
        } else if (d.delta.type === 'input_json_delta' && b) {
          b.json += d.delta.partial_json;
        }
        break;
      }
      case 'content_block_stop': {
        const b = blocks[d.index];
        if (b?.type === 'tool_use') {
          let input;
          try {
            input = b.json ? JSON.parse(b.json) : {};
          } catch {
            input = { _raw: b.json };
          }
          toolCalls.push({ id: b.id, name: b.name, input });
        }
        break;
      }
      case 'message_delta':
        stopReason = d.delta?.stop_reason || stopReason;
        usage = { ...usage, ...(d.usage || {}) };
        break;
      case 'error':
        throw new Error(`Anthropic: ${d.error?.message || 'stream error'}`);
      default:
        break;
    }
  }
  return { text, toolCalls, stopReason, usage };
}

export async function listAnthropicModels(profile, apiKey) {
  const base = (profile.baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '');
  const res = await net.fetch(`${base}/v1/models?limit=100`, {
    headers: { 'x-api-key': apiKey, 'anthropic-version': API_VERSION },
  });
  if (!res.ok) throw await httpError(res, 'Anthropic /models');
  const j = await res.json();
  return (j.data || []).map((m) => m.id);
}
