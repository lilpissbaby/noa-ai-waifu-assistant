// Herramientas MCP que ve Claude Desktop (o Claude Code) cuando se conecta a la asistente.
// Los textos van en inglés porque los lee el modelo, como el resto de herramientas de la app.
// Sin Electron: el anfitrión (host.js) pasa las funciones que hacen el trabajo.
import { EMOTION_NAMES, GESTURE_NAMES } from '../../shared/expressions.js';

export const LISTEN_DEFAULT_SEC = 180;
export const LISTEN_MAX_SEC = 220; // Claude Desktop corta cada llamada a los 240 s

// compact: las 6 de la asistente + noa_tools/noa_run_tool para llegar a las suyas.
// all: además, cada herramienta suya como herramienta MCP. none: solo hablar y escuchar.
export const TOOL_MODES = ['compact', 'all', 'none'];

const text = (s) => ({ content: [{ type: 'text', text: s }] });

export function harnessTools({ name = 'Noa', mode = 'compact' } = {}) {
  const tools = [
    {
      name: 'noa_listen',
      title: `Listen to ${name}`,
      description:
        `Waits until the user says something to ${name} (the anime assistant floating on their desktop, by text or voice) and returns it. ` +
        `This is how you receive the user's messages in "${name} mode": the user is looking at ${name}, not at this chat. ` +
        `It blocks up to ~3 minutes; if nothing arrives it says "No message yet": just call it again. ` +
        `After each message: do what was asked (use any tools you need), answer with noa_say, then call noa_listen again. Keep looping until the user tells you to stop in this chat.`,
      inputSchema: {
        type: 'object',
        properties: {
          timeout_seconds: { type: 'integer', minimum: 5, maximum: LISTEN_MAX_SEC, description: `How long to wait for a message (default ${LISTEN_DEFAULT_SEC}).` },
        },
      },
      annotations: { title: `Listen to ${name}`, readOnlyHint: true, openWorldHint: false },
    },
    {
      name: 'noa_say',
      title: `${name} says`,
      description:
        `Makes ${name} say this to the user: it appears in her speech bubble and chat window and is read aloud with her voice. ` +
        `It is the ONLY way the user sees your answer in ${name} mode. Write in character, short and natural (1-4 sentences unless asked for detail), in the user's language, ` +
        `with the hidden <emo:…>/<act:…> tags to animate her face and body. Use markdown only for code, commands or lists (only the plain text is spoken). ` +
        `Set final=false for a short interim line ("on it…") before long work; the last message of a reply uses final=true (the default).`,
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: `What ${name} says, with optional <emo:NAME> and <act:NAME> tags.` },
          final: { type: 'boolean', description: 'false = there is more coming for this request (default true).' },
        },
        required: ['text'],
      },
      annotations: { title: `${name} says`, readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    {
      name: 'noa_express',
      title: `${name}'s face and gestures`,
      description: `Changes ${name}'s facial expression and/or makes her do a gesture without speaking (for example a thinking face while you work).`,
      inputSchema: {
        type: 'object',
        properties: {
          emotion: { type: 'string', enum: EMOTION_NAMES },
          gesture: { type: 'string', enum: GESTURE_NAMES },
        },
      },
      annotations: { title: `${name}'s face and gestures`, readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    {
      name: 'noa_context',
      title: `${name}'s character and recent chat`,
      description:
        `Returns ${name}'s character sheet (personality, language, rules, expression tags), what she remembers about the user, the recent conversation and her status. ` +
        `Call it once when you start acting as ${name}, unless the "${name.toLowerCase()}" prompt or a noa_listen result already gave it to you.`,
      inputSchema: {
        type: 'object',
        properties: { history: { type: 'integer', minimum: 0, maximum: 50, description: 'How many recent messages to include (default 12).' } },
      },
      annotations: { title: `${name}'s character and recent chat`, readOnlyHint: true, openWorldHint: false },
    },
  ];
  if (mode !== 'none')
    tools.push(
      {
        name: 'noa_tools',
        title: `${name}'s own tools`,
        description:
          `Lists ${name}'s own tools on the user's PC: tasks, reminders, notes, calendar, timers and focus mode, files, screen capture, weather and news, ` +
          `Paperclip agents, Hermes on the VPS, GitHub, Home Assistant, webhooks, phone notifications and the MCP servers configured in ${name}. ` +
          'Without arguments it lists names and one-line descriptions; pass query (words or exact names) to get the matching ones with their input schemas. Then run one with noa_run_tool.',
        inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Words to filter by, or tool names separated by commas.' } } },
        annotations: { title: `${name}'s own tools`, readOnlyHint: true, openWorldHint: false },
      },
      {
        name: 'noa_run_tool',
        title: `Run one of ${name}'s tools`,
        description: `Runs one of ${name}'s own tools (see noa_tools) with the given input. Actions with side effects may show a confirmation dialog on the user's screen.`,
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Tool name, as listed by noa_tools.' },
            input: { type: 'object', description: 'Arguments for the tool, following its input schema.' },
          },
          required: ['name'],
        },
        annotations: { title: `Run one of ${name}'s tools`, readOnlyHint: false, openWorldHint: true },
      },
    );
  return tools;
}

// Herramientas propias de la app expuestas tal cual (modo «all»). Sin las que ya cubre el arnés.
export function nativeTools(list) {
  return list.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.schema && typeof tool.schema === 'object' ? tool.schema : { type: 'object', properties: {} },
  }));
}

