// Emociones y gestos de la asistente: un solo catálogo para el filtro de etiquetas de la IA
// (<emo:…> y <act:…>), Behaviour (cabeza, guiño, efectos), los tres renderizadores y los menús.
//
// Emoción: cara que se mantiene unos segundos.
//   vrm   pesos de las expresiones VRM (happy, angry, sad, relaxed, surprised, blink y las vocales
//         aa/ih/ou/ee/oh para dejar la boca en una forma).
//   l2d   cambios en las entradas de seguimiento de Live2D: smile (−1…1), eye (−1 cierra, + abre),
//         brows (−1 fruncidas, + arriba), mouth (abierta 0…1), cheek (rubor 0…1).
//   wink  guiña el ojo de la izquierda de la pantalla mientras dura.
//   base  la de las cinco clásicas que más se le parece (para expresiones Live2D por nombre).
//   fx    efectos manga alrededor de la cabeza (fx.js).
//   move  movimiento de cabeza mientras dura; gesture: gesto de una vez al empezar.
//   closed: la cara ya tiene los ojos cerrados (no parpadea); look: hacia dónde mira.
// Gesto: acción de una vez (dur en segundos). head: movimiento de cabeza; clip: animación VRM
//   (por defecto, el nombre del gesto; null = sin cuerpo); wink: guiño (ojo de la izquierda de la
//   pantalla); mouth: boca abierta (0…1);
//   body: patrón Live2D para elegir un grupo de movimientos del modelo (si lo tiene).

