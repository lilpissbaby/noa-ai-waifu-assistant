// Animaciones propias (licencia MIT, escritas como datos). Ver motion.js para el formato.
import { idleA, idleB } from './idle.js';
import { thinking, listening, working, talking } from './states.js';
import { talk1, talk2, talk3, greet, happy } from './gestures.js';

export const CLIPS = Object.fromEntries([idleA, idleB, thinking, listening, working, talking, talk1, talk2, talk3, greet, happy].map((c) => [c.name, c]));

// Biblioteca por defecto para MotionPlayer (los nombres de clips de cada estado o gesto).
export const DEFAULT_ASSIGN = {
  idle: ['idle-a', 'idle-b'],
  thinking: ['thinking'],
  listening: ['listening'],
  working: ['working'],
  talking: ['talking'],
  greet: ['greet'],
  happy: ['happy'],
  talkGesture: ['talk-1', 'talk-2', 'talk-3'],
};
