// Etiquetas de emoción que el modelo puede intercalar en su respuesta (<emo:happy>…). Se quitan del
// texto en streaming —aunque lleguen partidas entre trozos— y se convierten en eventos para la cara
// del avatar. Dentro de bloques de código (```) no se toca nada.

export const EMOTIONS = ['happy', 'angry', 'sad', 'relaxed', 'surprised', 'neutral'];

export const EMOTION_PROMPT =
  'You have a visible animated face. When the emotional tone of what you say genuinely changes, you may start that sentence with a hidden tag: <emo:happy>, <emo:sad>, <emo:angry>, <emo:surprised>, <emo:relaxed> or <emo:neutral>. Use at most one or two per reply, never inside code, and never mention or explain them: they are removed from the text and only change your expression.';

const TAG = /^<emo:([a-zA-Z]{1,12})>$/;
const PREFIX = /^<(e(m(o(:[a-zA-Z]{0,12})?)?)?)?$/;

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
          const name = m[1].toLowerCase();
          if (EMOTIONS.includes(name)) emotions.push(name);
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
    return { text, emotions };
  }

  flush() {
    const text = this.pending;
    this.pending = '';
    if (text) this.last = text.at(-1);
    return { text, emotions: [] };
  }
}

export function stripEmotionTags(text) {
  const f = new EmotionTagFilter();
  return f.push(text).text + f.flush().text;
}
