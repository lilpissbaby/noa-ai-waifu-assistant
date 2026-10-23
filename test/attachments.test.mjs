import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { __test } from 'electron';
import { saveImageAttachment, attachmentBase64, attachmentUrl, clearAttachments, prepareImages, hasImages } from '../src/main/attachments.js';
import { isUserAllowed } from '../src/main/bundle-allowed.js';

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

test('guardar, leer y borrar adjuntos de imagen', () => {
  const att = saveImageAttachment(PNG, 'image/png', 'captura.png');
  assert.equal(att.kind, 'image');
  assert.equal(att.mime, 'image/png');
  assert.equal(att.name, 'captura.png');
  assert.match(att.file, /^[\w-]+\.png$/);
  assert.ok(fs.existsSync(path.join(__test.userData, 'attachments', att.file)));
  assert.equal(attachmentBase64(att), PNG.toString('base64'));
  assert.equal(attachmentBase64({ ...att, data: 'AAA' }), 'AAA');
  assert.equal(attachmentUrl(att), `app://local/user/attachments/${att.file}`);
  assert.equal(attachmentBase64({ kind: 'image', file: '../config.json', mime: 'image/png' }), null);
  clearAttachments();
  assert.equal(attachmentBase64(att), null);
  assert.ok(!fs.existsSync(path.join(__test.userData, 'attachments', att.file)));
});

const img = (n) => ({ kind: 'image', file: `${n}.png`, mime: 'image/png', name: `foto${n}.png` });

test('prepareImages: solo las imágenes de las tres últimas intervenciones van como imagen', () => {
  const history = [];
  for (let i = 1; i <= 5; i++) {
    history.push({ role: 'user', content: `mira ${i}`, attachments: [img(i)] });
    history.push({ role: 'assistant', content: 'ok', toolCalls: [{ id: `t${i}`, name: 'screen_capture', input: {} }] });
    history.push({ role: 'tool', toolCallId: `t${i}`, name: 'screen_capture', content: 'Screenshot attached (10x10).', images: [img(`s${i}`)] });
  }
  const copy = structuredClone(history);
  const out = prepareImages(history);
  assert.deepEqual(history, copy, 'no modifica el original');
  const users = out.filter((m) => m.role === 'user');
  assert.deepEqual(
    users.map((m) => m.attachments[0].kind),
    ['text', 'text', 'image', 'image', 'image'],
  );
  assert.deepEqual(users[0].attachments[0], { kind: 'text', name: 'foto1.png', text: '[image: foto1.png]' });
  const tools = out.filter((m) => m.role === 'tool');
  assert.deepEqual(
    tools.map((m) => (m.images || []).length),
    [0, 0, 1, 1, 1],
  );
  assert.match(tools[0].content, /\[image: fotos1\.png\]/);
  assert.equal(hasImages(out), true);
  assert.equal(hasImages(prepareImages(history, 0)), false);
  assert.equal(hasImages([{ role: 'user', content: 'hola' }]), false);
});

test('el protocolo app://local/user/ solo sirve carpetas de contenido', () => {
  for (const ok of ['voices/es/model.onnx', 'attachments/a.png', 'skins/x/skin.json', 'personas/p.png', 'runtime/piper/x.wasm', 'motions/m.fbx', 'tmp/a.vrm', 'models/seg.onnx', 'live2d/m/model3.json'])
    assert.equal(isUserAllowed(ok), true, ok);
  for (const bad of ['secrets.json', 'config.json', 'conversation.json', 'memory.json', 'attachments', '../x', 'voices/../secrets.json', ''])
    assert.equal(isUserAllowed(bad), false, bad);
});
