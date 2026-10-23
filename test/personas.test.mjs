import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FILTER_LEVELS,
  DEFAULT_FILTERS,
  HARD_LIMITS,
  normalizePersona,
  migratePersonas,
  activePersona,
  assistantName,
  effectiveFilters,
  isLooser,
  buildPersonaPrompt,
} from '../src/shared/personas.js';

const persona = (over = {}) => normalizePersona({ id: 'p1', name: 'Noa', personality: 'Cheerful.', ...over });
const cfgWith = (p, unlocked = false) => ({ assistant: { userName: 'mupsim' }, personas: [p], activePersonaId: p.id, content: { adultUnlockedAt: unlocked ? 1 : null } });

test('migración desde 0.3: el asistente pasa a ser el primer personaje', () => {
  const saved = { assistant: { name: 'Kira', userName: 'mupsim', personality: 'P', extraInstructions: 'X' }, ui: { skinId: 'noa-3d' } };
  const out = migratePersonas(saved);
  assert.equal(out.personas.length, 1);
  const p = out.personas[0];
  assert.equal(p.name, 'Kira');
  assert.equal(p.personality, 'P');
  assert.equal(p.extraInstructions, 'X');
  assert.deepEqual(p.filters, DEFAULT_FILTERS);
  assert.equal(out.activePersonaId, p.id);
  assert.equal(out.assistant.userName, 'mupsim');
  assert.equal('personality' in out.assistant, false);
  assert.equal(out.ui.skinId, 'noa-3d');
  assert.deepEqual(migratePersonas(out).personas, out.personas, 'una segunda migración no duplica');
});

test('migración sin datos del asistente no crea personajes (se usan los de serie)', () => {
  assert.equal(migratePersonas({ ui: {} }).personas, undefined);
});

test('los límites fijos van siempre en el prompt', () => {
  const free = persona({ filters: { language: 'free', violence: 'free', politics: 'opinions', romance: 'on', sexual: 'explicit' } });
  assert.ok(buildPersonaPrompt(free, cfgWith(free, true)).includes(HARD_LIMITS));
  const def = persona();
  assert.ok(buildPersonaPrompt(def, cfgWith(def)).includes(HARD_LIMITS));
});

test('explícito sin desbloqueo +18 cuenta como off', () => {
  const p = persona({ filters: { sexual: 'explicit' } });
  assert.equal(effectiveFilters(p, cfgWith(p)).sexual, 'off');
  assert.match(buildPersonaPrompt(p, cfgWith(p)), /Do not produce sexual content/);
  assert.equal(effectiveFilters(p, cfgWith(p, true)).sexual, 'explicit');
  assert.match(buildPersonaPrompt(p, cfgWith(p, true)), /explicit sexual content is allowed/i);
});

test('cada nivel de cada filtro da una instrucción distinta', () => {
  for (const [key, levels] of Object.entries(FILTER_LEVELS)) {
    const prompts = levels.map((lv) => {
      const p = persona({ filters: { [key]: lv } });
      return buildPersonaPrompt(p, cfgWith(p, true));
    });
    assert.equal(new Set(prompts).size, levels.length, key);
  }
});

test('niveles inválidos vuelven al valor por defecto', () => {
  assert.equal(normalizePersona({ filters: { sexual: 'mucho' } }).filters.sexual, 'off');
  const p = normalizePersona({});
  assert.ok(p.id && p.name);
  assert.deepEqual(p.filters, DEFAULT_FILTERS);
});

test('personaje activo y nombre del asistente', () => {
  const a = persona({ id: 'a', name: 'Ana' });
  const b = persona({ id: 'b', name: 'Bea' });
  const cfg = { personas: [a, b], activePersonaId: 'b' };
  assert.equal(activePersona(cfg).name, 'Bea');
  assert.equal(assistantName(cfg), 'Bea');
  assert.equal(assistantName({ personas: [a, b], activePersonaId: 'zzz' }), 'Ana');
});

test('isLooser compara niveles', () => {
  assert.equal(isLooser('sexual', 'off', 'suggestive'), true);
  assert.equal(isLooser('language', 'free', 'mild'), false);
  assert.equal(isLooser('politics', 'neutral', 'neutral'), false);
});

test('el prompt incluye nombre, contexto, ejemplos e instrucciones extra', () => {
  const p = persona({ name: 'Rin', scenario: 'Old friends.', examples: '<START> hi', extraInstructions: 'EXTRA' });
  const s = buildPersonaPrompt(p, cfgWith(p));
  assert.match(s, /You are Rin/);
  assert.match(s, /Old friends\./);
  assert.match(s, /<START> hi/);
  assert.match(s, /EXTRA/);
  assert.ok(s.indexOf('EXTRA') < s.indexOf(HARD_LIMITS), 'los límites van al final');
});
