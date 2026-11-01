import { test } from 'node:test';
import * as headMotion from '../src/renderer/shared/head-motion.js';
const await_import_head = () => headMotion;
import assert from 'node:assert/strict';
import { EmotionTagFilter, stripEmotionTags, EMOTIONS, GESTURES } from '../src/main/llm/emotion.js';
import { EMOTIONS as CATALOG, GESTURES as GCATALOG, ALIASES, resolveEmotion, resolveGesture, EMOTION_GROUPS, IDLE_GESTURES, expressionPrompt } from '../src/shared/expressions.js';

// Pasa el texto por el filtro en trozos del tamaño indicado y junta el resultado.
function run(text, size = text.length) {
  const f = new EmotionTagFilter();
  let out = '';
  const emotions = [];
  const gestures = [];
  for (let i = 0; i < text.length; i += size) {
    const r = f.push(text.slice(i, i + size));
    out += r.text;
    emotions.push(...r.emotions);
    gestures.push(...r.gestures);
  }
  const end = f.flush();
  out += end.text;
  emotions.push(...end.emotions);
  return gestures.length ? { text: out, emotions, gestures } : { text: out, emotions };
}

test('EMOTIONS: las cinco clásicas y muchas más, sin repetir', () => {
  for (const n of ['happy', 'angry', 'sad', 'relaxed', 'surprised', 'neutral', 'love', 'shy', 'flirty', 'crying', 'sleepy', 'dizzy']) assert.ok(EMOTIONS.includes(n), n);
  assert.ok(EMOTIONS.length >= 30, `${EMOTIONS.length}`);
  assert.equal(new Set(EMOTIONS).size, EMOTIONS.length);
  assert.ok(GESTURES.length >= 30, `${GESTURES.length}`);
});

test('catálogo: cada emoción y gesto apunta a cosas que existen', () => {
  const FX = ['sparkles', 'hearts', 'blush', 'notes', 'flowers', 'sigh', 'zzz', 'dots', 'question', 'exclaim', 'shock', 'gloom', 'sweat', 'tears', 'puff', 'anger', 'fire', 'stars', 'bulb'];
  const HEADS = Object.keys((await_import_head()).HEAD_PATTERNS);
  for (const [n, d] of Object.entries(CATALOG)) {
    for (const id of d.fx || []) assert.ok(FX.includes(id), `${n}: efecto ${id}`);
    if (d.move) assert.ok(HEADS.includes(d.move), `${n}: movimiento ${d.move}`);
    if (d.gesture) assert.ok(d.gesture in GCATALOG, `${n}: gesto ${d.gesture}`);
    if (n !== 'neutral') assert.ok(['happy', 'angry', 'sad', 'relaxed', 'surprised'].includes(d.base), `${n}: base`);
  }
  for (const [n, g] of Object.entries(GCATALOG)) {
    assert.ok(g.dur > 0.5 && g.dur <= 5, `${n}: duración`);
    if (g.head) assert.ok(HEADS.includes(g.head), `${n}: cabeza ${g.head}`);
    for (const id of g.fx || []) assert.ok(FX.includes(id), `${n}: efecto ${id}`);
  }
  for (const [k, v] of Object.entries(ALIASES.emo)) assert.ok(v in CATALOG, `alias ${k} → ${v}`);
  for (const [k, v] of Object.entries(ALIASES.act)) assert.ok(v in GCATALOG, `alias ${k} → ${v}`);
  const grouped = Object.values(EMOTION_GROUPS).flat();
  assert.deepEqual([...grouped].sort(), EMOTIONS.filter((n) => n !== 'neutral').sort(), 'los menús tienen todas las emociones una vez');
  for (const g of IDLE_GESTURES) assert.ok(g in GCATALOG, g);
});

test('resolveEmotion / resolveGesture: sinónimos, mayúsculas y tildes', () => {
  assert.equal(resolveEmotion('Joy'), 'happy');
  assert.equal(resolveEmotion('triste'), 'sad');
  assert.equal(resolveEmotion('Vergüenza'), 'shy');
  assert.equal(resolveEmotion('xyz'), null);
  assert.equal(resolveGesture('HELLO'), 'wave');
  assert.equal(resolveGesture('guiño'), 'wink');
  assert.equal(resolveGesture('thumbsup'), 'thumbsup');
  assert.equal(resolveGesture(''), null);
});

test('expressionPrompt: lista emociones y, si se piden, gestos', () => {
  assert.match(expressionPrompt(), /crying/);
  assert.match(expressionPrompt(), /blowkiss/);
  assert.doesNotMatch(expressionPrompt({ gestures: false }), /<act:/);
});

test('etiquetas de gesto <act:…> y sinónimos en las dos', () => {
  assert.deepEqual(run('<act:wave>¡Hola! <emo:joy>Qué bien', 1), { text: '¡Hola! Qué bien', emotions: ['happy'], gestures: ['wave'] });
  assert.deepEqual(run('<act:inventado>hola', 1), { text: 'hola', emotions: [] });
  assert.equal(run('<a href="x">y</a> <act', 1).text, '<a href="x">y</a> <act');
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
