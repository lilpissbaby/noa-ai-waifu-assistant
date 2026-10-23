// Adjuntos de los mensajes: imágenes (capturas, fotos pegadas o arrastradas) guardadas en
// userData/attachments/ y textos de archivos. En el historial solo va la referencia; los bytes se
// leen al construir cada petición, y solo los de las últimas intervenciones viajan como imagen.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { userDir } from './config.js';

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
export const attachmentsDir = () => path.join(userDir(), 'attachments');

export function saveImageAttachment(buffer, mime = 'image/png', name = 'image') {
  const type = EXT[mime] ? mime : 'image/png';
  const file = `${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}.${EXT[type]}`;
  fs.mkdirSync(attachmentsDir(), { recursive: true });
  fs.writeFileSync(path.join(attachmentsDir(), file), buffer);
  return { kind: 'image', file, mime: type, name: String(name || file).slice(0, 120) };
}

export function attachmentBase64(att) {
  if (att?.data) return att.data;
  const file = path.basename(String(att?.file || ''));
  if (!file || file !== att.file) return null;
  try {
    return fs.readFileSync(path.join(attachmentsDir(), file)).toString('base64');
  } catch {
    return null;
  }
}

export const attachmentUrl = (att) => `app://local/user/attachments/${encodeURIComponent(path.basename(att.file))}`;

export function clearAttachments() {
  fs.rmSync(attachmentsDir(), { recursive: true, force: true });
}

const asText = (att) => ({ kind: 'text', name: att.name, text: `[image: ${att.name}]` });

// Copia del historial donde las imágenes anteriores a las últimas `keepTurns` intervenciones del
// usuario pasan a ser una mención de texto (ahorra tokens y no se reenvían capturas viejas).
export function prepareImages(history, keepTurns = 3) {
  let seen = 0;
  let cutoff = history.length;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role !== 'user') continue;
    if (seen === keepTurns) break;
    seen++;
    cutoff = i;
  }
  if (keepTurns === 0) cutoff = history.length;
  return history.map((m, i) => {
    if (i >= cutoff) return m;
    if (m.role === 'user' && m.attachments?.some((a) => a.kind === 'image')) return { ...m, attachments: m.attachments.map((a) => (a.kind === 'image' ? asText(a) : a)) };
    if (m.role === 'tool' && m.images?.length) {
      const { images, ...rest } = m;
      return { ...rest, content: `${m.content}\n${images.map((a) => `[image: ${a.name}]`).join(' ')}` };
    }
    return m;
  });
}

export const hasImages = (history) => history.some((m) => m.attachments?.some((a) => a.kind === 'image') || m.images?.length);
