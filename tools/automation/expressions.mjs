// Hojas de emociones y gestos con la app real (docs/screenshots/): todas las caras de una skin 2D del
// mercado, los gestos en una skin 3D y todas las skins del mercado. Sirve para revisarlas a ojo.
//   xvfb-run -a -s "-screen 0 2560x1600x24" node tools/smoke.mjs tools/automation/expressions.mjs --scale=1
// WAIFU_SHOTS = carpeta de salida (por defecto docs/screenshots); WAIFU_SHOTS_ONLY = 2d,3d,market,gestures2d
import fs from 'node:fs';
import path from 'node:path';
import { compose, png } from './screenshots.mjs';
import { sleep, waitForWindow } from './common.mjs';
import { EMOTION_NAMES, GESTURES, GESTURE_NAMES } from '../../src/shared/expressions.js';
import { installMarket, marketIndex } from '../../src/main/market.js';

const OUT = process.env.WAIFU_SHOTS || path.resolve(import.meta.dirname, '..', '..', 'docs', 'screenshots');
const ONLY = (process.env.WAIFU_SHOTS_ONLY || '2d,3d,market,gestures2d').split(',');
const done = (ok, message, problems = []) => console.log(`SMOKE_RESULT ${JSON.stringify({ ok, message, problems, locales: [] })}`);

async function sheet(name, tiles, cols, label = true) {
  const { width, height } = tiles[0].size;
  const pad = 16;
  const lh = label ? 22 : 0;
  const rows = Math.ceil(tiles.length / cols);
  const W = cols * width + pad * 2;
  const H = rows * (height + lh) + pad * 2;
  const layers = [{ wallpaper: true }];
  tiles.forEach((t, i) => {
    const x = pad + (i % cols) * width;
    const y = pad + Math.floor(i / cols) * (height + lh);
    layers.push({ img: t.png, x, y });
    if (label) layers.push({ text: t.label, x: x + width / 2, y: y + height + 15, font: '600 13px ui-monospace, monospace', fill: '#d9d0ee', align: 'center' });
  });
  fs.writeFileSync(path.join(OUT, name), await compose(W, H, layers));
}

const sizeOf = (buf) => ({ width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) });

