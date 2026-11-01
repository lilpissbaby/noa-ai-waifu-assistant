// Emociones de la asistente → expresiones del modelo, adivinadas por el nombre (inglés y japonés).
// Las cinco clásicas se buscan siempre; las demás solo si el modelo tiene una con ese nombre, y si no,
// se usa la de su emoción «base» (expressions.js).
import { EMOTIONS } from '../../../shared/expressions.js';

const PATTERNS = {
  happy: /happy|smile|joy|笑|喜|嬉/i,
  angry: /angry|anger|mad|怒/i,
  sad: /sad|cry|tear|泣|悲/i,
  surprised: /surpris|shock|驚/i,
  relaxed: /relax|calm|blush|照/i,
};
const EXTRA = {
  love: /love|heart|ハート|好/i,
  shy: /shy|blush|embarrass|照|恥/i,
  crying: /cry|tear|泣/i,
  excited: /excit|star|キラ/i,
  laugh: /laugh|lol|爆笑/i,
  pout: /pout|sulk|ぷく|むっ/i,
  sleepy: /sleep|tired|眠/i,
  scared: /scare|fear|怖/i,
  dizzy: /dizzy|spiral|ぐるぐる|目回/i,
  smug: /smug|doya|ドヤ/i,
  disgusted: /disgust|嫌/i,
  shocked: /shock|pale|青/i,
  flirty: /wink|flirt|ウインク/i,
};

const pick = (names, table) => {
  const out = {};
  for (const [emotion, re] of Object.entries(table)) {
    const hit = (names || []).find((n) => re.test(String(n)));
    if (hit) out[emotion] = hit;
  }
  return out;
};

// Las cinco clásicas (las que se pueden asignar a mano en el editor).
export const autoAssignExpressions = (names) => pick(names, PATTERNS);
// Las clásicas y, si el modelo tiene caras con esos nombres, las demás emociones.
export const autoAssignAll = (names) => ({ ...pick(names, PATTERNS), ...pick(names, EXTRA) });

// Expresión para una emoción: la suya o la de su emoción base.
export function expressionFor(name, assigned = {}) {
  if (!name || name === 'neutral') return null;
  return assigned[name] || assigned[EMOTIONS[name]?.base] || null;
}
