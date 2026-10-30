// Miniaturas de la galería de modelos (assets/gallery/<id>.jpg) y la imagen con todos los modelos
// del README (docs/screenshots/models.jpg), dibujados con la propia app: cada modelo se importa como
// skin, se pone en la waifu y se fotografía.
//   node tools/gallery-fetch.mjs /tmp/modelos
//   WAIFU_GALLERY_DIR=/tmp/modelos WAIFU_LIVE2D_CORE=<live2dcubismcore.min.js o SDK .zip> \
//     xvfb-run -a -s "-screen 0 2560x1600x24" node tools/smoke.mjs tools/automation/gallery.mjs
import fs from 'node:fs';
import path from 'node:path';
import { BrowserWindow } from 'electron';
import { stageVrm, saveVrmSkin } from '../../src/main/skins.js';
import { stageLive2d, saveLive2dSkin, importCore } from '../../src/main/live2d.js';
import { ALL_MODELS } from '../gallery-models.mjs';
import { compose, imageSize, png } from './screenshots.mjs';
import { sleep, waitForWindow } from './common.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const THUMBS = path.join(ROOT, 'assets', 'gallery');
const OUT = path.join(ROOT, 'docs', 'screenshots');
const done = (ok, message, problems = []) => console.log(`SMOKE_RESULT ${JSON.stringify({ ok, message, problems, locales: [] })}`);

// Recorta el fondo transparente de una captura (los modelos con efectos o accesorios grandes dejan
// mucho hueco alrededor).
async function trim(buf) {
  const w = new BrowserWindow({ width: 200, height: 200, show: false, webPreferences: { offscreen: true } });
  await w.loadURL('data:text/html,<body></body>');
  const out = await w.webContents.executeJavaScript(`(async () => {
    const im = new Image(); im.src = 'data:image/png;base64,${buf.toString('base64')}'; await im.decode();
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const ctx = c.getContext('2d'); ctx.drawImage(im, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    const pad = 6; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(c.width - 1, x1 + pad); y1 = Math.min(c.height - 1, y1 + pad);
    const o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
    o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
    return o.toDataURL('image/png');
  })()`);
  w.destroy();
  return out ? Buffer.from(out.split(',')[1], 'base64') : buf;
}

// Encaja la foto (fondo transparente) en una tarjeta de w×h, apoyada abajo.
function fit(buf, w, h, pad = 0) {
  const s = imageSize(buf);
  const k = Math.min((w - pad * 2) / s.width, (h - pad) / s.height);
  return { width: Math.round(s.width * k), height: Math.round(s.height * k) };
}