// noa_tools: lista corta o, con query, las que encajan con su esquema.
export function describeTools(list, query = '') {
  const q = String(query || '').trim().toLowerCase();
  if (!list.length) return `There are no tools enabled. The user can turn them on in Settings.`;
  if (!q) {
    const groups = new Map();
    for (const tool of list) {
      const g = tool.group || 'other';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(`- ${tool.name}: ${firstSentence(tool.description)}`);
    }
    const lines = [`${list.length} tools. Call noa_tools with query to get the input schemas, then noa_run_tool.`];
    for (const [g, items] of groups) lines.push('', `To ${g}:`, ...items);
    return lines.join('\n');
  }
  const names = q.split(/[\s,]+/).filter(Boolean);
  const exact = list.filter((tool) => names.includes(tool.name.toLowerCase()));
  const found = exact.length
    ? exact
    : list.filter((tool) => {
        const hay = `${tool.name} ${tool.group || ''} ${tool.description || ''}`.toLowerCase();
        return names.every((w) => hay.includes(w)) || names.some((w) => tool.name.toLowerCase().includes(w));
      });
  if (!found.length) return `No tool matches "${query}". Call noa_tools without arguments to see them all.`;
  return found
    .slice(0, 25)
    .map((tool) => `## ${tool.name}\n${tool.description}\ninput schema: ${JSON.stringify(tool.schema || { type: 'object', properties: {} })}`)
    .join('\n\n');
}

const firstSentence = (s) => {
  const str = String(s || '').replace(/\s+/g, ' ').trim();
  const m = /^(.{20,160}?[.!?])(\s|$)/.exec(str);
  return m ? m[1] : str.length > 160 ? `${str.slice(0, 157)}…` : str;
};

const VIA = { voice: 'spoken', text: 'typed', quick: 'quick action', look: 'with a screenshot' };

function clock(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Resultado de noa_listen. images: [{ data, mimeType }] ya reducidas por el anfitrión.
 * texts: los adjuntos de texto. briefing: contexto del personaje (primera vez o si cambió).
 */
export function listenResult({ name = 'Noa', messages = [], notes = [], briefing = '', timeout = false, waitedSec = 0, maxTextChars = 60_000 }) {
  const parts = [];
  const content = [];
  if (briefing) parts.push(briefing, '');
  for (const n of notes) parts.push(`(${n})`);
  if (!messages.length) {
    parts.push(
      timeout
        ? `No message yet (waited ${waitedSec} s). Call noa_listen again now, without writing anything in this chat.`
        : 'Nothing new to answer. Call noa_listen again now, without writing anything in this chat.',
    );
    return { content: [{ type: 'text', text: parts.join('\n') }] };
  }
  let budget = maxTextChars;
  const images = [];
  messages.forEach((m, i) => {
    const head = m.hidden
      ? `Automatic request from ${name} (${m.label || 'routine'}; the user did not type this, but answer it to them):`
      : `${messages.length > 1 ? `Message ${i + 1}` : 'New message'} from the user to ${name} (${VIA[m.via] || VIA.text}, ${clock(m.ts)}):`;
    parts.push(head, quote(m.text || '(no text, see the attachments)'));
    for (const a of m.attachments || []) {
      if (a.kind === 'image') {
        if (a.data) {
          images.push({ type: 'image', data: a.data, mimeType: a.mimeType || 'image/jpeg' });
          parts.push(`[image attached: ${a.name} (shown below)]`);
        } else parts.push(`[image attached: ${a.name} (could not be read)]`);
      } else if (a.kind === 'text') {
        let body = String(a.text || '');
        if (body.length > budget) body = `${body.slice(0, Math.max(0, budget))}\n…(truncated)`;
        budget -= body.length;
        parts.push(`[file attached: ${a.name}]`, quote(body));
      }
    }
    parts.push('');
  });
  parts.push(`→ Answer with noa_say (that is what the user sees and hears), then call noa_listen again.`);
  content.push({ type: 'text', text: parts.join('\n') }, ...images);
  return { content };
}

const quote = (s) => `"""\n${String(s).replaceAll('"""', '"\u200b""')}\n"""`;

// Instrucciones del servidor (las ve Claude al conectarse) y texto del prompt «Modo Noa».
export function serverInstructions(name = 'Noa') {
  return (
    `${name} is an anime assistant that floats on the user's desktop (the Waifu Desk app). The user talks to her by text or voice, and you can be her brain, so they don't spend API credits. ` +
    `When the user asks for "${name} mode" / "modo ${name}" / to answer through ${name} (or picks the "${name.toLowerCase()}" prompt): call noa_context once, then loop noa_listen → do the work → noa_say → noa_listen, ` +
    `and keep looping without writing replies in this chat until the user tells you to stop here. ` +
    `Outside that mode you can still use noa_say if the user wants ${name} to read something aloud.`
  );
}

export function loopPrompt(name = 'Noa', briefing = '') {
  return [
    `From now on you are the brain of ${name}, the anime assistant floating on my desktop. I'll talk to her (typing or by voice), not to this chat.`,
    '',
    'Loop, and keep looping until I tell you to stop in this chat:',
    `1. Call noa_listen. It waits for the next thing I say to ${name}. If it says "No message yet", call it again right away.`,
    `2. Do what I asked. Use whatever you need: your own tools and connectors here, and ${name}'s tools on my PC through noa_tools / noa_run_tool (tasks, reminders, Paperclip, Hermes…).`,
    `3. Answer with noa_say, in character. That is the only thing I see and hear. For long work, first noa_say a short line with final=false.`,
    '4. Go back to step 1.',
    '',
    `Don't write the answers in this chat: I'm not looking at it. Here is who ${name} is:`,
    '',
    briefing,
  ].join('\n');
}

export { text as textResult };
