// Lectura y escritura de archivos JSON pequeños de userData (tareas, estadísticas, estados…).
// Se escribe en un .tmp y se renombra, para que un corte no deje el archivo a medias.
import fs from 'node:fs';
import path from 'node:path';

export function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  try {
    fs.renameSync(tmp, file);
  } catch {
    // Windows: un antivirus puede tener el destino abierto un instante.
    fs.copyFileSync(tmp, file);
    fs.rmSync(tmp, { force: true });
  }
}

// «2026-10-30» en hora local.
export const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