export const EMOTIONS = {
  neutral: {},
  happy: { vrm: { happy: 1 }, l2d: { smile: 0.5, eye: -0.35 }, base: 'happy', gesture: 'cheer' },
  excited: { vrm: { happy: 1, surprised: 0.3 }, l2d: { smile: 0.6, eye: 0.15, brows: 0.3 }, base: 'happy', fx: ['sparkles'], move: 'bounce', gesture: 'cheer' },
  laugh: { vrm: { happy: 1, aa: 0.45 }, l2d: { smile: 0.7, eye: -1, mouth: 0.6 }, base: 'happy', move: 'giggle', gesture: 'giggle', closed: true },
  love: { vrm: { happy: 0.7, relaxed: 0.3 }, l2d: { smile: 0.5, eye: -0.2, cheek: 1 }, base: 'happy', fx: ['hearts', 'blush'], move: 'sway', gesture: 'heart' },
  shy: { vrm: { relaxed: 0.4, sad: 0.2, blink: 0.25 }, l2d: { smile: 0.15, eye: -0.3, brows: 0.2, cheek: 1 }, base: 'relaxed', fx: ['blush'], move: 'droop', gesture: 'shy', look: { x: -0.5, y: 0.6 } },
  flirty: { vrm: { happy: 0.5, relaxed: 0.4, ou: 0.3 }, l2d: { smile: 0.4, cheek: 0.6 }, base: 'happy', fx: ['hearts'], move: 'sway', gesture: 'blowkiss', wink: true },
  smug: { vrm: { happy: 0.4, relaxed: 0.5, blink: 0.3 }, l2d: { smile: 0.35, eye: -0.35 }, base: 'relaxed', move: 'chinUp', gesture: 'hips' },
  playful: { vrm: { happy: 0.7 }, l2d: { smile: 0.5 }, base: 'happy', fx: ['notes'], move: 'bounce', gesture: 'peace', wink: true },
  proud: { vrm: { happy: 0.6, relaxed: 0.3 }, l2d: { smile: 0.45, eye: -1 }, base: 'happy', fx: ['sparkles'], move: 'chinUp', gesture: 'hips', closed: true },
  grateful: { vrm: { happy: 0.8 }, l2d: { smile: 0.5, eye: -1 }, base: 'happy', fx: ['flowers'], gesture: 'bow', closed: true },
  relaxed: { vrm: { relaxed: 1 }, l2d: { smile: 0.25, eye: -1 }, base: 'relaxed', move: 'sway', closed: true },
  relieved: { vrm: { relaxed: 0.8, oh: 0.2 }, l2d: { smile: 0.2, eye: -1, mouth: 0.15 }, base: 'relaxed', fx: ['sigh'], gesture: 'sigh', closed: true },
  dreamy: { vrm: { relaxed: 0.6, happy: 0.3 }, l2d: { smile: 0.3, eye: -0.1, cheek: 0.4 }, base: 'relaxed', fx: ['sparkles', 'flowers'], move: 'sway', look: { x: 0.3, y: -0.7 } },
  sleepy: { vrm: { relaxed: 0.4, blink: 0.6, oh: 0.15 }, l2d: { eye: -0.6 }, base: 'relaxed', fx: ['zzz'], move: 'nodOff', gesture: 'yawn' },
  bored: { vrm: { relaxed: 0.2, blink: 0.35 }, l2d: { eye: -0.4, smile: -0.15 }, base: 'relaxed', fx: ['sigh'], move: 'droop', look: { x: 0.7, y: 0 } },
  thinking: { vrm: { relaxed: 0.2 }, l2d: { brows: 0.2 }, base: 'relaxed', fx: ['dots'], move: 'tilt', gesture: 'think', look: { x: 0.6, y: -0.6 } },
  curious: { vrm: { surprised: 0.4, happy: 0.2 }, l2d: { eye: 0.15, brows: 0.3 }, base: 'surprised', fx: ['question'], move: 'lean', gesture: 'headtilt' },
  confused: { vrm: { surprised: 0.3, sad: 0.2 }, l2d: { brows: 0.2, smile: -0.1 }, base: 'surprised', fx: ['question'], move: 'tilt', gesture: 'shrug' },
  surprised: { vrm: { surprised: 1 }, l2d: { eye: 0.3, brows: 0.5, mouth: 0.3 }, base: 'surprised', fx: ['exclaim'], gesture: 'jump' },
  shocked: { vrm: { surprised: 1, aa: 0.6 }, l2d: { eye: 0.4, brows: 0.6, mouth: 0.6 }, base: 'surprised', fx: ['shock', 'gloom'], move: 'shiver', gesture: 'recoil' },
  scared: { vrm: { surprised: 0.6, sad: 0.4 }, l2d: { eye: 0.3, brows: 0.3, smile: -0.4 }, base: 'surprised', fx: ['sweat'], move: 'shiver', gesture: 'shiver' },
  nervous: { vrm: { sad: 0.3, surprised: 0.2, happy: 0.2 }, l2d: { brows: 0.25, smile: -0.1 }, base: 'sad', fx: ['sweat'], move: 'fidget', look: { x: 0.5, y: 0 } },
  worried: { vrm: { sad: 0.6, surprised: 0.2 }, l2d: { brows: 0.3, smile: -0.3 }, base: 'sad', fx: ['sweat'], move: 'droop' },
  sad: { vrm: { sad: 1 }, l2d: { smile: -0.5, eye: -0.2, brows: 0.25 }, base: 'sad', fx: ['gloom'], move: 'droop', look: { x: 0, y: 0.5 } },
  crying: { vrm: { sad: 1, blink: 0.7 }, l2d: { smile: -0.6, eye: -1, mouth: 0.3 }, base: 'sad', fx: ['tears'], move: 'sob', gesture: 'cry', closed: true },
  pout: { vrm: { angry: 0.5, ou: 0.6 }, l2d: { smile: -0.2, cheek: 0.6 }, base: 'angry', fx: ['puff'], move: 'huff', gesture: 'crossarms', look: { x: -0.6, y: 0 } },
  annoyed: { vrm: { angry: 0.5, blink: 0.3 }, l2d: { smile: -0.3, eye: -0.3, brows: -0.3 }, base: 'angry', fx: ['anger'], gesture: 'crossarms' },
  angry: { vrm: { angry: 1 }, l2d: { smile: -0.5, brows: -0.5, eye: -0.1 }, base: 'angry', fx: ['anger', 'puff'], move: 'tremble', gesture: 'stomp' },
  disgusted: { vrm: { angry: 0.4, sad: 0.4 }, l2d: { smile: -0.4, eye: -0.4, brows: -0.2 }, base: 'angry', fx: ['gloom'], move: 'leanBack', gesture: 'recoil' },
  determined: { vrm: { angry: 0.25, happy: 0.35 }, l2d: { smile: 0.2, brows: -0.3 }, base: 'happy', fx: ['fire'], gesture: 'fistpump' },
  dizzy: { vrm: { sad: 0.3, surprised: 0.3, blink: 0.2 }, l2d: { eye: -0.2, smile: -0.1 }, base: 'surprised', fx: ['stars'], move: 'wobble' },
};

