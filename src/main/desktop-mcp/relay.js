// Cola entre lo que le dices a la asistente (texto o voz) y la conversación de Claude Desktop que
// le hace de cerebro. Claude Desktop no deja que un servidor MCP le pida respuestas (no tiene
// «sampling»), así que es Claude quien pregunta: llama a noa_listen, que espera aquí hasta que
// hay un mensaje, y contesta con noa_say. No depende de Electron (se prueba con node --test).

// Sin ninguna llamada de Claude en este tiempo se da por hecho que ya no está escuchando
// (cada noa_listen dura como mucho ~3,5 min: el límite de Claude Desktop es 240 s por llamada).
export const IDLE_AFTER_MS = 5 * 60_000;

export class Relay {
  constructor({ now = () => Date.now(), idleAfterMs = IDLE_AFTER_MS } = {}) {
    this.now = now;
    this.idleAfterMs = idleAfterMs;
    this.inbox = []; // mensajes que Claude aún no ha recogido
    this.active = []; // entregados a Claude y sin respuesta final todavía
    this.waiters = []; // noa_listen abiertos: { resolve, session }
    this.lastSeen = 0; // última llamada de Claude (cualquiera)
    this.sessions = new Map(); // id del puente -> { client, firstSeen, lastSeen, briefKey, lastListen }
    this.notes = []; // avisos para el siguiente noa_listen («el usuario paró la respuesta»…)
    this.seq = 0;
  }

  /** Registra una llamada del puente (cada proceso del puente tiene su id). */
  touch(session = 'default', client = '') {
    const now = this.now();
    this.lastSeen = now;
    let s = this.sessions.get(session);
    if (!s) {
      s = { client, firstSeen: now, lastSeen: now, briefKey: null, lastListen: 0 };
      this.sessions.set(session, s);
    }
    s.lastSeen = now;
    if (client) s.client = client;
    // Solo se guardan las sesiones recientes.
    for (const [id, x] of this.sessions) if (now - x.lastSeen > 24 * 3600_000) this.sessions.delete(id);
    return s;
  }

  get listening() {
    return this.waiters.length > 0;
  }

  /** ¿Hay una conversación de Claude atenta? (esperando ahora o llamó hace poco). */
  connected() {
    return this.listening || (this.lastSeen > 0 && this.now() - this.lastSeen < this.idleAfterMs);
  }

  /** Mete un mensaje en la cola. msg: { text, via, attachments, hidden, speak, onDone, label } */
  enqueue(msg) {
    const item = { id: ++this.seq, ts: this.now(), ...msg };
    this.inbox.push(item);
    this.#flush();
    return item;
  }

  // Aviso para Claude que va con el siguiente mensaje (no despierta a nadie por sí solo).
  note(text) {
    if (text && !this.notes.includes(text)) this.notes.push(text);
  }

  #flush() {
    while (this.inbox.length && this.waiters.length) {
      const w = this.waiters.shift();
      w.cleanup();
      w.resolve(this.#take());
    }
  }

  #take() {
    const messages = this.inbox.splice(0);
    const notes = this.notes.splice(0);
    this.active.push(...messages);
    return { messages, notes };
  }

  /**
   * Espera al siguiente mensaje. Devuelve { messages, notes, unanswered } o { timeout: true } o
   * { cancelled: true }. unanswered: los entregados antes que Claude dejó sin respuesta final.
   */
  listen({ timeoutMs = 180_000, signal, session = 'default', client = '' } = {}) {
    const s = this.touch(session, client);
    s.lastListen = this.now();
    const unanswered = this.active.splice(0);
    if (this.inbox.length) return Promise.resolve({ ...this.#take(), unanswered });
    if (signal?.aborted) return Promise.resolve({ cancelled: true, unanswered });
    return new Promise((resolve) => {
      const w = { session };
      const done = (value) => {
        w.cleanup();
        const i = this.waiters.indexOf(w);
        if (i >= 0) this.waiters.splice(i, 1);
        this.lastSeen = this.now();
        resolve({ ...value, unanswered });
      };
      const timer = setTimeout(() => done({ timeout: true, notes: this.notes.splice(0) }), Math.max(0, timeoutMs));
      const onAbort = () => done({ cancelled: true });
      signal?.addEventListener('abort', onAbort, { once: true });
      w.cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      };
      w.resolve = (value) => {
        this.lastSeen = this.now();
        resolve({ ...value, unanswered });
      };
      this.waiters.push(w);
    });
  }

  /** Los mensajes entregados que esperan respuesta (para noa_say). */
  pending() {
    return this.active;
  }

  /** Respuesta final dada: devuelve los mensajes que contestaba y los quita de la lista. */
  settle() {
    return this.active.splice(0);
  }

  /** Botón de parar: se tira lo que había en cola y lo que Claude estaba contestando. */
  cancel() {
    const dropped = [...this.inbox.splice(0), ...this.active.splice(0)];
    return dropped;
  }

  status() {
    return {
      connected: this.connected(),
      listening: this.listening,
      waiting: this.waiters.length,
      queued: this.inbox.length,
      answering: this.active.length,
      lastSeen: this.lastSeen || null,
      clients: [...new Set([...this.sessions.values()].filter((s) => this.now() - s.lastSeen < this.idleAfterMs).map((s) => s.client).filter(Boolean))],
    };
  }
}
