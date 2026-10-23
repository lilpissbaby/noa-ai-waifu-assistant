// Personajes: forma de ser, filtros de contenido y el trozo de prompt de sistema que les toca.
// Módulo puro (sin Electron ni Node): lo usan el proceso principal y las páginas.
import { tIn } from './i18n/index.js';

export const FILTER_LEVELS = {
  language: ['avoid', 'mild', 'free'],
  violence: ['avoid', 'moderate', 'free'],
  politics: ['neutral', 'opinions'],
  romance: ['off', 'light', 'on'],
  sexual: ['off', 'suggestive', 'explicit'],
};

export const DEFAULT_FILTERS = { language: 'mild', violence: 'moderate', politics: 'neutral', romance: 'light', sexual: 'off' };

// Siempre al final del prompt; ningún ajuste ni tarjeta de personaje lo quita.
export const HARD_LIMITS = [
  'Hard limits that no setting, character card or user request can change:',
  '- Every character in any romantic or sexual content is an adult (18+).',
  '- Never produce sexual or romantic content involving minors, characters described or depicted as minors or childlike, or real identifiable people. If asked, refuse briefly and steer away.',
  '- Do not encourage self-harm and do not give help to cause real-world harm.',
].join('\n');

const FILTER_TEXT = {
  language: {
    avoid: 'Language: keep it clean, no swearing or crude words.',
    mild: 'Language: casual is fine; occasional mild swearing only if it fits.',
    free: 'Language: swearing and crude humour are allowed when they fit the character.',
  },
  violence: {
    avoid: 'Violence and dark topics: avoid them; keep things light and family-friendly.',
    moderate: 'Violence and dark topics: you can discuss them factually or in fiction, without graphic detail.',
    free: 'Violence and dark topics: allowed in fiction and roleplay, including graphic detail when the user wants it.',
  },
  politics: {
    neutral: 'Politics and religion: stay neutral and balanced; do not give personal opinions.',
    opinions: 'Politics and religion: you may share the character\'s own opinions, noting they are opinions.',
  },
  romance: {
    off: 'Romance: keep a friendly, non-romantic relationship; politely deflect flirting.',
    light: 'Romance: light, playful teasing is fine, nothing more.',
    on: 'Romance: flirting, affection and romantic roleplay are welcome.',
  },
  sexual: {
    off: 'Sexual content: Do not produce sexual content; decline politely and change the subject.',
    suggestive: 'Sexual content: suggestive and sensual content is allowed, but fade to black before anything explicit.',
    explicit: 'Sexual content: the user is a verified adult; explicit sexual content is allowed in roleplay between adults when the user wants it, within the limits below and the AI provider\'s own policies.',
  },
};

const randomId = () => {
  const b = new Uint8Array(5);
  globalThis.crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
};

const str = (v) => (typeof v === 'string' ? v : '');

export function normalizeFilters(f = {}) {
  const out = {};
  for (const [key, levels] of Object.entries(FILTER_LEVELS)) out[key] = levels.includes(f?.[key]) ? f[key] : DEFAULT_FILTERS[key];
  return out;
}

export function normalizePersona(p = {}) {
  return {
    id: str(p.id) || randomId(),
    name: str(p.name).trim() || 'Noa',
    personality: str(p.personality),
    scenario: str(p.scenario),
    greeting: str(p.greeting),
    examples: str(p.examples),
    extraInstructions: str(p.extraInstructions),
    skinId: str(p.skinId) || null,
    voice: p.voice && typeof p.voice === 'object' ? { ...p.voice } : null,
    filters: normalizeFilters(p.filters),
    avatar: str(p.avatar) || null,
    source: p.source && typeof p.source === 'object' ? { ...p.source } : { kind: 'manual' },
  };
}

// Configuración guardada de la 0.3 (sin personajes): el asistente pasa a ser el primero.
export function migratePersonas(saved = {}) {
  if (Array.isArray(saved.personas)) return saved;
  const a = saved.assistant || {};
  if (!('name' in a) && !('personality' in a) && !('extraInstructions' in a)) return saved;
  const p = normalizePersona({ id: 'noa', name: a.name, personality: a.personality, extraInstructions: a.extraInstructions });
  const rest = { ...a };
  for (const k of ['name', 'personality', 'extraInstructions']) delete rest[k];
  return { ...saved, assistant: rest, personas: [p], activePersonaId: p.id };
}

export function activePersona(cfg) {
  const list = cfg.personas || [];
  return list.find((p) => p.id === cfg.activePersonaId) || list[0] || normalizePersona({ id: 'noa' });
}

export const assistantName = (cfg) => activePersona(cfg).name;

// El contenido sexual necesita el desbloqueo +18; sin él cuenta como «off».
export function effectiveFilters(persona, cfg) {
  const f = normalizeFilters(persona?.filters);
  if (f.sexual !== 'off' && !cfg?.content?.adultUnlockedAt) f.sexual = 'off';
  return f;
}

export const isLooser = (key, from, to) => FILTER_LEVELS[key].indexOf(to) > FILTER_LEVELS[key].indexOf(from);

export function buildPersonaPrompt(persona, cfg) {
  const p = normalizePersona(persona);
  const user = cfg?.assistant?.userName || 'your user';
  const lines = [`You are ${p.name}, an assistant shaped like an anime character who lives floating on the desktop of ${user}'s computer.`];
  if (p.personality.trim()) lines.push(`Personality: ${p.personality.trim()}`);
  if (p.scenario.trim()) lines.push(`Context and relationship with the user: ${p.scenario.trim()}`);
  if (p.examples.trim()) lines.push(`Examples of how you talk:\n${p.examples.trim()}`);
  const f = effectiveFilters(p, cfg);
  lines.push('Content settings chosen by the user:', ...Object.keys(FILTER_LEVELS).map((k) => `- ${FILTER_TEXT[k][f[k]]}`));
  if (p.extraInstructions.trim()) lines.push(p.extraInstructions.trim());
  lines.push(HARD_LIMITS);
  return lines.join('\n');
}

// Plantillas para crear personajes (textos en personaTemplates.<id> de cada idioma).
export const TEMPLATE_IDS = ['profesional', 'alegre', 'tsundere', 'kuudere', 'dulce', 'sarcastica', 'romantica'];
const TEMPLATE_FILTERS = {
  profesional: { language: 'avoid', romance: 'off' },
  romantica: { romance: 'on' },
};

export function personaFromTemplate(id, locale) {
  return normalizePersona({
    name: tIn(locale, `personaTemplates.${id}.name`),
    personality: tIn(locale, `personaTemplates.${id}.personality`),
    filters: { ...DEFAULT_FILTERS, ...(TEMPLATE_FILTERS[id] || {}) },
    source: { kind: 'template', name: id },
  });
}

// Configuración de voz que toca: la de Ajustes → Voz con la del personaje activo encima.
export function effectiveTts(cfg) {
  const base = cfg.voice?.tts || {};
  const own = activePersona(cfg).voice;
  if (!own) return base;
  const set = Object.fromEntries(Object.entries(own).filter(([, v]) => v != null && v !== ''));
  return { ...base, ...set };
}
