// Lo que depende de si estás usando el PC: recordatorios de pausas (agua, estirarse, descansar
// la vista) y el modo mascota (se duerme cuando no estás y te saluda al volver). main.js llama a
// tick() cada minuto con los segundos sin tocar teclado ni ratón (powerMonitor.getSystemIdleTime).

export const BREAK_DEFAULTS = { enabled: false, every: 50, idleResetMin: 5 };
export const PRESENCE_DEFAULTS = { sleep: true, sleepAfterMin: 10, welcomeBack: true };
export const BREAK_TIPS = 4; // breaks.tip0 … breaks.tip3

export class BreakCoach {
  // onBreak(tipIndex, activeMinutes); paused(): true mientras hay un bloque de concentración (ya
  // trae sus descansos).
  constructor({ settings = () => ({}), onBreak = () => {}, paused = () => false }) {
    Object.assign(this, { settings, onBreak, paused });
    this.active = 0;
    this.tip = 0;
  }

  tick(idleSec, minutes = 1) {
    const s = { ...BREAK_DEFAULTS, ...this.settings() };
    if (!s.enabled) {
      this.active = 0;
      return null;
    }
    if (idleSec >= Math.max(1, Number(s.idleResetMin) || 5) * 60) {
      this.active = 0;
      return null;
    }
    this.active += minutes;
    if (this.paused()) return null;
    if (this.active >= Math.max(10, Number(s.every) || 50)) {
      const tip = this.tip;
      const active = this.active;
      this.tip = (this.tip + 1) % BREAK_TIPS;
      this.active = 0;
      this.onBreak(tip, active);
      return tip;
    }
    return null;
  }
}

export class Presence {
  // onSleep(bool); onWelcome(minutesAway)
  constructor({ settings = () => ({}), onSleep = () => {}, onWelcome = () => {} }) {
    Object.assign(this, { settings, onSleep, onWelcome });
    this.asleep = false;
    this.awayMin = 0;
  }

  // busy: la asistente está pensando, hablando o haciendo algo (no se duerme).
  tick(idleSec, { busy = false } = {}) {
    const s = { ...PRESENCE_DEFAULTS, ...this.settings() };
    const limit = Math.max(1, Number(s.sleepAfterMin) || 10) * 60;
    if (!this.asleep) {
      if (s.sleep && !busy && idleSec >= limit) {
        this.asleep = true;
        this.awayMin = Math.round(idleSec / 60);
        this.onSleep(true);
        return 'sleep';
      }
      return null;
    }
    // Dormida: si vuelves (menos de un minuto sin tocar nada), se despierta.
    this.awayMin = Math.max(this.awayMin, Math.round(idleSec / 60));
    if (idleSec < 60 || busy || !s.sleep) {
      const away = this.awayMin;
      this.asleep = false;
      this.awayMin = 0;
      this.onSleep(false);
      if (s.welcomeBack && !busy && s.sleep) this.onWelcome(away);
      return 'wake';
    }
    return null;
  }

  // Despertar a mano (clic en ella, un aviso…), sin saludo.
  wake() {
    if (!this.asleep) return;
    this.asleep = false;
    this.awayMin = 0;
    this.onSleep(false);
  }
}

// Historial del portapapeles: solo en memoria (no se guarda en disco) y solo si lo activas.
export class ClipHistory {
  constructor({ max = 50, now = () => new Date() } = {}) {
    this.max = max;
    this.now = now;
    this.items = [];
    this.seq = 0;
  }

  push(text) {
    const s = String(text ?? '');
    if (!s.trim() || s.length > 20000) return false;
    if (this.items[0]?.text === s) return false;
    this.items = this.items.filter((x) => x.text !== s);
    this.items.unshift({ id: String(++this.seq), text: s, at: this.now().toISOString() });
    if (this.items.length > this.max) this.items.length = this.max;
    return true;
  }

  list({ query = '', limit = 20 } = {}) {
    const q = String(query || '').toLowerCase();
    return this.items.filter((x) => !q || x.text.toLowerCase().includes(q)).slice(0, Math.max(1, Math.min(100, Number(limit) || 20)));
  }

  get(id) {
    return this.items.find((x) => x.id === String(id)) || null;
  }

  remove(id) {
    const before = this.items.length;
    this.items = this.items.filter((x) => x.id !== String(id));
    return this.items.length !== before;
  }

  clear() {
    this.items = [];
  }

  setMax(max) {
    this.max = Math.max(5, Math.min(500, Number(max) || 50));
    if (this.items.length > this.max) this.items.length = this.max;
  }
}
