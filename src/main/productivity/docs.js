// Texto de documentos: PDF (pdf.js en el proceso principal), Word .docx (word/document.xml) y
// cualquier archivo de texto. También convierte archivos soltados en el chat en adjuntos.
import fs from 'node:fs';
import module from 'node:module';
import path from 'node:path';
import { readZip } from '../zip.js';
import { TEXT_EXT } from './files.js';
import { saveImageAttachment } from '../attachments.js';

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_CHARS = 100000;
const IMAGE_MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
const fail = (code, message) => Object.assign(new Error(message), { code });

// pdf.js intenta cargar @napi-rs/canvas (dependencia opcional, solo para dibujar páginas) y ese
// módulo nativo tumba el proceso principal de Electron. Para sacar texto no hace falta: se bloquea.
let canvasBlocked = false;
function blockCanvas() {
  if (canvasBlocked || typeof module.registerHooks !== 'function') return;
  canvasBlocked = true;
  module.registerHooks({
    resolve(specifier, context, next) {
      if (specifier === '@napi-rs/canvas') throw Object.assign(new Error('@napi-rs/canvas is not used by Waifu Desk'), { code: 'MODULE_NOT_FOUND' });
      return next(specifier, context);
    },
  });
}

let pdfjs = null;
export async function extractPdfText(buffer) {
  if (!pdfjs) {
    blockCanvas();
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  const task = pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: false, disableFontFace: true, verbosity: 0 });
  const doc = await task.promise;
  const pages = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let text = '';
      for (const item of content.items) text += (item.str ?? '') + (item.hasEOL ? '\n' : '');
      pages.push(text.trim());
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return pages.filter(Boolean).join('\n\n');
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decodeXml = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTITIES[e] ?? m)));

export function extractDocxText(buffer) {
  const [doc] = readZip(buffer, { want: (n) => n === 'word/document.xml', maxBytes: 50 * 1024 * 1024 });
  if (!doc) throw fail('notDocx', 'Not a .docx file (word/document.xml is missing)');
  const xml = doc.data.toString('utf8');
  const paragraphs = xml.match(/<w:p(?:\s[^>]*?)?\/>|<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) || [];
  return paragraphs
    .map((p) => {
      const runs = p.replace(/<w:tab\/>/g, '<w:t>\t</w:t>').replace(/<w:(?:br|cr)\/>/g, '<w:t>\n</w:t>');
      return decodeXml([...runs.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join(''));
    })
    .join('\n')
    .replace(/\n+$/, '');
}

export async function readDocument(abs, maxChars = MAX_CHARS) {
  const st = fs.statSync(abs);
  if (st.size > MAX_FILE_BYTES) throw fail('tooBig', `${path.basename(abs)} is larger than 20 MB`);
  const ext = path.extname(abs).slice(1).toLowerCase();
  let text;
  if (ext === 'pdf') text = await extractPdfText(fs.readFileSync(abs));
  else if (ext === 'docx') text = extractDocxText(fs.readFileSync(abs));
  else if (TEXT_EXT.test(abs) || !ext) {
    const buf = fs.readFileSync(abs);
    if (buf.subarray(0, 8000).includes(0)) throw fail('unsupported', `${path.basename(abs)} is a binary file`);
    text = buf.toString('utf8');
  } else throw fail('unsupported', `Cannot read .${ext} files (text, PDF and .docx are supported)`);
  const truncated = text.length > maxChars;
  return { text: truncated ? text.slice(0, maxChars) : text, truncated };
}

export async function attachmentsFromPaths(paths) {
  const out = [];
  for (const p of paths) {
    const name = path.basename(p);
    const st = fs.statSync(p);
    if (st.size > MAX_FILE_BYTES) throw Object.assign(fail('tooBig', `${name} is larger than 20 MB`), { file: name });
    const mime = IMAGE_MIME[path.extname(p).slice(1).toLowerCase()];
    if (mime) out.push(saveImageAttachment(fs.readFileSync(p), mime, name));
    else {
      const { text, truncated } = await readDocument(p);
      out.push({ kind: 'text', name, text: truncated ? `${text}\n…(truncated at ${MAX_CHARS} characters)` : text });
    }
  }
  return out;
}
