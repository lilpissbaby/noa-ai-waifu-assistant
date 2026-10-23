#!/usr/bin/env node
// Descarga lo necesario para probar Live2D (solo para la prueba de humo y el CI; nunca va al repo):
//   - el «Cubism SDK for Web» oficial (de él se saca el Cubism Core, propietario de Live2D) y
//   - el modelo de ejemplo Hiyori de github.com/Live2D/CubismWebSamples (rama develop).
// Uso: node tools/fetch-live2d-fixtures.mjs <carpeta>   → la prueba de humo usa WAIFU_TEST_LIVE2D_DIR=<carpeta>
import fs from 'node:fs';
import path from 'node:path';

const SDK_URLS = ['https://cubism.live2d.com/sdk-web/bin/CubismSdkForWeb-5-r.5.zip', 'https://cubism.live2d.com/sdk-web/bin/CubismSdkForWeb-5-r.4.zip'];
const HIYORI = 'https://raw.githubusercontent.com/Live2D/CubismWebSamples/develop/Samples/Resources/Hiyori/';

const dir = path.resolve(process.argv[2] || 'live2d-fixtures');
fs.mkdirSync(dir, { recursive: true });

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

let sdkOk = fs.existsSync(path.join(dir, 'CubismSdkForWeb.zip'));
for (const url of sdkOk ? [] : SDK_URLS) {
  try {
    fs.writeFileSync(path.join(dir, 'CubismSdkForWeb.zip'), await get(url));
    console.log(`SDK: ${url}`);
    sdkOk = true;
    break;
  } catch (e) {
    console.warn(`SDK no disponible (${e.message})`);
  }
}

const model = path.join(dir, 'Hiyori');
const model3 = JSON.parse((await get(`${HIYORI}Hiyori.model3.json`)).toString('utf8'));
const refs = model3.FileReferences;
const files = ['Hiyori.model3.json', refs.Moc, ...refs.Textures, refs.Physics, refs.Pose, refs.UserData, refs.DisplayInfo, ...Object.values(refs.Motions || {}).flatMap((g) => g.map((m) => m.File))].filter(Boolean);
for (const f of files) {
  const to = path.join(model, ...f.split('/'));
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, await get(HIYORI + f.split('/').map(encodeURIComponent).join('/')));
}
console.log(`Hiyori: ${files.length} archivos en ${model}`);
if (!sdkOk) {
  console.warn('Sin SDK: la prueba de Live2D se omitirá (o pon live2dcubismcore.min.js en la carpeta).');
}
