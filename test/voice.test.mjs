import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setLocale } from '../src/shared/i18n/index.js';
import { speakable, SentenceChunker } from '../src/main/voice.js';

const chunks = (parts) => {
  const out = [];
  const c = new SentenceChunker((s) => out.push(s));
  for (const p of parts) c.push(p);
  c.flush();
  return out;
};

test('speakable(): quita markdown, código y enlaces', () => {
  setLocale('es');
  assert.equal(speakable('**Hola** `npm i` [docs](https://x.y) ```js\ncode()\n``` fin'), 'Hola npm i docs fin');
  assert.equal(speakable('Mira https://example.com ahora'), 'Mira el enlace ahora');
  setLocale('en');
  assert.equal(speakable('See https://example.com now'), 'See the link now');
  assert.equal(speakable('- uno\n- dos ✨'), 'uno dos');
});

test('SentenceChunker: corta por frases mientras llega el texto', () => {
  assert.deepEqual(chunks(['Hola. Qué tal', ' estás? Bien', '.']), ['Hola.', 'Qué tal estás?', 'Bien.']);
});

test('SentenceChunker: se salta los bloques de código', () => {
  assert.deepEqual(chunks(['Ahí va:\n```bash\ndocker ps\n```\nY ya.']), ['Ahí va:', 'Y ya.']);
});

test('SentenceChunker: entiende la puntuación china sin espacios', () => {
  assert.deepEqual(chunks(['你好！我是', '诺娅。今天做什么？']), ['你好！', '我是诺娅。', '今天做什么？']);
});

test('SentenceChunker: no emite trozos sin letras', () => {
  assert.deepEqual(chunks(['... !! ', '\n\n']), []);
});
