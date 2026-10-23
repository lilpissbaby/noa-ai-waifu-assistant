// Voces Piper en la app real: instala el motor, importa la voz de prueba desde Ajustes, pone el
// modo Piper, pulsa «Probar voz» y comprueba que la boca del avatar se mueve con el audio.
// La voz llega por WAIFU_TEST_PIPER_VOICE (carpeta o .onnx); el motor se descarga del registro de npm,
// o se instala desde WAIFU_TEST_PIPER_RUNTIME (.tgz) si no hay red.
import fs from 'node:fs';
import path from 'node:path';
import { sleep, waitForWindow } from './common.mjs';

export async function piperCheck(api, voicePath, problems, check) {
  const { installPiperRuntime, downloadPiperRuntime } = await import('../../src/main/piper-runtime.js');
  const tgz = process.env.WAIFU_TEST_PIPER_RUNTIME;
  const st = tgz ? installPiperRuntime(fs.readFileSync(tgz)) : await downloadPiperRuntime();
  if (!st.ready) return problems.push('piper: el motor no quedó instalado');

  const files = fs.statSync(voicePath).isDirectory()
    ? fs
        .readdirSync(voicePath)
        .filter((f) => f.endsWith('.onnx'))
        .map((f) => path.join(voicePath, f))
    : [voicePath];
  const settings = api.openWindow('settings', { query: { tab: 'voice' } });
  await waitForWindow(settings, 'document.querySelector("#view h1")');
  const r = await settings.webContents.executeJavaScript(`window.wd.invoke('voice:piper-import', ${JSON.stringify(files)})`);
  if (!r?.voices?.length) return problems.push(`piper: no se importó la voz ${JSON.stringify(r)}`);
  const key = r.voices[0].key;
  if (api.loadConfig().voice.tts.piperVoice !== key) problems.push('piper: la primera voz importada no quedó elegida');

  api.patchConfig({ voice: { tts: { mode: 'piper' } } });
  api.broadcast('cfg:changed', api.publicConfig());
  await sleep(300);
  await settings.webContents.executeJavaScript(`document.querySelector('[data-tab="voice"]').click()`);
  await waitForWindow(settings, `!!document.querySelector('[data-voice="${key}"] .pill.active')`, 10000);
  await sleep(500);
  await check('ajustes/voz/piper', settings, 'es');

  const av = api.wins.avatar;
  await av.webContents.executeJavaScript(
    'window.__lv = 0; clearInterval(window.__lvTimer); window.__lvTimer = setInterval(() => { const v = window.__wd.behaviour.levelFn?.() || 0; if (v > window.__lv) window.__lv = v; }, 30);',
  );
  await settings.webContents.executeJavaScript(`document.querySelector('#testTts').click()`);
  let level = 0;
  for (let i = 0; i < 160 && level <= 0.05; i++) {
    await sleep(250);
    level = await av.webContents.executeJavaScript('window.__lv');
  }
  await av.webContents.executeJavaScript('clearInterval(window.__lvTimer)');
  if (!(level > 0.05)) problems.push(`piper: la voz no sonó o la boca no se movió (nivel ${level})`);

  api.patchConfig({ voice: { tts: { mode: 'system' } } });
  api.broadcast('cfg:changed', api.publicConfig());
}
