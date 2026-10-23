import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SUPPORTED } from '../src/shared/i18n/index.js';
import { defaultActions, composeAction, actionsFor, clipboardText, QUICK_ACTION_IDS } from '../src/shared/quick-actions.js';

test('las cinco acciones por defecto existen en los cinco idiomas y usan {text}', () => {
  assert.deepEqual(QUICK_ACTION_IDS, ['translate', 'summarize', 'correct', 'explain', 'reply']);
  for (const locale of SUPPORTED) {
    const list = defaultActions(locale);
    assert.deepEqual(
      list.map((a) => a.id),
      QUICK_ACTION_IDS,
    );
    for (const a of list) {
      assert.ok(a.name && !a.name.startsWith('quickActions.'), `${locale} ${a.id} name`);
      assert.ok(a.prompt.includes('{text}'), `${locale} ${a.id} prompt`);
      assert.equal(typeof a.copyResult, 'boolean');
    }
    assert.ok(list.find((a) => a.id === 'translate').prompt.includes('{language}'), locale);
  }
  assert.notEqual(defaultActions('es')[0].name, defaultActions('en')[0].name);
});

test('composeAction sustituye {text} y {language}; sin {text} lo añade al final; vacío → null', () => {
  const a = { id: 'x', name: 'X', prompt: 'Traduce al {language}:\n\n{text}', copyResult: true };
  assert.equal(composeAction(a, 'hello', { language: 'Spanish' }), 'Traduce al Spanish:\n\nhello');
  assert.equal(composeAction({ ...a, prompt: 'Resume esto' }, '  texto largo  ', { language: 'es' }), 'Resume esto\n\ntexto largo');
  assert.equal(composeAction(a, '   \n ', { language: 'es' }), null);
  assert.equal(composeAction(a, '', { language: 'es' }), null);
  // Los $ del texto no se interpretan como patrones de reemplazo.
  assert.equal(composeAction({ ...a, prompt: '{text}' }, 'cuesta $& 5$', {}), 'cuesta $& 5$');
});

test('actionsFor usa las del usuario si las hay', () => {
  const custom = [{ id: 'mine', name: 'Mía', prompt: 'Haz algo con {text}', copyResult: false }];
  assert.deepEqual(actionsFor({ productivity: { quickActions: custom } }, 'es'), custom);
  assert.equal(actionsFor({ productivity: { quickActions: null } }, 'en').length, 5);
});

test('clipboardText quita las vallas de código', () => {
  assert.equal(clipboardText('```\nhola mundo\n```'), 'hola mundo');
  assert.equal(clipboardText('Aquí tienes:\n\n```js\nconst a = 1;\n```\n'), 'Aquí tienes:\n\nconst a = 1;');
  assert.equal(clipboardText('  texto normal  '), 'texto normal');
});