export default async function gallery(api) {
  const dir = process.env.WAIFU_GALLERY_DIR;
  const core = process.env.WAIFU_LIVE2D_CORE;
  if (!dir || !fs.existsSync(dir)) return done(false, '', ['Falta WAIFU_GALLERY_DIR (node tools/gallery-fetch.mjs <carpeta>)']);
  const problems = [];
  if (core) importCore(core);
  api.patchConfig({ ui: { alwaysOnTop: false, followCursor: false, scale: 1.4, presence: { sleep: false } } });
  api.applyUiConfig();
  const avatar = api.wins.avatar;
  await waitForWindow(avatar, 'window.__wd?.renderer?.skin');
  const shots = [];
  // Caché de capturas: con WAIFU_GALLERY_ONLY=id1,id2 solo se vuelven a fotografiar esos.
  const cache = path.join(dir, '_shots');
  fs.mkdirSync(cache, { recursive: true });
  const only = (process.env.WAIFU_GALLERY_ONLY || '').split(',').filter(Boolean);
  for (const m of ALL_MODELS) {
    const cached = path.join(cache, `${m.id}.png`);
    if (only.length && !only.includes(m.id) && fs.existsSync(cached)) {
      shots.push({ m, buf: fs.readFileSync(cached) });
      continue;
    }
    try {
      let skin;
      if (m.kind === 'vrm') {
        const staged = stageVrm(path.join(dir, `${m.id}.vrm`), m.name);
        if (staged.error) throw new Error(staged.error);
        skin = saveVrmSkin({ tmpId: staged.tmpId, name: m.name, framing: { preset: 'half' } });
      } else {
        if (!core) throw new Error('sin Cubism Core (WAIFU_LIVE2D_CORE)');
        const staged = stageLive2d(path.join(dir, m.id));
        if (staged.error) throw new Error(staged.error);
        skin = saveLive2dSkin({ tmpId: staged.tmpId, model: staged.models[0], name: m.name, framing: { preset: 'half', zoom: 1, offsetY: 0 } });
      }
      api.useSkin(skin.id);
      await waitForWindow(avatar, `window.__wd.renderer?.kind === '${m.kind}' && !!window.__wd.renderer.skin && window.__wd.renderer.skin.id === '${skin.id}'`, 90000).catch(() =>
        waitForWindow(avatar, `window.__wd.renderer?.kind === '${m.kind}' && !!window.__wd.renderer.skin`, 30000),
      );
      await avatar.webContents.executeJavaScript('window.__wd.behaviour.cursor = null');
      // Sin GPU el 3D va a pocos fotogramas: tiempo para que cargue texturas y se asiente la pose.
      await sleep(m.kind === 'vrm' ? 6000 : 4000);
      const buf = await trim(await png(avatar));
      fs.writeFileSync(cached, buf);
      shots.push({ m, buf });
      api.logger.info(`galería: ${m.id}`);
    } catch (e) {
      problems.push(`${m.id}: ${e.message}`);
    }
  }
  api.useSkin('default');

  // Miniaturas para la app: 280×350, fondo de tarjeta oscuro.
  fs.mkdirSync(THUMBS, { recursive: true });
  for (const { m, buf } of shots.filter((s) => s.m.inGallery)) {
    const W = 280;
    const H = 350;
    const f = fit(buf, W, H, 10);
    const jpg = await compose(W, H, [{ wallpaper: true }, { img: buf, x: Math.round((W - f.width) / 2), y: H - f.height, w: f.width, h: f.height }]);
    fs.writeFileSync(path.join(THUMBS, `${m.id}.jpg`), jpg);
  }

  // Imagen del README: todos, con nombre y tipo; los que no están en la galería, marcados.
  const cols = 8;
  const CW = 220;
  const CH = 300;
  const head = 70;
  const rows = Math.ceil(shots.length / cols);
  const W = cols * CW + 40;
  const H = head + rows * CH + 30;
  const layers = [{ wallpaper: true }, { text: `${shots.length} modelos gratis · ${shots.filter((s) => s.m.kind === 'vrm').length} VRM (3D) · ${shots.filter((s) => s.m.kind === 'live2d').length} Live2D (VTuber)`, x: W / 2, y: 44, font: '600 26px "Segoe UI", system-ui, sans-serif', fill: '#f3eefe', align: 'center' }];
  shots.forEach(({ m, buf }, i) => {
    const x = 20 + (i % cols) * CW;
    const y = head + Math.floor(i / cols) * CH;
    const f = fit(buf, CW - 12, CH - 48, 4);
    layers.push({ rect: true, x: x + 4, y: y + 4, w: CW - 8, h: CH - 8, radius: 14, fill: 'rgba(20,16,38,0.55)' });
    layers.push({ img: buf, x: x + Math.round((CW - f.width) / 2), y: y + CH - 48 - f.height, w: f.width, h: f.height });
    layers.push({ text: m.name.length > 24 ? `${m.name.slice(0, 23)}…` : m.name, x: x + CW / 2, y: y + CH - 26, font: '600 15px "Segoe UI", system-ui, sans-serif', fill: '#f3eefe', align: 'center' });
    layers.push({ text: `${m.kind === 'vrm' ? '3D · VRM' : 'Live2D'}${m.inGallery ? '' : ' · solo local'}`, x: x + CW / 2, y: y + CH - 10, font: '12px ui-monospace, monospace', fill: m.inGallery ? '#b69cff' : '#ff9ac8', align: 'center' });
  });
  fs.writeFileSync(path.join(OUT, 'models.jpg'), await compose(W, H, layers));
  done(problems.length === 0, `✓ ${shots.length} modelos fotografiados; miniaturas en assets/gallery`, problems);
  api.app.exit(problems.length ? 1 : 0);
}
