import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSSE, httpError } from '../src/main/llm/sse.js';
import { toAnthropicMessages, streamAnthropic } from '../src/main/llm/anthropic.js';
import { toOpenAIMessages, streamOpenAI } from '../src/main/llm/openai.js';
import { serve, sendSSE, json } from './helpers/http.mjs';

const HISTORY = [
  { role: 'user', content: 'crea una tarea' },
  { role: 'assistant', content: 'Voy.', toolCalls: [{ id: 't1', name: 'paperclip_create_issue', input: { title: 'X' } }] },
  { role: 'tool', toolCallId: 't1', name: 'paperclip_create_issue', content: '{"id":"PAP-1"}' },
  { role: 'assistant', content: 'Hecho.' },
];

test('readSSE(): eventos con nombre, varias líneas y CRLF', async () => {
  const text = 'event: ping\r\ndata: {"a":1}\r\n\r\n: comentario\n\ndata: uno\ndata: dos\n\ndata: [DONE]';
  const body = new Response(text).body;
  const out = [];
  for await (const e of readSSE(body)) out.push(e);
  assert.deepEqual(out, [
    { event: 'ping', data: '{"a":1}' },
    { event: 'message', data: 'uno\ndos' },
    { event: 'message', data: '[DONE]' },
  ]);
});

test('httpError(): saca el mensaje del JSON de error', async () => {
  const res = new Response(JSON.stringify({ error: { message: 'credit balance is too low' } }), { status: 400 });
  const err = await httpError(res, 'Anthropic');
  assert.equal(err.status, 400);
  assert.equal(err.message, 'Anthropic: HTTP 400 — credit balance is too low');
});

test('toAnthropicMessages(): bloques tool_use / tool_result y fusión de usuarios seguidos', () => {
  const msgs = toAnthropicMessages([{ role: 'user', content: 'a' }, { role: 'user', content: 'b' }, ...HISTORY.slice(1)]);
  assert.equal(msgs[0].content, 'a\n\nb');
  assert.deepEqual(msgs[1].content[1], { type: 'tool_use', id: 't1', name: 'paperclip_create_issue', input: { title: 'X' } });
  assert.deepEqual(msgs[2], { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: '{"id":"PAP-1"}', is_error: false }] });
  assert.equal(msgs[3].content[0].text, 'Hecho.');
});

test('toOpenAIMessages(): mensaje de sistema y tool_calls', () => {
  const msgs = toOpenAIMessages('sys', HISTORY);
  assert.deepEqual(msgs[0], { role: 'system', content: 'sys' });
  assert.equal(msgs[2].tool_calls[0].function.arguments, '{"title":"X"}');
  assert.deepEqual(msgs[3], { role: 'tool', tool_call_id: 't1', content: '{"id":"PAP-1"}' });
});

test('streamAnthropic(): texto en streaming y llamada a herramienta', async () => {
  const srv = await serve((req, res) =>
    sendSSE(res, [
      { type: 'message_start', message: { usage: { input_tokens: 10 } } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Ho' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'la' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'tu1', name: 'get_current_time' } },
      { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"tz":' } },
      { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '"UTC"}' } },
      { type: 'content_block_stop', index: 1 },
      { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 5 } },
    ]),
  );
  try {
    const deltas = [];
    const r = await streamAnthropic({
      profile: { baseUrl: srv.url, model: 'claude-test', maxTokens: 100 },
      apiKey: 'sk-test',
      system: 'S',
      history: [{ role: 'user', content: 'hora?' }],
      tools: [{ name: 'get_current_time', description: 'd', schema: { type: 'object', properties: {} } }],
      onText: (d) => deltas.push(d),
    });
    assert.equal(r.text, 'Hola');
    assert.deepEqual(deltas, ['Ho', 'la']);
    assert.deepEqual(r.toolCalls, [{ id: 'tu1', name: 'get_current_time', input: { tz: 'UTC' } }]);
    assert.equal(r.stopReason, 'tool_use');
    const req = srv.requests[0];
    assert.equal(req.url, '/v1/messages');
    assert.equal(req.headers['x-api-key'], 'sk-test');
    assert.equal(req.body.system, 'S');
    assert.equal(req.body.tools[0].input_schema.type, 'object');
  } finally {
    await srv.close();
  }
});

test('streamAnthropic(): un error HTTP llega con el mensaje del proveedor', async () => {
  const srv = await serve((req, res) => json(res, { error: { message: 'invalid x-api-key' } }, 401));
  try {
    await assert.rejects(
      streamAnthropic({ profile: { baseUrl: srv.url, model: 'm' }, apiKey: 'bad', system: '', history: [] }),
      /HTTP 401 — invalid x-api-key/,
    );
  } finally {
    await srv.close();
  }
});

test('streamOpenAI(): tool_calls troceados y Bearer', async () => {
  const srv = await serve((req, res) =>
    sendSSE(res, [
      { choices: [{ index: 0, delta: { content: 'Vale' } }] },
      { choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: 'c1', type: 'function', function: { name: 'hermes_', arguments: '{"task":' } }] } }] },
      { choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { name: 'task', arguments: '"docker ps"}' } }] } }] },
      { choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] },
      '[DONE]',
    ]),
  );
  try {
    const r = await streamOpenAI({ profile: { baseUrl: `${srv.url}/v1`, model: 'gpt-test', name: 'Test' }, apiKey: 'k', system: 's', history: [{ role: 'user', content: 'hola' }] });
    assert.equal(r.text, 'Vale');
    assert.deepEqual(r.toolCalls, [{ id: 'c1', name: 'hermes_task', input: { task: 'docker ps' } }]);
    assert.equal(srv.requests[0].headers.authorization, 'Bearer k');
    assert.equal(srv.requests[0].url, '/v1/chat/completions');
  } finally {
    await srv.close();
  }
});

test('streamOpenAI(): acepta servidores que ignoran stream:true', async () => {
  const srv = await serve((req, res) => json(res, { choices: [{ message: { content: 'sin stream' }, finish_reason: 'stop' }] }));
  try {
    const r = await streamOpenAI({ profile: { baseUrl: srv.url, model: 'm' }, apiKey: '', system: '', history: [] });
    assert.equal(r.text, 'sin stream');
    assert.equal(srv.requests[0].headers.authorization, undefined);
  } finally {
    await srv.close();
  }
});
