#!/usr/bin/env node
// Escribe el import map de src/shared/vendor.js en las páginas indicadas y actualiza el hash de su CSP.
//   node tools/importmap.mjs src/renderer/avatar/avatar.html [otra.html…]
import crypto from 'node:crypto';
import fs from 'node:fs';
import { IMPORT_MAP } from '../src/shared/vendor.js';

const json = JSON.stringify(IMPORT_MAP);
const hash = `'sha256-${crypto.createHash('sha256').update(json, 'utf8').digest('base64')}'`;
for (const file of process.argv.slice(2)) {
  let html = fs.readFileSync(file, 'utf8');
  const tag = `<script type="importmap">${json}</script>`;
  if (/<script type="importmap">[\s\S]*?<\/script>/.test(html)) html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, tag);
  else html = html.replace(/(<meta http-equiv="Content-Security-Policy"[^>]*\/>\n)/, `$1    ${tag}\n`);
  html = html.replace(/(content="[^"]*script-src 'self')( 'sha256-[^']+')?/, `$1 ${hash}`);
  fs.writeFileSync(file, html);
  console.log(`${file}: ${hash}`);
}
