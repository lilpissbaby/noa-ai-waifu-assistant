// Mercado interno: skins 2D dibujadas para Waifu Desk (tools/draw_skins.py → assets/market/). Van dentro
// de la app; «Instalar» las copia a las skins del usuario. Las insinuantes (adult) solo se listan y se
// instalan con el contenido +18 desbloqueado, y si se vuelve a bloquear dejan de aparecer.
import fs from 'node:fs';
import path from 'node:path';
import { userDir, loadConfig } from './config.js';
import { APP_ROOT } from './skins.js';

const MARKET_DIR = path.join(APP_ROOT, 'assets', 'market');
const userSkinsDir = () => path.join(userDir(), 'skins');

export const adultUnlocked = (cfg = loadConfig()) => !!cfg?.content?.adultUnlockedAt;

let cache = null;
export function marketIndex() {
  if (!cache) {
    try {
      cache = JSON.parse(fs.readFileSync(path.join(MARKET_DIR, 'market.json'), 'utf8')).skins || [];
    } catch {
      cache = [];
    }
  }
  return cache;
}

const installedDir = (id) => path.join(userSkinsDir(), id);
export const isInstalled = (id) => fs.existsSync(path.join(installedDir(id), 'skin.json'));

// Lista para la galería: { items, hiddenAdult } (cuántas +18 hay sin enseñar).
export function listMarket(cfg = loadConfig()) {
  const open = adultUnlocked(cfg);
  const all = marketIndex();
  const items = all.filter((m) => open || !m.adult).map((m) => ({ ...m, kind: '2d', installed: isInstalled(m.id), thumb: `app://local/bundle/assets/gallery/${m.id}.jpg` }));
  return { items, hiddenAdult: open ? 0 : all.filter((m) => m.adult).length };
}

export function installMarket(id, cfg = loadConfig()) {
  const item = marketIndex().find((m) => m.id === id);
  if (!item) throw new Error(`Unknown market skin: ${id}`);
  if (item.adult && !adultUnlocked(cfg)) return { error: 'adultLocked' };
  const from = path.join(MARKET_DIR, path.basename(item.dir));
  const to = installedDir(item.id);
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) if (/\.(svg|json|png|jpg)$/i.test(f)) fs.copyFileSync(path.join(from, f), path.join(to, f));
  // Fecha de instalación: así sale la primera entre las del usuario.
  const manifestPath = path.join(to, 'skin.json');
  const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  m.created = Date.now();
  fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2));
  return { id: item.id };
}
