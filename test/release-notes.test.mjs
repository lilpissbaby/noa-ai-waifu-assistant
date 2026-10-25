import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const notes = (v) => execFileSync(process.execPath, [path.join(import.meta.dirname, '..', 'tools', 'release-notes.mjs'), v], { encoding: 'utf8' });

test('release-notes: une las líneas partidas pero respeta las sublistas', () => {
  const out = notes('0.4.0');
  // Cada sub-viñeta sigue en su línea…
  assert.match(out, /\n {2}- Recordatorios y temporizadores, también repetitivos, con aviso de los perdidos al abrir la app\.\n/);
  // …y sus líneas partidas se unen.
  assert.match(out, /\n {2}- Acciones rápidas \(`Ctrl\+Alt\+Q`\) sobre el texto copiado: traducir, resumir, corregir, explicar y responder, editables y ampliables\.\n/);
  assert.match(out, /- \*\*Personajes\*\*: varios a la vez, cada uno con su forma de ser, contexto, saludo, ejemplos de diálogo, instrucciones extra, voz y skin\. /);
  assert.match(out, /### Descargas/);
});
