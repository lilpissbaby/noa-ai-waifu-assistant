// Canal común de avisos: recordatorios, resumen diario, tareas de agentes que terminan…
// main.js registra cómo se anuncia (bocadillo, chat, notificación y voz según
// productivity.notify); los módulos solo llaman a announce().
let announcer = null;

export function setAnnouncer(fn) {
  announcer = fn;
}

export function announce({ text, kind = 'reminder', speak = true }) {
  if (!announcer || !String(text || '').trim()) return false;
  announcer({ text: String(text).trim(), kind, speak });
  return true;
}
