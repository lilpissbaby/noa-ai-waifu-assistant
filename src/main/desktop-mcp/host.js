// Lo que hace la asistente cuando Claude Desktop le llama por MCP: escuchar (noa_listen), hablar
// (noa_say), poner caras, dar su contexto y prestar sus herramientas. No depende de Electron: lo
// que toca la ventana, la voz o el historial llega en `deps` desde index.js.
import crypto from 'node:crypto';
import { Relay } from './relay.js';
import { harnessTools, nativeTools, describeTools, listenResult, serverInstructions, loopPrompt, LISTEN_DEFAULT_SEC, LISTEN_MAX_SEC } from './tools.js';
import { EmotionTagFilter } from '../llm/emotion.js';
import { resolveEmotion, resolveGesture } from '../../shared/expressions.js';

const MAX_RESULT_CHARS = 100_000; // Claude Desktop admite ~150 000 caracteres por resultado
const REBRIEF_AFTER_MS = 30 * 60_000; // tras media hora sin escuchar, seguramente es otra conversación

const ok = (text) => ({ content: [{ type: 'text', text }] });
const fail = (text) => ({ content: [{ type: 'text', text }], isError: true });
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * deps:
 *  name() nombre del personaje activo · mode() 'compact' | 'all' | 'none' · version
 *  briefing({ history }) personaje + memoria + conversación reciente · briefKey() cambia si cambia el personaje
 *  toolbox() { list, run(name, input, ctx) } · readImage(att) { data, mimeType } | null
 *  promptTitle() título del prompt en el idioma de la interfaz
 *  ui: delivered(items) · said({ text, emotions, gestures, final, items }) -> { spoken } ·
 *      expressed({ emotion, gesture }) · toolStart(e) · toolProgress(e) · toolEnd(e) · settled(items) · status(st)
 */
