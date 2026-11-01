// Etiquetas que el modelo puede intercalar en su respuesta: <emo:happy> (cara) y <act:wave> (gesto).
// Se quitan del texto en streaming —aunque lleguen partidas entre trozos— y se convierten en
// eventos para el avatar. Dentro de bloques de código (```) no se toca nada. Los nombres y sus
// sinónimos están en src/shared/expressions.js.
import { EMOTION_NAMES, GESTURE_NAMES, resolveEmotion, resolveGesture, expressionPrompt } from '../../shared/expressions.js';

export const EMOTIONS = EMOTION_NAMES;
export const GESTURES = GESTURE_NAMES;
export const EMOTION_PROMPT = expressionPrompt({ gestures: true });
export { expressionPrompt };

const TAG = /^<(emo|act):([a-zA-Z0-9_-]{1,16})>$/;
const PREFIX = /^<((e(m(o(:[a-zA-Z0-9_-]{0,16})?)?)?)|(a(c(t(:[a-zA-Z0-9_-]{0,16})?)?)?))?$/;

export class EmotionTagFilter {
  constructor() {
    this.pending = ''; // posible etiqueta a medias
    this.inCode = false;
    this.ticks = 0; // acentos graves seguidos
    this.last = ''; // último carácter emitido
    this.eatSpace = false;
  }

  push(delta) {
    let text = '';
    const emotions = [];
    const gestures = [];
    const out = (s) => {
      if (!s) return;
      text += s;
      this.last = s.at(-1);
    };
    for (const ch of String(delta)) {
      if (this.pending) {
        const cand = this.pending + ch;
        const m = TAG.exec(cand);
        if (m) {
          if (m[1] === 'emo') {
            const name = resolveEmotion(m[2]);
            if (name) emotions.push(name);
          } else {
            const name = resolveGesture(m[2]);
            if (name) gestures.push(name);
          }
          this.pending = '';
          this.eatSpace = true;
          continue;
        }
        if (PREFIX.test(cand)) {
          this.pending = cand;
          continue;
        }
        out(this.pending);
        this.pending = '';
      }
      if (this.eatSpace) {
        this.eatSpace = false;
        if (ch === ' ' && (!this.last || /\s/.test(this.last))) continue;
      }
      if (ch === '`') {
        this.ticks++;
        if (this.ticks === 3) {
          this.inCode = !this.inCode;
          this.ticks = 0;
        }
        out(ch);
        continue;
      }
      this.ticks = 0;
      if (ch === '<' && !this.inCode) {
        this.pending = '<';
        continue;
      }
      out(ch);
    }
    return { text, emotions, gestures };
  }

  flush() {
    const text = this.pending;
    this.pending = '';
    if (text) this.last = text.at(-1);
    return { text, emotions: [], gestures: [] };
  }
}

export function stripEmotionTags(text) {
  const f = new EmotionTagFilter();
  return f.push(text).text + f.flush().text;
}