export const GESTURES = {
  wave: { dur: 2.4, clip: 'greet', head: 'tiltSmall', body: /tap|greet|wave/i },
  nod: { dur: 1.1, clip: null, head: 'nod' },
  shake: { dur: 1.2, clip: null, head: 'shake' },
  bow: { dur: 2.2, head: 'bow' },
  cheer: { dur: 1.6, clip: 'happy', head: 'hop', fx: ['sparkles'], body: /tap|happy|joy/i },
  clap: { dur: 1.8, head: 'bounceSmall', fx: ['sparkles'] },
  thumbsup: { dur: 2.0, wink: 'left', head: 'tiltSmall', fx: ['sparkles'] },
  peace: { dur: 2.0, wink: 'left', head: 'tilt' },
  point: { dur: 1.8, head: 'nodOnce' },
  idea: { dur: 1.8, head: 'chinUp', fx: ['bulb'] },
  think: { dur: 2.8, head: 'tilt', fx: ['dots'] },
  shrug: { dur: 1.8, head: 'tilt', fx: ['sweat'] },
  facepalm: { dur: 2.2, head: 'droop', fx: ['gloom'] },
  crossarms: { dur: 2.6, head: 'huff', fx: ['puff'] },
  hips: { dur: 2.4, head: 'chinUp', fx: ['sparkles'] },
  heart: { dur: 2.4, head: 'tilt', fx: ['hearts'] },
  blowkiss: { dur: 2.0, wink: 'left', fx: ['hearts'] },
  wink: { dur: 0.9, clip: null, wink: 'left', head: 'tiltSmall', fx: ['sparkles'] },
  shy: { dur: 2.4, head: 'droop', fx: ['blush'] },
  stretch: { dur: 3.0, head: 'chinUp' },
  yawn: { dur: 2.4, head: 'chinUp', mouth: 0.8 },
  dance: { dur: 4.0, head: 'bounce', fx: ['notes'], body: /dance|tap|happy/i },
  jump: { dur: 1.0, head: 'hop' },
  spin: { dur: 1.6, head: 'hop', fx: ['sparkles'] },
  salute: { dur: 1.8, head: 'nodOnce' },
  fistpump: { dur: 1.6, head: 'nodOnce', fx: ['fire'] },
  giggle: { dur: 1.6, head: 'giggle' },
  shiver: { dur: 1.8, head: 'shiver', fx: ['sweat'] },
  sigh: { dur: 2.0, head: 'droop', fx: ['sigh'] },
  lookaround: { dur: 2.6, clip: null, head: 'lookaround' },
  headtilt: { dur: 1.4, clip: null, head: 'tilt', fx: ['question'] },
  cry: { dur: 2.6, head: 'sob', fx: ['tears'] },
  recoil: { dur: 1.4, head: 'leanBack', fx: ['exclaim'] },
  stomp: { dur: 1.4, head: 'shakeSmall', fx: ['anger'] },
};

export const EMOTION_NAMES = Object.keys(EMOTIONS);
export const GESTURE_NAMES = Object.keys(GESTURES);

