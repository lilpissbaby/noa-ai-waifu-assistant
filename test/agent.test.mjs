import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setLocale } from '../src/shared/i18n/index.js';
import { buildSystemPrompt, replyLanguage, repairHistory, trimHistory, runTurn } from '../src/main/llm/agent.js';
import { serve, sendSSE } from './helpers/http.mjs';

const cfg = ({ name = 'Noa', personality = 'P', extraInstructions = '', ...assistant } = {}) => ({
  assistant: { userName: 'mupsim', language: '', ...assistant },
  personas: [{ id: 'noa', name, personality, extraInstructions }],
  activePersonaId: 'noa',
  content: { adultUnlockedAt: null },
});

test('replyLanguage(): el de la interfaz salvo que se escriba otro', () => {
  assert.equal(replyLanguage(cfg(), 'ru'), 'Russian (Русский)');
  assert.equal(replyLanguage(cfg(), 'zh'), 'Simplified Chinese (中文（简体）)');
  assert.equal(replyLanguage(cfg({ language: 'español' }), 'en'), 'español');
});

test('buildSystemPrompt(): idioma de respuesta, nombre y herramientas', () => {
  const p = buildSystemPrompt(cfg({ extraInstructions: 'EXTRA' }), [{ group: 'manage tasks' }, { group: 'manage tasks' }, { group: 'open links' }], 'uk');
  assert.match(p, /You are Noa/);
  assert.match(p, /mupsim's computer/);
  assert.match(p, /Always reply in Ukrainian \(Українська\)/);
  assert.match(p, /You have tools to: manage tasks; open links\./);
  assert.match(p, /EXTRA\n[\s\S]*Hard limits/);
  assert.doesNotMatch(buildSystemPrompt(cfg(), [], 'es'), /You have tools/);
});

test('repairHistory(): rellena resultados de herramientas que faltan', () => {
  const h = [
    { role: 'user', content: 'x' },
    { role: 'assistant', content: '', toolCalls: [{ id: 'a', name: 'n1' }, { id: 'b', name: 'n2' }] },
    { role: 'tool', toolCallId: 'a', name: 'n1', content: 'ok' },
    { role: 'user', content: 'y' },
  ];
  repairHistory(h);
  assert.equal(h.length, 5);
  assert.deepEqual(h[3], { role: 'tool', toolCallId: 'b', name: 'n2', content: '(cancelled by the user)', isError: true });
  assert.equal(h[4].content, 'y');
});

test('trimHistory(): recorta empezando siempre en un mensaje del usuario', () => {
  const h = [];
  for (let i = 0; i < 40; i++) h.push({ role: 'user', content: `u${i}` }, { role: 'assistant', content: `a${i}` });
  const w = trimHistory(h, 11);
  assert.equal(w[0].role, 'user');
  assert.ok(w.length <= 11);
  assert.equal(w.at(-1).content, 'a39');
  assert.equal(trimHistory(h.slice(0, 4), 60).length, 4);
});

test('runTurn(): ejecuta la herramienta y vuelve a llamar al modelo', async () => {
  setLocale('es');
  let call = 0;
  const srv = await serve((req, res) => {
    call++;
    if (call === 1)
      return sendSSE(res, [
        { choices: [{ delta: { content: 'Miro. ' } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'echo', arguments: '{"x":2}' } }] } }] },
        '[DONE]',
      ]);
    return sendSSE(res, [{ choices: [{ delta: { content: 'Son 4.' } }] }, '[DONE]']);
  });
  try {
    const history = [{ role: 'user', content: '2+2' }];
    const events = [];
    const toolbox = {
      list: [{ name: 'echo', description: 'doubles', schema: { type: 'object', properties: {} }, group: 'math' }],
      run: async (name, input) => ({ doubled: input.x * 2 }),
    };
    const text = await runTurn({
      cfg: cfg(),
      profile: { kind: 'openai', baseUrl: srv.url, model: 'm', toolsEnabled: true },
      apiKey: '',
      history,
      toolbox,
      emit: (e) => events.push(e),
    });
    assert.equal(text, 'Miro. Son 4.');
    assert.deepEqual(
      history.map((m) => m.role),
      ['user', 'assistant', 'tool', 'assistant'],
    );
    assert.equal(history[2].content, '{\n "doubled": 4\n}');
    assert.ok(events.some((e) => e.type === 'tool_end' && e.ok));
    // la segunda petición lleva el resultado de la herramienta
    assert.equal(srv.requests[1].body.messages.at(-1).role, 'tool');
  } finally {
    await srv.close();
  }
});

test('runTurn(): un error de la herramienta se le devuelve al modelo', async () => {
  let call = 0;
  const srv = await serve((req, res) => {
    call++;
    if (call === 1) return sendSSE(res, [{ choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'boom', arguments: '{}' } }] } }] }, '[DONE]']);
    return sendSSE(res, [{ choices: [{ delta: { content: 'Falló.' } }] }, '[DONE]']);
  });
  try {
    const history = [{ role: 'user', content: 'x' }];
    await runTurn({
      cfg: cfg(),
      profile: { kind: 'openai', baseUrl: srv.url, model: 'm' },
      apiKey: '',
      history,
      toolbox: {
        list: [{ name: 'boom', description: '', schema: { type: 'object' } }],
        run: async () => {
          throw new Error('kaput');
        },
      },
      emit: () => {},
    });
    assert.equal(history[2].isError, true);
    assert.equal(history[2].content, 'Error: kaput');
  } finally {
    await srv.close();
  }
});

test('buildSystemPrompt(): instrucciones de emociones salvo que estén desactivadas', () => {
  assert.match(buildSystemPrompt(cfg(), [], 'es'), /<emo:happy>/);
  assert.doesNotMatch(buildSystemPrompt({ ...cfg(), ui: { emotions: false } }, [], 'es'), /<emo:/);
});

test('runTurn(): las etiquetas de emoción no llegan al chat ni al historial', async () => {
  const srv = await serve((req, res) => sendSSE(res, [...['<em', 'o:hap', 'py>Ho', 'la'].map((c) => ({ choices: [{ delta: { content: c } }] })), '[DONE]']));
  try {
    const history = [{ role: 'user', content: 'hola' }];
    const events = [];
    const text = await runTurn({ cfg: cfg(), profile: { kind: 'openai', baseUrl: srv.url, model: 'm' }, apiKey: '', history, toolbox: { list: [], run: async () => '' }, emit: (e) => events.push(e) });
    assert.equal(text, 'Hola');
    assert.equal(events.filter((e) => e.type === 'text').map((e) => e.delta).join(''), 'Hola');
    assert.deepEqual(events.filter((e) => e.type === 'emotion'), [{ type: 'emotion', name: 'happy' }]);
    assert.equal(history.at(-1).content, 'Hola');
  } finally {
    await srv.close();
  }
});
