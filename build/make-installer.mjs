// Genera el instalador de Windows con makensis directamente, sin Wine.
// Se usa al compilar para Windows desde Linux/macOS:  npm run dist:win:cross
// (En Windows basta con «npm run dist:win», que usa el NSIS de electron-builder.)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const src = path.join(root, 'dist', 'win-unpacked');
const out = process.env.OUT_EXE || path.join(root, 'dist', `WaifuDesk-Setup-${pkg.version}.exe`);
if (!fs.existsSync(path.join(src, 'Waifu Desk.exe'))) {
  console.error('Falta dist/win-unpacked. Ejecuta antes: npx electron-builder --win dir');
  process.exit(1);
}

// makensis: el del PATH o el que descarga electron-builder en su caché.
function findMakensis() {
  try {
    execFileSync('makensis', ['-VERSION'], { stdio: 'ignore' });
    return { bin: 'makensis', nsisDir: null };
  } catch {
    /* no está en el PATH */
  }
  const caches = [process.env.ELECTRON_BUILDER_CACHE, path.join(os.homedir(), '.cache', 'electron-builder'), path.join(os.homedir(), 'Library', 'Caches', 'electron-builder')].filter(Boolean);
  const plat = process.platform === 'darwin' ? 'mac' : 'linux';
  for (const c of caches) {
    if (!fs.existsSync(c)) continue;
    for (const d of fs.readdirSync(c).filter((n) => n.startsWith('nsis-') && !n.includes('resources'))) {
      for (const sub of fs.readdirSync(path.join(c, d))) {
        const base = path.join(c, d, sub);
        const bin = path.join(base, plat, 'makensis');
        if (fs.existsSync(bin)) return { bin, nsisDir: base };
      }
    }
  }
  return null;
}

// Plugin WinShell (de los recursos NSIS de electron-builder) para poner el AppUserModelID al acceso directo.
function findPluginDir() {
  const caches = [process.env.ELECTRON_BUILDER_CACHE, path.join(os.homedir(), '.cache', 'electron-builder'), path.join(os.homedir(), 'Library', 'Caches', 'electron-builder')].filter(Boolean);
  for (const c of caches) {
    if (!fs.existsSync(c)) continue;
    for (const d of fs.readdirSync(c).filter((n) => n.startsWith('nsis-resources') && fs.statSync(path.join(c, n)).isDirectory())) {
      const direct = path.join(c, d, 'plugins', 'x86-unicode');
      if (fs.existsSync(path.join(direct, 'WinShell.dll'))) return direct;
      for (const sub of fs.readdirSync(path.join(c, d))) {
        const p = path.join(c, d, sub, 'plugins', 'x86-unicode');
        if (fs.existsSync(path.join(p, 'WinShell.dll'))) return p;
      }
    }
  }
  return null;
}

const mk = findMakensis();
const pluginDir = findPluginDir();
if (!mk) {
  console.error('No encuentro makensis. Instálalo (apt install nsis / brew install makensis) o ejecuta una vez «npx electron-builder --win nsis» para que se descargue.');
  process.exit(1);
}
const env = { ...process.env };
if (mk.nsisDir) env.NSISDIR = mk.nsisDir;
console.log(`• makensis: ${mk.bin}`);
const defs = [`-DVERSION=${pkg.version}`, `-DSRC=${src}`, `-DOUT=${out}`];
if (pluginDir) defs.push(`-DPLUGINDIR=${pluginDir}`);
else console.warn('• aviso: sin plugin WinShell; las notificaciones de Windows pueden no mostrarse');
if (process.argv.includes('--fast')) defs.push('-DFAST');
execFileSync(mk.bin, ['-V2', ...defs, path.join(root, 'build', 'installer.nsi')], {
  stdio: 'inherit',
  env,
});
console.log(`• instalador: ${path.relative(root, out)} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`);
