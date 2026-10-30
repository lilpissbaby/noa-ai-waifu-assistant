// Herramientas de archivos: solo dentro de las carpetas autorizadas en Ajustes → Productividad.
import fs from 'node:fs';
import path from 'node:path';
import { shell } from 'electron';
import { resolveInside, listDir, searchFiles } from '../productivity/files.js';
import { readDocument } from '../productivity/docs.js';
import { t } from '../../shared/i18n/index.js';

// Abrir un programa o un script con su app por defecto lo ejecutaría: eso solo con run_command.
const EXECUTABLE = /\.(exe|bat|cmd|com|msi|msix|appx|scr|pif|ps1|psm1|vbs|vbe|js|jse|mjs|wsf|wsh|hta|lnk|url|reg|inf|cpl|msc|dll|sys|sh|bash|zsh|run|bin|appimage|desktop|deb|rpm|jar|py|pyw|pl|rb|php|command|app)$/i;

export function fileTools(cfg) {
  const roots = () => (cfg.productivity?.folders || []).filter((f) => typeof f === 'string' && f.trim());
  const need = () => {
    const r = roots();
    if (!r.length) throw new Error('The user has not authorized any folder. Ask them to add one in Settings → Productivity → Folders.');
    return r;
  };
  const group = 'list, search, read and write files in the folders the user authorized';
  const pathProp = { type: 'string', description: 'Absolute path, or relative to the first authorized folder.' };
  return [
    {
      name: 'files_list',
      group,
      description: 'Lists a folder (or, without path, the authorized folders).',
      schema: { type: 'object', properties: { path: pathProp } },
      run: async ({ path: p } = {}) => {
        const r = need();
        if (!p) return r.map((f) => ({ name: path.basename(f) || f, path: f, dir: true }));
        return listDir(resolveInside(r, p));
      },
    },
    {
      name: 'files_search',
      group,
      description: 'Searches files by name and by content (text files) inside the authorized folders, or inside path. Up to 50 results.',
      schema: { type: 'object', properties: { query: { type: 'string' }, path: pathProp }, required: ['query'] },
      run: async ({ query, path: p }) => searchFiles(need(), query, p),
    },
    {
      name: 'files_read',
      group,
      description: 'Reads a text file, a PDF or a Word .docx (up to 100,000 characters).',
      schema: { type: 'object', properties: { path: pathProp }, required: ['path'] },
      run: async ({ path: p }) => {
        const abs = resolveInside(need(), p);
        return { path: abs, ...(await readDocument(abs)) };
      },
    },
    {
      name: 'files_open',
      group,
      description: "Opens a file or folder from the authorized folders with the user's default app (e.g. a PDF in the PDF viewer, a folder in the file explorer). Asks the user first.",
      schema: { type: 'object', properties: { path: pathProp }, required: ['path'] },
      confirm: (input) => {
        let target = String(input.path || '');
        try {
          target = resolveInside(roots(), target);
        } catch {
          /* run() dará el error */
        }
        return { title: t('approve.filesOpen.title'), message: t('approve.filesOpen.message', { path: target }), detail: '' };
      },
      run: async ({ path: p }) => {
        const abs = resolveInside(need(), p);
        if (!fs.existsSync(abs)) throw new Error(`Not found: ${abs}`);
        if (!fs.statSync(abs).isDirectory() && EXECUTABLE.test(abs)) throw new Error('That is a program or script: opening it would run it. Use run_command if the user really wants to run it.');
        const err = await shell.openPath(abs);
        if (err) throw new Error(err);
        return `Opened ${abs}`;
      },
    },
    {
      name: 'files_write',
      group,
      description: 'Writes a text file (creates it or replaces it) inside the authorized folders. The user always confirms.',
      schema: { type: 'object', properties: { path: pathProp, content: { type: 'string' } }, required: ['path', 'content'] },
      confirm: (input) => {
        let target = String(input.path || '');
        try {
          target = resolveInside(roots(), target);
        } catch {
          /* run() dará el error */
        }
        return {
          title: t('confirm.filesWrite.title'),
          message: t(fs.existsSync(target) ? 'confirm.filesWrite.replace' : 'confirm.filesWrite.create', { path: target }),
          detail: String(input.content || '').slice(0, 400),
          allowAlways: false,
        };
      },
      run: async ({ path: p, content }) => {
        const abs = resolveInside(need(), p);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, String(content ?? ''));
        return `Wrote ${abs} (${Buffer.byteLength(String(content ?? ''))} bytes).`;
      },
    },
  ];
}
