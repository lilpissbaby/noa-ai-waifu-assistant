import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { __test } from 'electron';
import { listVoices, fetchCatalog, catalogForLanguage, installFromCatalog, importVoiceFiles, deleteVoice, licenseFromModelCard, VOICE_MAX_BYTES } from '../src/main/voices.js';
import { makeZip } from './helpers/zip.mjs';
import { serve } from './helpers/http.mjs';

const fixtures = new URL('./fixtures/piper/', import.meta.url);
const voicesDir = path.join(__test.userData, 'voices');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'waifu-voices-'));
const config = (extra = {}) =>
  JSON.stringify({ audio: { sample_rate: 22050, quality: 'medium' }, espeak: { voice: 'es' }, phoneme_id_map: { _: [0], a: [14] }, num_speakers: 1, speaker_id_map: {}, ...extra });
const write = (name, data) => {
  const p = path.join(tmp, name);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, data);
  return p;
};
const md5 = (b) => crypto.createHash('md5').update(b).digest('hex');

test('importar .onnx + .onnx.json crea voice.json con idioma y hablantes', async () => {
  const onnx = write('es_ES-prueba-medium.onnx', Buffer.alloc(1000, 1));
  const json = write('es_ES-prueba-medium.onnx.json', config({ language: { code: 'es_ES' }, num_speakers: 3, speaker_id_map: { ana: 0, bea: 1, carla: 2 } }));
  const [v] = await importVoiceFiles([onnx, json]);
  assert.equal(v.key, 'es_ES-prueba-medium');
  assert.equal(v.language, 'es_ES');
  assert.equal(v.speakers, 3);
  assert.deepEqual(v.speakerNames, ['ana', 'bea', 'carla']);
  assert.equal(v.quality, 'medium');
  assert.equal(v.name, 'prueba');
  const saved = JSON.parse(fs.readFileSync(path.join(voicesDir, v.key, 'voice.json'), 'utf8'));
  assert.equal(saved.language, 'es_ES');
  assert.ok(fs.existsSync(path.join(voicesDir, v.key, 'model.onnx')));
  const listed = listVoices().find((x) => x.key === v.key);
  assert.equal(listed.modelUrl, 'app://local/user/voices/es_ES-prueba-medium/model.onnx');
  assert.equal(listed.configUrl, 'app://local/user/voices/es_ES-prueba-medium/model.onnx.json');
});

test('el .json se encuentra junto al .onnx aunque no se elija, y sin language usa espeak', async () => {
  const onnx = write('suelta/es-mls_9972-low.onnx', Buffer.alloc(10, 2));
  write('suelta/es-mls_9972-low.onnx.json', config({ audio: { sample_rate: 16000 } }));
  fs.copyFileSync(new URL('MODEL_CARD', fixtures), path.join(tmp, 'suelta', 'MODEL_CARD'));
  const [v] = await importVoiceFiles([onnx]);
  assert.equal(v.key, 'es-mls_9972-low');
  assert.equal(v.language, 'es');
  assert.equal(v.quality, 'low');
  assert.equal(v.license, 'CC BY 4.0');
  assert.equal(v.source, 'import');
});

test('un .zip con dos voces instala las dos', async () => {
  const zip = write(
    'pack.zip',
    makeZip([
      { name: 'pack/uno/en_US-uno-low.onnx', data: Buffer.alloc(50, 3) },
      { name: 'pack/uno/en_US-uno-low.onnx.json', data: config({ language: { code: 'en_US' } }) },
      { name: 'pack/dos/de_DE-dos-high.onnx', data: Buffer.alloc(50, 4) },
      { name: 'pack/dos/de_DE-dos-high.json', data: config({ language: { code: 'de_DE' } }) },
      { name: 'pack/LEEME.txt', data: 'hola' },
    ]),
  );
  const got = await importVoiceFiles([zip]);
  assert.deepEqual(got.map((v) => v.key).sort(), ['de_DE-dos-high', 'en_US-uno-low']);
  assert.ok(listVoices().some((v) => v.key === 'de_DE-dos-high' && v.language === 'de_DE'));
});

test('un .onnx sin su .json da un error claro y no instala nada', async () => {
  const onnx = write('sola/xx-nada-low.onnx', Buffer.alloc(10));
  await assert.rejects(importVoiceFiles([onnx]), (e) => e.code === 'noConfig' && e.message.includes('xx-nada-low.onnx'));
  assert.ok(!fs.existsSync(path.join(voicesDir, 'xx-nada-low')));
  const bad = write('mala/yy-mala-low.onnx', Buffer.alloc(10));
  write('mala/yy-mala-low.onnx.json', '{"no": "es piper"}');
  await assert.rejects(importVoiceFiles([bad]), (e) => e.code === 'badConfig');
  assert.ok(!fs.existsSync(path.join(voicesDir, 'yy-mala-low')));
});

test('límite de tamaño por voz', () => {
  assert.equal(VOICE_MAX_BYTES, 300 * 1024 * 1024);
});

