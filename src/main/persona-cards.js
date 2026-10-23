// Tarjetas de personaje de SillyTavern / TavernAI: PNG con el JSON en un chunk de texto
// («chara» = V2 en base64, «ccv3» = V3) o el JSON suelto (V1 plano, V2 o V3).
import zlib from 'node:zlib';
import { normalizePersona } from '../shared/personas.js';

export const MAX_CARD_BYTES = 5 * 1024 * 1024;
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const fail = (code, message = code) => Object.assign(new Error(message), { code });

// Chunks tEXt / iTXt de un PNG -> { clave: texto }
function pngTexts(buf) {
  const out = {};
  let pos = 8;
  while (pos + 12 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'tEXt') {
      const z = data.indexOf(0);
      if (z > 0) out[data.toString('latin1', 0, z)] = data.toString('latin1', z + 1);
    } else if (type === 'iTXt') {
      const z = data.indexOf(0);
      if (z > 0) {
        const key = data.toString('latin1', 0, z);
        const compressed = data[z + 1] === 1;
        let p = z + 3;
        p = data.indexOf(0, p) + 1; // etiqueta de idioma
        p = data.indexOf(0, p) + 1; // palabra clave traducida
        const raw = data.subarray(p);
        out[key] = (compressed ? zlib.inflateSync(raw) : raw).toString('utf8');
      }
    } else if (type === 'IEND') break;
    pos += 12 + len;
  }
  return out;
}

const decode = (b64) => {
  try {
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  } catch {
    return null;
  }
};

function fromJson(obj) {
  const d = obj && typeof obj === 'object' ? (obj.data && typeof obj.data === 'object' ? obj.data : obj) : null;
  if (!d || typeof d.name !== 'string' || !d.name.trim()) throw fail('notCard');
  const s = (v) => (typeof v === 'string' ? v.trim() : '');
  const join = (...parts) => parts.map(s).filter(Boolean).join('\n\n');
  return {
    name: s(d.name),
    personality: join(d.description, d.personality),
    scenario: s(d.scenario),
    greeting: s(d.first_mes),
    examples: s(d.mes_example),
    extraInstructions: join(d.system_prompt, d.post_history_instructions),
  };
}

export function parseCard(buffer, fileName = '') {
  if (buffer.length > MAX_CARD_BYTES) throw fail('tooBig');
  if (buffer.subarray(0, 8).equals(PNG_SIG)) {
    const texts = pngTexts(buffer);
    const json = (texts.ccv3 && decode(texts.ccv3)) || (texts.chara && decode(texts.chara));
    if (!json) throw fail('notCard');
    return { ...fromJson(json), image: buffer };
  }
  let obj;
  try {
    obj = JSON.parse(buffer.toString('utf8'));
  } catch {
    throw fail('notCard', `${fileName}: not a character card`);
  }
  return { ...fromJson(obj), image: null };
}

export function cardToPersona(card, { userName = '' } = {}) {
  const user = userName.trim() || 'User';
  const fill = (s) => s.replace(/\{\{char\}\}|<BOT>/gi, card.name).replace(/\{\{user\}\}|<USER>/gi, user);
  return normalizePersona({
    name: card.name,
    personality: fill(card.personality),
    scenario: fill(card.scenario),
    greeting: fill(card.greeting),
    examples: fill(card.examples),
    extraInstructions: fill(card.extraInstructions),
    source: { kind: 'card', name: card.name },
  });
}