// Lo que la IA (u otra gente) pueda escribir en lugar del nombre exacto. Inglés y español.
export const ALIASES = {
  emo: {
    joy: 'happy', glad: 'happy', smile: 'happy', fun: 'happy', alegre: 'happy', feliz: 'happy',
    hype: 'excited', thrilled: 'excited', emocionada: 'excited',
    lol: 'laugh', laughing: 'laugh', risa: 'laugh',
    loving: 'love', adore: 'love', amor: 'love', enamorada: 'love',
    blush: 'shy', embarrassed: 'shy', timid: 'shy', verguenza: 'shy', timida: 'shy',
    flirt: 'flirty', seductive: 'flirty', coqueta: 'flirty', tease: 'playful', teasing: 'playful',
    cocky: 'smug', sassy: 'smug', chula: 'smug',
    mischief: 'playful', mischievous: 'playful', wink: 'playful', traviesa: 'playful',
    pride: 'proud', orgullosa: 'proud', thankful: 'grateful', thanks: 'grateful', agradecida: 'grateful',
    calm: 'relaxed', content: 'relaxed', peaceful: 'relaxed', tranquila: 'relaxed', relief: 'relieved', aliviada: 'relieved',
    dream: 'dreamy', sonadora: 'dreamy', tired: 'sleepy', sleep: 'sleepy', cansada: 'sleepy', dormida: 'sleepy',
    boring: 'bored', aburrida: 'bored', think: 'thinking', pensativa: 'thinking', hmm: 'thinking',
    interested: 'curious', curiosa: 'curious', puzzled: 'confused', confundida: 'confused',
    surprise: 'surprised', wow: 'surprised', sorprendida: 'surprised', shock: 'shocked',
    fear: 'scared', afraid: 'scared', asustada: 'scared', anxious: 'nervous', nerviosa: 'nervous', awkward: 'nervous',
    concerned: 'worried', preocupada: 'worried', sorrow: 'sad', unhappy: 'sad', triste: 'sad',
    cry: 'crying', tears: 'crying', llorando: 'crying', sulk: 'pout', puchero: 'pout', hmph: 'pout',
    irritated: 'annoyed', molesta: 'annoyed', mad: 'angry', anger: 'angry', furious: 'angry', enfadada: 'angry',
    disgust: 'disgusted', gross: 'disgusted', asco: 'disgusted', motivated: 'determined', decidida: 'determined',
    dizzy: 'dizzy', mareada: 'dizzy', calma: 'relaxed', normal: 'neutral',
  },
  act: {
    hi: 'wave', hello: 'wave', bye: 'wave', saludo: 'wave', saludar: 'wave', yes: 'nod', si: 'nod', no: 'shake',
    reverencia: 'bow', yay: 'cheer', hooray: 'cheer', aplaudir: 'clap', applause: 'clap', ok: 'thumbsup', like: 'thumbsup',
    victory: 'peace', v: 'peace', paz: 'peace', senalar: 'point', eureka: 'idea', bulb: 'idea', pensar: 'think',
    dunno: 'shrug', encoger: 'shrug', ugh: 'facepalm', cruzar: 'crossarms', armscrossed: 'crossarms',
    proud: 'hips', jarra: 'hips', corazon: 'heart', kiss: 'blowkiss', beso: 'blowkiss', guino: 'wink',
    estirar: 'stretch', bostezo: 'yawn', bailar: 'dance', saltar: 'jump', girar: 'spin', twirl: 'spin',
    saludomilitar: 'salute', vamos: 'fistpump', reir: 'giggle', temblar: 'shiver',
    suspiro: 'sigh', mirar: 'lookaround', tilt: 'headtilt', llorar: 'cry', retroceder: 'recoil', pisoton: 'stomp',
  },
};

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

// Nombre canónico de una emoción (o null si no se conoce).
export function resolveEmotion(name) {
  const n = norm(name);
  if (!n) return null;
  if (n in EMOTIONS) return n;
  return ALIASES.emo[n] || null;
}

export function resolveGesture(name) {
  const n = norm(name);
  if (!n) return null;
  if (n in GESTURES) return n;
  return ALIASES.act[n] || null;
}

// Menús (avatar, bandeja, Ajustes): emociones agrupadas para que no sea una lista eterna.
export const EMOTION_GROUPS = {
  joy: ['happy', 'excited', 'laugh', 'love', 'grateful', 'proud'],
  playful: ['flirty', 'playful', 'smug', 'shy', 'dreamy'],
  calm: ['relaxed', 'relieved', 'sleepy', 'bored', 'thinking', 'curious'],
  surprise: ['surprised', 'shocked', 'confused', 'dizzy', 'nervous', 'scared'],
  down: ['worried', 'sad', 'crying', 'pout', 'annoyed', 'angry', 'disgusted', 'determined'],
};

// Gestos que se hacen solos de vez en cuando con la asistente en reposo.
export const IDLE_GESTURES = ['stretch', 'lookaround', 'headtilt', 'wink', 'nod', 'sigh', 'giggle'];

// Ojos cerrados en la cara de la emoción: Behaviour no parpadea encima.
export const closedEyes = (name) => !!EMOTIONS[name]?.closed;

// Texto para el prompt del sistema (en inglés, como el resto de instrucciones al modelo).
export function expressionPrompt({ gestures = true } = {}) {
  const emos = EMOTION_NAMES.filter((n) => n !== 'neutral').join(', ');
  let s =
    `You have a visible animated avatar with a face and body. When the emotional tone of what you say genuinely changes, you may start that sentence with a hidden tag <emo:NAME>. Emotions: ${emos}, neutral.`;
  if (gestures)
    s += ` You can also make a body gesture with <act:NAME>: ${GESTURE_NAMES.join(', ')}. Use a gesture only when it fits (greeting → wave, agreeing → nod, celebrating → cheer, an idea → idea…).`;
  s += ' Use at most two or three tags per reply, never inside code, and never mention or explain them: they are removed from the text and only animate you.';
  return s;
}
