// Acciones rápidas sobre el texto del portapapeles (traducir, resumir, corregir…): un atajo global
// abre un menú junto al cursor y la acción elegida se manda al chat como mensaje.
import { tIn } from './i18n/index.js';

export const QUICK_ACTION_IDS = ['translate', 'summarize', 'correct', 'explain', 'reply'];
const COPY = new Set(['translate', 'correct', 'reply']);

export function defaultActions(locale) {
  return QUICK_ACTION_IDS.map((id) => ({ id, name: tIn(locale, `quickActions.${id}.name`), prompt: tIn(locale, `quickActions.${id}.prompt`), copyResult: COPY.has(id) }));
}

export function actionsFor(cfg, locale) {
  const own = cfg.productivity?.quickActions;
  return Array.isArray(own) ? own : defaultActions(locale);
}

export function composeAction(action, text, { language = '' } = {}) {
  const body = String(text ?? '').trim();
  if (!body) return null;
  const prompt = String(action.prompt || '').replaceAll('{language}', () => language);
  return prompt.includes('{text}') ? prompt.replaceAll('{text}', () => body) : `${prompt.trim()}\n\n${body}`;
}

// Lo que se copia: el texto de la respuesta sin las vallas ``` de los bloques de código.
export function clipboardText(reply) {
  return String(reply ?? '')
    .split('\n')
    .filter((line) => !/^\s*```/.test(line))
    .join('\n')
    .trim();
}