export function createDesktopHost(deps) {
  const now = deps.now || (() => Date.now());
  const relay = new Relay({ now, idleAfterMs: deps.idleAfterMs });
  const ui = deps.ui || {};
  let replyText = ''; // lo dicho con final=false para la petición en curso
  let muted = false; // el usuario pulsó «parar»: lo que diga Claude hasta el próximo noa_listen no sale
  const name = () => deps.name?.() || 'Noa';
  const mode = () => deps.mode?.() || 'compact';
  const emitStatus = () => ui.status?.(status());

  function listTools() {
    const harness = harnessTools({ name: name(), mode: mode() });
    if (mode() !== 'all') return harness;
    const taken = new Set(harness.map((t) => t.name));
    return [...harness, ...nativeTools(deps.toolbox().list.filter((t) => !taken.has(t.name)))];
  }

  const toolsVersion = () =>
    crypto
      .createHash('sha1')
      .update(listTools().map((t) => t.name).join(','))
      .digest('hex')
      .slice(0, 12);

  function prompts() {
    return [{ name: 'noa', title: deps.promptTitle?.() || `${name()} mode`, description: `Claude answers you through ${name()}, the assistant on your desktop.` }];
  }

  function meta() {
    return { name: 'noa', title: `${name()} · Waifu Desk`, version: deps.version || '0.0.0', instructions: serverInstructions(name()), tools: listTools(), prompts: prompts(), toolsVersion: toolsVersion() };
  }

  function needsBrief(session, prevListen) {
    const key = deps.briefKey?.() || '';
    return session.briefKey !== key || (prevListen && now() - prevListen > REBRIEF_AFTER_MS);
  }

  function brief(session, history = 12) {
    session.briefKey = deps.briefKey?.() || '';
    return deps.briefing?.({ history }) || '';
  }

  function closeTurn(items) {
    if (!items.length && !replyText) return;
    const said = replyText.trim();
    replyText = '';
    for (const it of items)
      try {
        it.onDone?.(said);
      } catch {
        /* lo registra quien lo puso */
      }
    ui.settled?.(items);
  }

  async function listen(args, ctx) {
    const sec = clamp(Number.parseInt(args.timeout_seconds, 10) || LISTEN_DEFAULT_SEC, 5, LISTEN_MAX_SEC);
    const session = relay.touch(ctx.session, ctx.client);
    const prevListen = session.lastListen;
    muted = false;
    // Si Claude vuelve a escuchar, lo anterior está contestado (aunque no usara final=true):
    // se cierra ya, para que el chat no se quede «pensando» mientras espera.
    const unanswered = relay.settle();
    if (unanswered.length || replyText) closeTurn(unanswered);
    const pending = relay.listen({ timeoutMs: sec * 1000, signal: ctx.signal, session: ctx.session, client: ctx.client });
    emitStatus();
    const r = await pending;
    if (r.cancelled) {
      emitStatus();
      return ok('Cancelled.');
    }
    const briefing = needsBrief(session, prevListen) ? brief(session) : '';
    if (r.timeout) {
      emitStatus();
      return listenResult({ name: name(), briefing, notes: r.notes, timeout: true, waitedSec: sec });
    }
    const messages = r.messages.map((m) => ({
      ...m,
      attachments: (m.attachments || []).map((a) => (a.kind === 'image' ? { ...a, ...(deps.readImage?.(a) || {}) } : a)),
    }));
    if (messages.length) ui.delivered?.(r.messages);
    emitStatus();
    return listenResult({ name: name(), messages, notes: r.notes, briefing });
  }

  function say(args) {
    const raw = String(args.text ?? '').trim();
    if (!raw) return fail('text is empty.');
    if (muted) return ok(`The user pressed stop, so this was not shown. Call noa_listen to wait for the next message.`);
    const final = args.final !== false;
    const filter = new EmotionTagFilter();
    const a = filter.push(raw);
    const b = filter.flush();
    const clean = (a.text + b.text).replace(/\n{3,}/g, '\n\n').trim();
    const items = final ? relay.settle() : [...relay.pending()];
    const r = ui.said?.({ text: clean, emotions: a.emotions, gestures: a.gestures, final, items }) || {};
    if (clean) replyText += `${clean}\n\n`;
    if (final) closeTurn(items);
    emitStatus();
    const spoken = r.spoken ? ' and read it aloud' : '';
    return ok(final ? `${name()} showed it${spoken}. In ${name()} mode, now call noa_listen to wait for the next message.` : `${name()} showed it${spoken}. Continue, and finish with noa_say (final=true).`);
  }

  function express(args) {
    const emotion = args.emotion ? resolveEmotion(args.emotion) : null;
    const gesture = args.gesture ? resolveGesture(args.gesture) : null;
    if (!emotion && !gesture) return fail('Give a valid emotion and/or gesture name.');
    ui.expressed?.({ emotion, gesture });
    return ok(`Done${emotion ? ` (face: ${emotion})` : ''}${gesture ? ` (gesture: ${gesture})` : ''}.`);
  }

  function context(args, ctx) {
    const session = relay.touch(ctx.session, ctx.client);
    const n = clamp(Number.parseInt(args.history ?? 12, 10) || 0, 0, 50);
    const st = relay.status();
    const lines = [brief(session, n), '', `Status: ${st.queued} message(s) waiting for you, tools mode "${mode()}". Start (or keep) the loop with noa_listen.`];
    return ok(lines.join('\n'));
  }

  async function runTool(toolName, input, ctx) {
    const box = deps.toolbox();
    if (!box.list.some((t) => t.name === toolName)) return fail(`Unknown tool "${toolName}". Call noa_tools to see the available ones.`);
    const id = `mcp-${crypto.randomBytes(4).toString('hex')}`;
    ui.toolStart?.({ id, name: toolName, input });
    try {
      const out = await box.run(toolName, input && typeof input === 'object' ? input : {}, {
        signal: ctx.signal,
        progress: (message) => ui.toolProgress?.({ id, name: toolName, message }),
      });
      let images = [];
      let body;
      if (out && typeof out === 'object' && Array.isArray(out.images)) {
        images = out.images;
        body = typeof out.content === 'string' ? out.content : JSON.stringify(out.content ?? '', null, 1);
      } else body = typeof out === 'string' ? out : JSON.stringify(out, null, 1) ?? '';
      if (body.length > MAX_RESULT_CHARS) body = `${body.slice(0, MAX_RESULT_CHARS)}\n…(truncated)`;
      ui.toolEnd?.({ id, name: toolName, ok: true, result: body.slice(0, 1200), images });
      const pics = images.map((att) => deps.readImage?.(att)).filter((x) => x?.data);
      return { content: [{ type: 'text', text: body || '(done)' }, ...pics.map((p) => ({ type: 'image', data: p.data, mimeType: p.mimeType || 'image/jpeg' }))] };
    } catch (e) {
      const msg = String(e?.message || e);
      ui.toolEnd?.({ id, name: toolName, ok: false, result: msg.slice(0, 1200) });
      return fail(`Error: ${msg}`);
    }
  }

  /** Una llamada de herramienta desde el puente. ctx: { session, client, signal } */
  async function call(toolName, args = {}, ctx = {}) {
    args = args && typeof args === 'object' ? args : {};
    relay.touch(ctx.session, ctx.client);
    switch (toolName) {
      case 'noa_listen':
        return listen(args, ctx);
      case 'noa_say':
        return say(args);
      case 'noa_express':
        return express(args);
      case 'noa_context':
        return context(args, ctx);
      case 'noa_tools':
        if (mode() === 'none') break;
        return ok(describeTools(deps.toolbox().list, args.query));
      case 'noa_run_tool':
        if (mode() === 'none') break;
        return runTool(String(args.name || ''), args.input, ctx);
      default:
        if (mode() === 'all') return runTool(toolName, args, ctx);
    }
    return fail(`Unknown tool "${toolName}".`);
  }

  function prompt(promptName, _args, ctx = {}) {
    if (promptName !== 'noa') return null;
    const session = relay.touch(ctx.session, ctx.client);
    return {
      description: prompts()[0].description,
      messages: [{ role: 'user', content: { type: 'text', text: loopPrompt(name(), brief(session)) } }],
    };
  }

  // El mismo texto del prompt, para copiarlo desde Ajustes (sin contar como llamada de Claude).
  const loopText = () => loopPrompt(name(), deps.briefing?.({ history: 12 }) || '');

  /** Mensaje del usuario para Claude. Devuelve si había alguien escuchando. */
  function enqueue(msg) {
    const connected = relay.connected();
    muted = false;
    const item = relay.enqueue(msg);
    emitStatus();
    return { item, connected };
  }

  function cancel() {
    const dropped = relay.cancel();
    const had = dropped.length > 0 || !!replyText;
    replyText = '';
    if (had) {
      muted = relay.waiters.length === 0; // si Claude ya estaba escuchando otra vez, no hay nada que callar
      relay.note('The user pressed stop on the last request. Drop it unless they bring it up again.');
    }
    emitStatus();
    return dropped;
  }

  function noteReset() {
    relay.note(`The user started a new conversation with ${name()}: what was said before no longer applies.`);
  }

  function status() {
    return { ...relay.status(), mode: mode() };
  }

  return { relay, call, meta, prompt, loopText, enqueue, cancel, noteReset, status, listTools };
}
