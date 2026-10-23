import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { __test } from 'electron';
import { defaultConfig, effectiveLocale, providerPresets, loadConfig, patchConfig, setSecret, getSecret, hasSecret } from '../src/main/config.js';
import { setLocale } from '../src/shared/i18n/index.js';

test('defaultConfig(): textos por defecto en el idioma del sistema', () => {
  const ru = defaultConfig('ru');
  assert.match(ru.personas[0].personality, /остроумная/);
  assert.equal(ru.personas[0].name, 'Noa');
  assert.equal(ru.activePersonaId, ru.personas[0].id);
  assert.equal(ru.content.adultUnlockedAt, null);
  assert.equal(ru.voice.stt.language, 'ru');
  assert.equal(ru.ui.language, 'auto');
  assert.equal(ru.assistant.language, '');
  assert.match(defaultConfig('es').personas[0].personality, /ingeniosa/);
});

test('effectiveLocale(): «auto» sigue al sistema y un idioma fijo manda', () => {
  __test.setSystemLocales(['uk-UA']);
  assert.equal(effectiveLocale({ ui: { language: 'auto' } }), 'uk');
  assert.equal(effectiveLocale({ ui: { language: 'zh' } }), 'zh');
  __test.setSystemLocales(['fr-FR']);
  assert.equal(effectiveLocale({ ui: { language: 'auto' } }), 'en');
  __test.setSystemLocales(['es-ES', 'en-US']);
});

test('providerPresets(): el preset personalizado se traduce', () => {
  setLocale('en');
  assert.equal(providerPresets().custom.name, 'Custom (OpenAI-compatible)');
  setLocale('zh');
  assert.equal(providerPresets().ollama.name, 'Ollama (本地)');
  setLocale('es');
});

test('patchConfig(): mezcla en profundidad, sustituye arrays y guarda en disco', () => {
  const before = loadConfig();
  assert.equal(before.personas[0].name, 'Noa');
  patchConfig({ ui: { scale: 1.5 }, connectors: { webhooks: [{ id: 'w', name: 'a' }] } });
  const saved = JSON.parse(fs.readFileSync(path.join(__test.userData, 'config.json'), 'utf8'));
  assert.equal(saved.ui.scale, 1.5);
  assert.equal(saved.ui.alwaysOnTop, true);
  assert.deepEqual(saved.connectors.webhooks, [{ id: 'w', name: 'a' }]);
  patchConfig({ connectors: { webhooks: [] } });
  assert.deepEqual(loadConfig().connectors.webhooks, []);
});

test('secretos: se guardan, se leen y se borran (sin almacén seguro, ofuscados)', () => {
  setSecret('profile:x', 'sk-123');
  assert.equal(getSecret('profile:x'), 'sk-123');
  assert.equal(hasSecret('profile:x'), true);
  const raw = fs.readFileSync(path.join(__test.userData, 'secrets.json'), 'utf8');
  assert.doesNotMatch(raw, /sk-123/);
  setSecret('profile:x', '');
  assert.equal(hasSecret('profile:x'), false);
  assert.equal(getSecret('profile:x'), '');
});

test('loadConfig(): una configuración de la 0.3 se migra a personajes', async () => {
  const { resetConfigCache } = await import('../src/main/config.js');
  fs.writeFileSync(path.join(__test.userData, 'config.json'), JSON.stringify({ assistant: { name: 'Kira', personality: 'Seria.', userName: 'mupsim' }, ui: { skinId: 'noa-3d' } }));
  resetConfigCache();
  const cfg = loadConfig();
  assert.equal(cfg.personas.length, 1);
  assert.equal(cfg.personas[0].name, 'Kira');
  assert.equal(cfg.personas[0].personality, 'Seria.');
  assert.equal(cfg.activePersonaId, cfg.personas[0].id);
  assert.equal(cfg.assistant.userName, 'mupsim');
  assert.equal(cfg.ui.skinId, 'noa-3d');
  fs.rmSync(path.join(__test.userData, 'config.json'));
  resetConfigCache();
});

test('patchConfig: null explícito sustituye una lista (volver a las acciones de serie)', () => {
  patchConfig({ productivity: { quickActions: [{ id: 'a', name: 'A', prompt: '{text}', copyResult: false }] } });
  assert.equal(loadConfig().productivity.quickActions.length, 1);
  patchConfig({ productivity: { quickActions: null } });
  assert.equal(loadConfig().productivity.quickActions, null);
});