test('el catálogo se filtra por idioma y se guarda en caché', async () => {
  const sample = fs.readFileSync(new URL('voices-sample.json', fixtures));
  const srv = await serve((_req, res) => res.writeHead(200, { 'content-type': 'application/json' }).end(sample));
  try {
    const all = await fetchCatalog({ force: true, url: `${srv.url}/voices.json` });
    assert.equal(all.length, 6);
    const es = catalogForLanguage(all, 'es');
    assert.deepEqual(es.map((e) => e.key).sort(), ['es_ES-davefx-medium', 'es_ES-sharvard-medium', 'es_MX-claude-high']);
    const dave = es.find((e) => e.key === 'es_ES-davefx-medium');
    assert.equal(dave.languageName, 'Español (Spain)');
    assert.equal(dave.quality, 'medium');
    assert.equal(dave.sizeMB, 63);
    assert.equal(es.find((e) => e.key === 'es_ES-sharvard-medium').speakers, 2);
    assert.equal(catalogForLanguage(all, '').length, 6);
    // Segunda llamada: sale de la caché aunque el servidor ya no responda.
    await srv.close();
    assert.equal((await fetchCatalog({ url: `${srv.url}/voices.json` })).length, 6);
  } finally {
    await srv.close().catch(() => {});
  }
});

test('instalar del catálogo comprueba el md5: si no cuadra no se instala nada', async () => {
  const onnx = Buffer.alloc(3000, 9);
  const json = Buffer.from(config({ language: { code: 'it_IT' } }));
  const card = fs.readFileSync(new URL('MODEL_CARD', fixtures));
  const base = 'it/it_IT/riccardo/x_low';
  const catalog = (good) => ({
    'it_IT-riccardo-x_low': {
      key: 'it_IT-riccardo-x_low',
      name: 'riccardo',
      language: { code: 'it_IT', family: 'it', region: 'IT', name_native: 'Italiano', country_english: 'Italy' },
      quality: 'x_low',
      num_speakers: 1,
      speaker_id_map: {},
      files: {
        [`${base}/it_IT-riccardo-x_low.onnx`]: { size_bytes: onnx.length, md5_digest: good ? md5(onnx) : md5(Buffer.from('otra cosa')) },
        [`${base}/it_IT-riccardo-x_low.onnx.json`]: { size_bytes: json.length, md5_digest: md5(json) },
        [`${base}/MODEL_CARD`]: { size_bytes: card.length, md5_digest: md5(card) },
      },
    },
  });
  let good = false;
  const srv = await serve((req, res) => {
    if (req.url === '/voices.json') return res.writeHead(200).end(JSON.stringify(catalog(good)));
    const file = req.url.endsWith('.onnx') ? onnx : req.url.endsWith('.onnx.json') ? json : req.url.endsWith('MODEL_CARD') ? card : null;
    if (!file) return res.writeHead(404).end();
    res.writeHead(200, { 'content-length': file.length }).end(file);
  });
  try {
    await fetchCatalog({ force: true, url: `${srv.url}/voices.json` });
    await assert.rejects(installFromCatalog('it_IT-riccardo-x_low', null, { baseUrl: `${srv.url}/` }), (e) => e.code === 'integrity');
    assert.ok(!fs.existsSync(path.join(voicesDir, 'it_IT-riccardo-x_low')));

    good = true;
    await fetchCatalog({ force: true, url: `${srv.url}/voices.json` });
    const progress = [];
    const v = await installFromCatalog('it_IT-riccardo-x_low', (p) => progress.push(p), { baseUrl: `${srv.url}/` });
    assert.equal(v.language, 'it_IT');
    assert.equal(v.source, 'catalog');
    assert.equal(v.license, 'CC BY 4.0');
    assert.equal(progress.at(-1), 1);
    assert.ok(srv.requests.some((r) => r.url === `/${base}/it_IT-riccardo-x_low.onnx`));
  } finally {
    await srv.close();
  }
});

test('borrar una voz', async () => {
  assert.throws(() => deleteVoice('../config'), (e) => e.code === 'badKey');
  const onnx = write('borrar/zz-borrar-low.onnx', Buffer.alloc(10));
  write('borrar/zz-borrar-low.onnx.json', config());
  await importVoiceFiles([onnx]);
  assert.ok(listVoices().some((v) => v.key === 'zz-borrar-low'));
  deleteVoice('zz-borrar-low');
  assert.ok(!listVoices().some((v) => v.key === 'zz-borrar-low'));
  assert.ok(!fs.existsSync(path.join(voicesDir, 'zz-borrar-low')));
});

test('licenseFromModelCard', () => {
  assert.equal(licenseFromModelCard(fs.readFileSync(new URL('MODEL_CARD', fixtures), 'utf8')), 'CC BY 4.0');
  assert.equal(licenseFromModelCard('# Model card\n\n* Dataset license: [Public domain](https://x)\n'), 'Public domain');
  assert.equal(licenseFromModelCard('# Card\n\nVoz entrenada con datos propios.\nUso libre.\n\n## Más'), 'Voz entrenada con datos propios. Uso libre.');
  assert.equal(licenseFromModelCard(''), '');
});
