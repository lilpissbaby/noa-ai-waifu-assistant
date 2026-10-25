// Live2D en la app real (si hay fixtures): instala el Core, importa Hiyori, lo usa como skin y
// comprueba que se ve, que se mueve y que se puede volver a 2D. Fixtures: tools/fetch-live2d-fixtures.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { sleep, waitForWindow } from './common.mjs';

export function live2dFixtures(dir) {
  if (!dir || !fs.existsSync(dir)) return null;
  const core = ['CubismSdkForWeb.zip', 'live2dcubismcore.min.js'].map((f) => path.join(dir, f)).find((f) => fs.existsSync(f));
  const model = path.join(dir, 'Hiyori');
  return core && fs.existsSync(path.join(model, 'Hiyori.model3.json')) ? { core, model } : null;
}

export async function live2dCheck(api, fx, problems) {
  const st0 = api.live2d.importCore(fx.core);
  if (!st0.ready) return problems.push('live2d: el Core no quedó instalado');
  const staged = api.live2d.stageLive2d(fx.model);
  if (staged.error) return problems.push(`live2d: no se importó el modelo (${staged.error})`);
  // Por el editor, como lo haría el usuario: ver, encuadrar, guardar y usar.
  const ed = api.openWindow('vrm-editor', { query: { kind: 'live2d' } });
  await waitForWindow(ed, '!!window.__wdVrmEditor && document.body.classList.contains("mode-live2d")', 20000);
  // Errores con su pila (en el registro solo sale «cubism.min.js:1»).
  const CATCH = "window.__errs = []; addEventListener('error', (e) => __errs.push(String(e.error?.stack || e.message))); addEventListener('unhandledrejection', (e) => __errs.push(String(e.reason?.stack || e.reason)))";
  await ed.webContents.executeJavaScript(CATCH);
  await api.wins.avatar.webContents.executeJavaScript(CATCH);
  const errors = async (win) => (await win.webContents.executeJavaScript('window.__errs || []').catch(() => [])).slice(0, 3).join('\n  ');
  await ed.webContents.executeJavaScript(`window.__wdVrmEditor.fromStagedLive2d(${JSON.stringify(staged)})`);
  await waitForWindow(ed, "window.__wdVrmEditor.renderer?.kind === 'live2d' && !!window.__wdVrmEditor.renderer.skin", 60000);
  const params = await ed.webContents.executeJavaScript('document.querySelectorAll("#paramList .param").length');
  if (!(params > 10)) problems.push(`live2d: el editor no lista los parámetros (${params})`);
  await ed.webContents.executeJavaScript(`document.querySelector('[data-preset="half"]').click(); document.getElementById('btnSave').click()`);
  await waitForWindow(ed, '["ok", "err"].some((c) => document.getElementById("saveStatus").classList.contains(c))', 30000).catch(() => {});
  const saved = await ed.webContents.executeJavaScript('({ ok: document.getElementById("saveStatus").classList.contains("ok"), text: document.getElementById("saveStatus").textContent })');
  if (!saved.ok) {
    problems.push(`live2d: no se guardó la skin («${saved.text}»)\n  editor: ${await errors(ed)}\n  avatar: ${await errors(api.wins.avatar)}`);
    ed.close();
    return null;
  }
  const edErrors = await errors(ed);
  if (edErrors) problems.push(`live2d: errores en el editor\n  ${edErrors}`);
  ed.close();
  const skin = { id: api.loadConfig().ui.skinId };
  if (!/^live2d-/.test(skin.id)) problems.push(`live2d: el editor no puso la skin (${skin.id})`);
  const av = api.wins.avatar;
  await waitForWindow(av, "window.__wd.renderer?.kind === 'live2d' && !!window.__wd.renderer.skin", 60000);
  // Bajo la cabeza tiene que haber modelo (con SwiftShader puede tardar en dibujarse).
  let r = { alpha: 0 };
  for (let i = 0; i < 40 && !(r.alpha > 40); i++) {
    await sleep(250);
    r = await av.webContents.executeJavaScript(
      `(() => { const x = window.__wd.renderer; const h = x.headAnchorCss(); return { alpha: h ? x.alphaAtCss(h[0], h[1] + 30, 2) : 0, frames: window.__wd.stage.frames, params: x.parameters().length }; })()`,
    );
  }
  if (!(r.alpha > 40)) problems.push(`live2d: el modelo no se ve bajo la cabeza (alfa ${r.alpha})`);
  if (!(r.params > 10)) problems.push(`live2d: el modelo no tiene parámetros (${r.params})`);
  // La mirada mueve ParamAngleX.
  await av.webContents.executeJavaScript('window.__wd.behaviour.cursor = { x: -3000, y: 200 }');
  await sleep(1500);
  const angle = await av.webContents.executeJavaScript(`window.__wd.renderer.paramValue('ParamAngleX') ?? 0`);
  if (!(angle < -5)) problems.push(`live2d: la cabeza no sigue al cursor (ParamAngleX ${angle})`);
  await av.webContents.executeJavaScript('window.__wd.behaviour.cursor = null');
  // Emoción alegre → sonrisa (Hiyori no trae expresiones: lo lleva ParamMouthForm).
  const form0 = await av.webContents.executeJavaScript(`window.__wd.renderer.paramValue('ParamMouthForm') ?? 0`);
  await av.webContents.executeJavaScript(`window.__wd.behaviour.setEmotion('happy')`);
  await sleep(1200);
  const form1 = await av.webContents.executeJavaScript(`window.__wd.renderer.paramValue('ParamMouthForm') ?? 0`);
  if (!(form1 > form0 + 0.2)) problems.push(`live2d: la alegría no cambia la boca (${form0} → ${form1})`);
  const avErrors = await errors(av);
  if (avErrors) problems.push(`live2d: errores en el avatar\n  ${avErrors}`);
  // Ida y vuelta a 2D (canvas nuevo, sin errores).
  api.useSkin('default');
  await waitForWindow(av, "window.__wd.renderer?.kind === '2d' && !!window.__wd.renderer.skin", 20000);
  return skin;
}
