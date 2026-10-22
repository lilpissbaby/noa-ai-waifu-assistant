#!/usr/bin/env node
// Lanza la app con un script de tools/automation (por defecto smoke.mjs) en una carpeta de datos
// temporal y devuelve su resultado. En Linux sin pantalla, ejecútalo con xvfb-run (así lo hace el CI).
//   node tools/smoke.mjs                                         prueba de humo
//   node tools/smoke.mjs tools/automation/screenshots.mjs --scale=2   capturas del README
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import electron from 'electron';

const root = path.resolve(import.meta.dirname, '..');
const script = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'tools/automation/smoke.mjs';
const scale = process.argv.find((a) => a.startsWith('--scale='))?.split('=')[1];
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'waifu-desk-smoke-'));
const args = ['.'];
if (process.platform === 'linux') args.push('--no-sandbox', '--disable-gpu-sandbox');
// Capturas: escala 2x y almacén de claves básico (en Windows y en escritorios con llavero no hace falta).
if (scale) args.push(`--force-device-scale-factor=${scale}`, '--password-store=basic');

const child = spawn(electron, args, {
  cwd: root,
  env: { ...process.env, WAIFU_DESK_AUTOMATION: path.join(root, script), WAIFU_DESK_USER_DATA: userData, ELECTRON_ENABLE_LOGGING: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let result = null;
const limitMin = script.includes('screenshots') ? 10 : 4;
const timer = setTimeout(() => {
  console.error(`✗ La automatización no terminó en ${limitMin} minutos`);
  child.kill();
}, limitMin * 60_000);

const onData = (stream) => (buf) => {
  const text = buf.toString();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/SMOKE_RESULT (.*)$/);
    if (m) result = JSON.parse(m[1]);
  }
  if (process.env.SMOKE_VERBOSE) stream.write(text);
};
child.stdout.on('data', onData(process.stdout));
child.stderr.on('data', onData(process.stderr));

child.on('exit', (code) => {
  clearTimeout(timer);
  const log = path.join(userData, 'waifu-desk.log');
  if (!result) {
    console.error(`✗ La app terminó (código ${code}) sin dar resultado.`);
    if (fs.existsSync(log)) console.error(fs.readFileSync(log, 'utf8').slice(-4000));
    process.exit(1);
  }
  if (result.ok) {
    console.log(result.message || `✓ Prueba de humo superada (${result.locales.join(', ')})`);
    process.exit(0);
  }
  console.error('✗ Prueba de humo fallida:');
  for (const p of result.problems) console.error(`  - ${p}`);
  if (fs.existsSync(log)) console.error(`\nRegistro:\n${fs.readFileSync(log, 'utf8').slice(-3000)}`);
  process.exit(1);
});
