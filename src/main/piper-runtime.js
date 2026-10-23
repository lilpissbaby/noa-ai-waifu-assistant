// Motor de las voces locales Piper: el fonemizador (espeak-ng compilado a WebAssembly, GPL) no va
// dentro de la app; se descarga una vez del registro de npm, se comprueba su integridad y se guarda
// en userData/runtime/piper/. La inferencia la hace onnxruntime-web, que sí va incluido.
import { net } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { userDir } from './config.js';
import { extractTarGz, verifyIntegrity } from './tar.js';
import { t } from '../shared/i18n/index.js';

export const PIPER_WASM = {
  name: '@diffusionstudio/piper-wasm',
  version: '1.0.0',
  tarball: 'https://registry.npmjs.org/@diffusionstudio/piper-wasm/-/piper-wasm-1.0.0.tgz',
  integrity: 'sha512-4Hgh7wJ1PuGEVgVi1CpducESnyXwjFRJN4zXjYRpxgquM+Zh6Eqq8ZaiGpCKm4yXvT1Y2SPQXbv0dEckFD9NaQ==',
  files: ['piper_phonemize.js', 'piper_phonemize.wasm', 'piper_phonemize.data'],
  sizeMB: 9,
};

const dir = () => path.join(userDir(), 'runtime', 'piper');
export const piperRuntimeUrl = () => 'app://local/user/runtime/piper/';

export function piperRuntimeStatus() {
  const ready = PIPER_WASM.files.every((f) => fs.existsSync(path.join(dir(), f))) && fs.existsSync(path.join(dir(), 'VERSION'));
  return { ready, url: ready ? piperRuntimeUrl() : null, sizeMB: PIPER_WASM.sizeMB };
}

// Instala desde un tarball ya descargado (también lo usan los tests).
const integrityError = () => Object.assign(new Error(t('errors.integrity')), { code: 'integrity' });

export function installPiperRuntime(tgz) {
  if (!verifyIntegrity(tgz, PIPER_WASM.integrity)) throw integrityError();
  const files = extractTarGz(tgz, { want: (n) => PIPER_WASM.files.some((f) => n === `package/build/${f}`), maxBytes: 60 * 1024 * 1024 });
  if (files.size !== PIPER_WASM.files.length) throw integrityError();
  fs.mkdirSync(dir(), { recursive: true });
  for (const [name, data] of files) fs.writeFileSync(path.join(dir(), path.basename(name)), data);
  fs.writeFileSync(path.join(dir(), 'VERSION'), `${PIPER_WASM.name}@${PIPER_WASM.version}\n`);
  return piperRuntimeStatus();
}

let downloading = null;
export function downloadPiperRuntime(onProgress) {
  if (downloading) return downloading;
  downloading = (async () => {
    const res = await net.fetch(PIPER_WASM.tarball);
    if (!res.ok) throw new Error(t('errors.download', { status: res.status }));
    const total = Number(res.headers.get('content-length')) || PIPER_WASM.sizeMB * 1e6;
    const chunks = [];
    let done = 0;
    const reader = res.body.getReader();
    for (;;) {
      const { value, done: end } = await reader.read();
      if (end) break;
      chunks.push(Buffer.from(value));
      done += value.length;
      onProgress?.(Math.min(0.99, done / total));
    }
    const st = installPiperRuntime(Buffer.concat(chunks));
    onProgress?.(1);
    return st;
  })().finally(() => {
    downloading = null;
  });
  return downloading;
}
