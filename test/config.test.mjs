import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { __test } from 'electron';
import { defaultConfig, effectiveLocale, providerPresets, loadConfig, patchConfig, setSecret, getSecret, hasSecret } from '../src/main/config.js';
import { setLocale } from '../src/shared/i18n/index.js';

test('defaultConfig(): textos por defecto en el idioma del sistema', () => {
  const ru = defaultConfig('ru');
  assert.match(ru.assistant.personality, /остроумная/);
  assert.equal(ru.voice.stt.language, 'ru');
  assert.equal(ru.ui.language, 'auto');
  assert.equal(ru.assistant.language, '');
  assert.match(defaultConfig('es').assistant.personality, /ingeniosa/);
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
  assert.equal(before.assistant.name, 'Noa');
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
