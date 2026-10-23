// Herramientas para que la asistente cambie de personaje o ajuste el suyo cuando se lo piden.
// Relajar un filtro pide confirmación; el contenido +18 exige el desbloqueo en Ajustes.
import { loadConfig, patchConfig } from '../config.js';
import { FILTER_LEVELS, activePersona, isLooser } from '../../shared/personas.js';
import { t } from '../../shared/i18n/index.js';

const ADULT = ['suggestive', 'explicit'];

function cleanFilters(f = {}) {
  const out = {};
  for (const [k, levels] of Object.entries(FILTER_LEVELS)) if (levels.includes(f?.[k])) out[k] = f[k];
  return out;
}

const needsUnlock = (filters) => ADULT.includes(filters.sexual) && !loadConfig().content?.adultUnlockedAt;

export function personaTools(cfg, services = {}) {
  return [
    {
      name: 'persona_list',
      group: 'switch or adjust your own character',
      description: 'Lists the characters the user has set up, marking the active one.',
      schema: { type: 'object', properties: {} },
      run: async () => {
        const c = loadConfig();
        return c.personas.map((p) => ({ name: p.name, active: p.id === c.activePersonaId, personality: p.personality.slice(0, 160) }));
      },
    },
    {
      name: 'persona_switch',
      group: 'switch or adjust your own character',
      description: 'Switches to another of the user\'s characters (personality, voice and skin change). Use it when the user asks you to become another character or mode, e.g. "work mode" or a character name.',
      schema: { type: 'object', properties: { name: { type: 'string', description: 'Character name (case-insensitive).' } }, required: ['name'] },
      run: async ({ name }) => {
        const c = loadConfig();
        const wanted = String(name || '').trim().toLowerCase();
        const p = c.personas.find((x) => x.name.toLowerCase() === wanted || x.id === name) || c.personas.find((x) => x.name.toLowerCase().includes(wanted) && wanted);
        if (!p) throw new Error(`No character called "${name}". Available: ${c.personas.map((x) => x.name).join(', ')}`);
        services.switchPersona?.(p.id, { greet: false });
        return `Switched to ${p.name}. From your next message on you are ${p.name}.`;
      },
    },
    {
      name: 'persona_update',
      group: 'switch or adjust your own character',
      description:
        'Adjusts YOUR current character when the user asks (e.g. "be grumpier", "no swearing", "be more formal"). Can rewrite the personality or context and change content filters: language avoid|mild|free, violence avoid|moderate|free, politics neutral|opinions, romance off|light|on, sexual off|suggestive|explicit. Loosening a filter asks the user to confirm; 18+ levels require the user to unlock adult content in Settings first.',
      schema: {
        type: 'object',
        properties: {
          personality: { type: 'string', description: 'Full new personality text (replaces the current one).' },
          scenario: { type: 'string', description: 'New context / relationship text.' },
          filters: { type: 'object', properties: Object.fromEntries(Object.entries(FILTER_LEVELS).map(([k, v]) => [k, { type: 'string', enum: v }])) },
        },
      },
      confirm: (input) => {
        const p = activePersona(loadConfig());
        const f = cleanFilters(input.filters);
        if (needsUnlock({ ...p.filters, ...f })) return null; // run() explica que hace falta el desbloqueo
        const looser = Object.keys(f).filter((k) => isLooser(k, p.filters[k], f[k]));
        if (!looser.length) return null;
        return {
          title: t('confirm.persona.title'),
          message: t('confirm.persona.message', { name: p.name }),
          detail: looser.map((k) => `${t(`settings.personas.filter.${k}`)}: ${t(`settings.personas.level.${p.filters[k]}`)} → ${t(`settings.personas.level.${f[k]}`)}`).join('\n'),
          allowAlways: false,
        };
      },
      run: async (input) => {
        const c = loadConfig();
        const p = activePersona(c);
        const f = cleanFilters(input.filters);
        if (needsUnlock({ ...p.filters, ...f })) {
          services.openWindow?.('settings', { query: { tab: 'personas' } });
          throw new Error('The user must unlock adult content in Settings → Characters first. Settings has been opened for them.');
        }
        const next = { ...p, filters: { ...p.filters, ...f } };
        if (typeof input.personality === 'string' && input.personality.trim()) next.personality = input.personality.trim();
        if (typeof input.scenario === 'string') next.scenario = input.scenario.trim();
        patchConfig({ personas: c.personas.map((x) => (x.id === p.id ? next : x)) });
        services.configChanged?.();
        return `Updated ${p.name}. Filters: ${Object.entries(next.filters).map(([k, v]) => `${k}=${v}`).join(', ')}.`;
      },
    },
  ];
}
