import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EmotionTagFilter, stripEmotionTags, EMOTIONS } from '../src/main/llm/emotion.js';

// Pasa el texto por el filtro en trozos del tamaño indicado y junta el resultado.
function run(text, size = text.length) {
  const f = new EmotionTagFilter();
  let out = '';
  const emotions = [];
  for (let i = 0; i < text.length; i += size) {
    const r = f.push(text.slice(i, i + size));
    out += r.text;
    emotions.push(...r.emotions);
  }
  const end = f.flush();
  out += end.text;
  emotions.push(...end.emotions);
  return { text: out, emotions };
}

test('EMOTIONS', () => {
  assert.deepEqual(EMOTIONS, ['happy', 'angry', 'sad', 'relaxed', 'surprised', 'neutral']);
});

test('quita la etiqueta y devuelve la emoción', () => {
  assert.deepEqual(run('<emo:happy>¡Hola!'), { text: '¡Hola!', emotions: ['happy'] });
});

test('funciona aunque llegue troceada en cualquier punto', () => {
  const text = 'Vale. <emo:surprised>¿En serio? <emo:happy>¡Genial!';
  for (const size of [1, 2, 3, 5, 7]) assert.deepEqual(run(text, size), { text: 'Vale. ¿En serio? ¡Genial!', emotions: ['surprised', 'happy'] }, `trozos de ${size}`);
});

test('deja intactos los < que no son etiquetas', () => {
  for (const s of ['a < b y <div>', '<em>texto</em>', '<emo>', '<emotion>', 'x <e', '<<emo:sad>'])
    assert.equal(run(s, 1).text, s === '<<emo:sad>' ? '<' : s, s);
});

test('una emoción desconocida se borra sin emitir nada', () => {
  assert.deepEqual(run('<emo:xyz>hola', 1), { text: 'hola', emotions: [] });
});

test('dentro de un bloque de código no filtra', () => {
  const text = 'Mira:\n```js\nconst s = "<emo:sad>";\n```\n<emo:happy>Listo';
  assert.deepEqual(run(text, 2), { text: 'Mira:\n```js\nconst s = "<emo:sad>";\n```\nListo', emotions: ['happy'] });
});

test('flush() devuelve como texto una etiqueta a medias', () => {
  assert.deepEqual(run('Hola <emo:ha'), { text: 'Hola <emo:ha', emotions: [] });
});

test('stripEmotionTags() para textos completos', () => {
  assert.equal(stripEmotionTags('<emo:happy>Hola. <emo:sad>Vaya.'), 'Hola. Vaya.');
  assert.equal(stripEmotionTags('sin etiquetas'), 'sin etiquetas');
});
