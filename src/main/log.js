// Registro de diagnóstico en <carpeta de datos>/waifu-desk.log (se rota al pasar de 1 MB).
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

let file = null;
function target() {
  if (file) return file;
  try {
    const dir = app.getPath('userData');
    fs.mkdirSync(dir, { recursive: true });
    file = path.join(dir, 'waifu-desk.log');
    if (fs.existsSync(file) && fs.statSync(file).size > 1e6) fs.renameSync(file, `${file}.1`);
  } catch {
    file = null;
  }
  return file;
}

export function log(level, ...parts) {
  const line = `${new Date().toISOString()} [${level}] ${parts
    .map((p) => (p instanceof Error ? `${p.message}\n${p.stack}` : typeof p === 'string' ? p : JSON.stringify(p)))
    .join(' ')}\n`;
  (level === 'error' ? console.error : console.log)(line.trimEnd());
  const f = target();
  if (f) {
    try {
      fs.appendFileSync(f, line);
    } catch {
      /* sin disco: solo consola */
    }
  }
}

export const info = (...a) => log('info', ...a);
export const warn = (...a) => log('warn', ...a);
export const error = (...a) => log('error', ...a);
export const logPath = () => target();
