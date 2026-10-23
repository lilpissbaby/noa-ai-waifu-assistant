#!/usr/bin/env node
// Convierte los fallos de una salida de `npm test` o de la prueba de humo en anotaciones de GitHub
// (::error), que se ven en el resumen de la ejecución y por la API sin abrir el log completo.
// Uso: node tools/ci-annotate.mjs <salida.txt> [título]
import fs from 'node:fs';

const [file, title = 'fallo'] = process.argv.slice(2);
const lines = (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '').split(/\r?\n/);
const blocks = [];
for (let i = 0; i < lines.length; i++) {
  // node:test: «not ok N - nombre» y su bloque YAML (error, expected, actual, location) hasta «...».
  if (/^\s*not ok \d+ - /.test(lines[i])) {
    const out = [lines[i].trim()];
    for (let j = i + 1; j < lines.length && j < i + 40 && !/^\s*\.\.\.\s*$/.test(lines[j]); j++) out.push(lines[j]);
    blocks.push(out.join('\n'));
  } else if (lines[i].includes('✗')) blocks.push(lines.slice(Math.max(0, i - 2), i + 6).join('\n'));
}
const last = `Últimas líneas:\n${lines.slice(-40).join('\n')}`;
const esc = (s) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
for (const b of [...blocks.slice(0, 8), last]) console.log(`::error title=${title}::${esc(b.slice(0, 4000))}`);
