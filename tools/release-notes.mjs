#!/usr/bin/env node
// Notas de una release: el apartado de esa versión en CHANGELOG.md + qué archivo descargar.
// Uso: node tools/release-notes.mjs 0.2.0 > notes.md
import fs from 'node:fs';
import path from 'node:path';

const version = process.argv[2];
if (!version) {
  console.error('Uso: node tools/release-notes.mjs <versión>');
  process.exit(1);
}
const root = path.resolve(import.meta.dirname, '..');
const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');

// Apartado «## [0.2.0] …» hasta el siguiente «## ».
const lines = changelog.split(/\r?\n/);
const start = lines.findIndex((l) => new RegExp(`^##\\s+\\[?v?${version.replace(/\./g, '\\.')}\\]?(\\s|$)`).test(l));
let body = '';
if (start !== -1) {
  let end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
  if (end === -1) end = lines.length;
  body = lines
    .slice(start + 1, end)
    .join('\n')
    .replace(/\n {2,}(?=\S)/g, ' ') // une las líneas partidas de cada viñeta (las notas de GitHub respetan los saltos)
    .trim();
}
if (!body) body = `Waifu Desk ${version}.`;

const downloads = `
### Descargas

| Sistema | Archivo |
| --- | --- |
| Windows 10/11 (instalador) | \`WaifuDesk-Setup-${version}.exe\` |
| Windows (portable) | \`WaifuDesk-${version}-win-x64.zip\` |
| Linux (cualquier distro) | \`WaifuDesk-${version}-linux-x86_64.AppImage\` |
| Debian / Ubuntu | \`WaifuDesk-${version}-linux-amd64.deb\` |

El instalador de Windows no está firmado: SmartScreen avisará la primera vez (**Más información → Ejecutar de todos modos**).
Las sumas SHA-256 están en \`SHA256SUMS.txt\`.`;

process.stdout.write(`${body}\n${downloads}\n`);
