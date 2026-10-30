#!/usr/bin/env node
// Descarga todos los modelos de tools/gallery-models.mjs a una carpeta, para generar las miniaturas
// de la galería y la imagen del README con tools/automation/gallery.mjs:
//   node tools/gallery-fetch.mjs <carpeta>
// Los VRM quedan como <id>.vrm y los Live2D como <id>/<modelo>.model3.json con sus archivos.
import fs from 'node:fs';
import path from 'node:path';
import { ALL_MODELS } from './gallery-models.mjs';
import { fetchLive2dModel, safeRel } from '../src/shared/live2d-files.js';

const out = path.resolve(process.argv[2] || '');
if (!process.argv[2]) {
  console.error('Uso: node tools/gallery-fetch.mjs <carpeta>');
  process.exit(1);
}
fs.mkdirSync(out, { recursive: true });

async function get(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'WaifuDesk-docs' } });
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} ${url}`), { status: res.status });
  return Buffer.from(await res.arrayBuffer());
}

for (const m of ALL_MODELS) {
  try {
    if (m.kind === 'vrm') {
      const file = path.join(out, `${m.id}.vrm`);
      if (!fs.existsSync(file)) fs.writeFileSync(file, await get(m.url));
    } else {
      const dir = path.join(out, m.id);
      const name = decodeURIComponent(m.model.split('/').pop());
      if (!fs.existsSync(path.join(dir, name))) {
        const model = await fetchLive2dModel(m.model, get);
        for (const [rel, buf] of [...model.files, [model.name, model.main]]) {
          const to = path.join(dir, ...safeRel(rel));
          fs.mkdirSync(path.dirname(to), { recursive: true });
          fs.writeFileSync(to, buf);
        }
        if (model.dropped.length) console.log(`  (${m.id}: sin ${model.dropped.join(', ')})`);
      }
    }
    console.log(`✓ ${m.id}`);
  } catch (e) {
    console.error(`✗ ${m.id}: ${e.message}`);
    process.exitCode = 1;
  }
}