export default async function expressions(api) {
  fs.mkdirSync(OUT, { recursive: true });
  const problems = [];
  api.patchConfig({ content: { adultUnlockedAt: Date.now() }, ui: { alwaysOnTop: false, followCursor: false, idleGestures: false, scale: 1.5, presence: { sleep: false } } });
  api.applyUiConfig();
  api.broadcast('cfg:changed', api.publicConfig());
  const avatar = api.wins.avatar;
  await waitForWindow(avatar, 'window.__wd?.renderer?.skin');
  const js = (code) => avatar.webContents.executeJavaScript(code);
  // Dos fotogramas antes de cada foto, para que la capa de efectos esté al día.
  const shoot = async () => {
    await js('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
    return png(avatar);
  };
  // Sin parpadeos durante las fotos (si no, alguna sale con los ojos cerrados).
  const reset = () => js("{ const b = window.__wd.behaviour; b.setEmotion('neutral', performance.now() - 5000); b.gest = null; b.fakeTalkUntil = 0; b.blinkStart = -1; b.blinkValue = 0; b.nextBlink = 1e12; }");
  const use = async (id, kind) => {
    api.useSkin(id);
    await waitForWindow(avatar, `window.__wd.renderer?.kind === '${kind}' && window.__wd.renderer.skin?.id === '${id}'`, 60000);
    await sleep(kind === '2d' ? 800 : 3000);
  };

  // ---- todas las caras de una skin 2D del mercado
  for (const m of marketIndex()) installMarket(m.id);
  if (ONLY.includes('2d')) {
    const id = process.env.WAIFU_SHOTS_SKIN || 'mk-hana';
    await use(id, '2d');
    const tiles = [];
    for (const e of EMOTION_NAMES) {
      await reset();
      await sleep(150);
      await js(`window.__wd.behaviour.lastEmoGesture = Infinity; window.__wd.behaviour.setEmotion('${e}', performance.now())`);
      await sleep(e === 'neutral' ? 300 : 900);
      const buf = await shoot();
      tiles.push({ png: buf, size: sizeOf(buf), label: e });
    }
    await reset();
    await sheet('emotions-2d.jpg', tiles, 8);
  }

  // ---- gestos en 2D (solo cabeza, guiño y efectos)
  if (ONLY.includes('gestures2d')) {
    await use(process.env.WAIFU_SHOTS_SKIN || 'mk-hana', '2d');
    const tiles = [];
    for (const g of GESTURE_NAMES) {
      await reset();
      await sleep(100);
      await js(`window.__wd.behaviour.gesture('${g}', performance.now())`);
      await sleep(GESTURES[g].dur * 450);
      const buf = await shoot();
      tiles.push({ png: buf, size: sizeOf(buf), label: g });
    }
    await reset();
    await sheet('gestures-2d.jpg', tiles, 9);
  }

  // ---- todas las skins del mercado
  if (ONLY.includes('market')) {
    const tiles = [];
    // Para el README (público) solo las normales: WAIFU_SHOTS_ADULT=1 enseña también las +18.
    for (const m of marketIndex().filter((x) => process.env.WAIFU_SHOTS_ADULT || !x.adult)) {
      await use(m.id, '2d');
      await reset();
      const buf = await shoot();
      tiles.push({ png: buf, size: sizeOf(buf), label: `${m.name}${m.adult ? ' (+18)' : ''}` });
    }
    await sheet('market-skins.jpg', tiles, tiles.length > 8 ? 7 : tiles.length);
  }

  // ---- la galería en Ajustes, con el +18 bloqueado (como la ve quien no lo ha desbloqueado)
  if (ONLY.includes('gallery')) {
    api.patchConfig({ content: { adultUnlockedAt: null }, ui: { language: process.env.WAIFU_SHOTS_LANG || 'es' } });
    api.applyUiConfig();
    api.broadcast('cfg:changed', api.publicConfig());
    await sleep(300);
    const settings = api.openWindow('settings', { query: { tab: 'skins', section: 'gallery' } });
    settings.setSize(1000, 760);
    await waitForWindow(settings, 'document.querySelectorAll(".model-card[data-market]").length > 0', 30000);
    await settings.webContents.executeJavaScript(
      `(() => { const h = [...document.querySelectorAll('#view h2')].find((x) => x.querySelector('.pill')); h.scrollIntoView({ block: 'start' }); document.getElementById('view').scrollTop -= 16; document.getElementById('storageNote').style.visibility = 'hidden'; })()`,
    );
    settings.show();
    await sleep(1500);
    fs.writeFileSync(path.join(OUT, 'settings-gallery.png'), await png(settings));
    settings.close();
    api.patchConfig({ content: { adultUnlockedAt: Date.now() } });
  }

  // ---- gestos y algunas emociones en 3D
  if (ONLY.includes('3d')) {
    await use('noa-3d', 'vrm');
    const tiles = [];
    const only = process.env.WAIFU_SHOTS_GESTURES?.split(',');
    const list = GESTURE_NAMES.filter((g) => GESTURES[g].clip !== null && (!only || only.includes(g)));
    for (const g of list) {
      await reset();
      await sleep(1200);
      await js(`window.__wd.behaviour.gesture('${g}', performance.now())`);
      // Sin GPU el 3D va lento: el gesto se fotografía hacia la mitad.
      await sleep(GESTURES[g].dur * 520);
      const buf = await shoot();
      tiles.push({ png: buf, size: sizeOf(buf), label: g });
    }
    await sheet('gestures-3d.jpg', tiles, 8);
    if (only) return finish();
    const emoTiles = [];
    for (const e of ['love', 'flirty', 'crying', 'angry', 'sleepy', 'dizzy', 'shocked', 'smug']) {
      await reset();
      await sleep(800);
      await js(`window.__wd.behaviour.lastEmoGesture = Infinity; window.__wd.behaviour.setEmotion('${e}', performance.now())`);
      await sleep(1600);
      const buf = await shoot();
      emoTiles.push({ png: buf, size: sizeOf(buf), label: e });
    }
    await sheet('emotions-3d.jpg', emoTiles, 8);
  }
  finish();

  function finish() {
    api.useSkin('default');
    done(problems.length === 0, `✓ Hojas de expresiones en ${OUT}`, problems);
    setTimeout(() => api.app.exit(0), 500);
  }
}
