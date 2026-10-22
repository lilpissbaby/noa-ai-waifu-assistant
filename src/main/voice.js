// Voz: transcripción (Whisper vía API compatible) y síntesis (OpenAI-compatible o ElevenLabs).
import { net } from 'electron';
import { getSecret } from './config.js';
import { httpError } from './llm/sse.js';

export async function transcribe(cfg, bytes, mime = 'audio/webm') {
  const stt = cfg.voice.stt;
  if (!stt || stt.provider === 'off') throw new Error('El dictado por voz está desactivado en Ajustes → Voz');
  const key = getSecret('stt');
  const base = stt.baseUrl.replace(/\/+$/, '');
  const ext = mime.includes('ogg') ? 'ogg' : mime.includes('wav') ? 'wav' : mime.includes('mp4') ? 'm4a' : 'webm';
  const fields = { model: stt.model || 'whisper-1', response_format: 'json' };
  if (stt.language) fields.language = stt.language;
  const { body, contentType } = multipart(fields, { name: 'file', filename: `voz.${ext}`, type: mime.split(';')[0], data: bytes });
  const res = await net.fetch(`${base}/audio/transcriptions`, {
    method: 'POST',
    headers: { 'content-type': contentType, ...(key ? { authorization: `Bearer ${key}` } : {}) },
    body,
  });
  if (!res.ok) throw await httpError(res, 'Transcripción');
  const j = await res.json();
  return (j.text || '').trim();
}

// multipart/form-data a mano (net.fetch de Electron no acepta FormData como cuerpo).
function multipart(fields, file) {
  const boundary = `----waifudesk${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  const parts = [];
  for (const [k, v] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  }
  parts.push(
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\nContent-Type: ${file.type}\r\n\r\n`),
    Buffer.from(file.data),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  );
  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

// Devuelve audio (mp3) como Uint8Array, o null si el modo es "system" (lo habla el propio renderer).
export async function synthesize(cfg, text) {
  const tts = cfg.voice.tts;
  if (!text.trim() || tts.mode === 'off' || tts.mode === 'system') return null;
  if (tts.mode === 'elevenlabs') {
    const key = getSecret('tts');
    if (!tts.elevenVoiceId) throw new Error('Falta el Voice ID de ElevenLabs');
    const res = await net.fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(tts.elevenVoiceId)}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'xi-api-key': key, accept: 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: tts.elevenModel || 'eleven_multilingual_v2' }),
      },
    );
    if (!res.ok) throw await httpError(res, 'ElevenLabs');
    return new Uint8Array(await res.arrayBuffer());
  }
  // OpenAI-compatible: OpenAI, Kokoro-FastAPI, openedai-speech, etc.
  const key = getSecret('tts');
  const base = tts.baseUrl.replace(/\/+$/, '');
  const res = await net.fetch(`${base}/audio/speech`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({ model: tts.model, voice: tts.voice, input: text, response_format: 'mp3', speed: Number(tts.rate) || 1 }),
  });
  if (!res.ok) throw await httpError(res, 'Síntesis de voz');
  return new Uint8Array(await res.arrayBuffer());
}

// Limpia markdown para leerlo en voz alta y omite bloques de código.
export function speakable(text) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, 'el enlace')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[*_~>|#]/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Trocea texto en streaming en frases para empezar a hablar cuanto antes (omite bloques ```).
export class SentenceChunker {
  constructor(onSentence) {
    this.buf = '';
    this.inFence = false;
    this.onSentence = onSentence;
  }
  push(delta) {
    this.buf += delta;
    for (;;) {
      const fence = this.buf.indexOf('```');
      if (this.inFence) {
        if (fence === -1) {
          this.buf = this.buf.slice(-2);
          return;
        }
        this.buf = this.buf.slice(fence + 3);
        this.inFence = false;
        continue;
      }
      const segment = fence === -1 ? this.buf : this.buf.slice(0, fence);
      const rest = this.cut(segment, fence !== -1);
      if (fence === -1) {
        this.buf = rest;
        return;
      }
      this.buf = this.buf.slice(fence + 3);
      this.inFence = true;
    }
  }
  // Emite las frases completas de `text`; devuelve lo que queda sin terminar.
  cut(text, complete) {
    let last = 0;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const end = c === '\n' || ('.!?…'.includes(c) && /\s/.test(text[i + 1] || ''));
      if (end && i + 1 - last >= 2) {
        this.emit(text.slice(last, i + 1));
        last = i + 1;
      }
    }
    let rest = text.slice(last);
    if (complete) {
      this.emit(rest);
      rest = '';
    }
    return rest;
  }
  emit(s) {
    const t = s.trim();
    if (t && /[\p{L}\p{N}]/u.test(t)) this.onSentence(t);
  }
  flush() {
    if (!this.inFence) this.emit(this.buf);
    this.buf = '';
    this.inFence = false;
  }
}
