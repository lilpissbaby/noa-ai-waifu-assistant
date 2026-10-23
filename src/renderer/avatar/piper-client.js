// Cliente del worker de Piper: una petición por frase, con su id.
export class PiperClient {
  constructor() {
    this.worker = null;
    this.pending = new Map();
    this.seq = 0;
  }

  ensure() {
    if (this.worker) return;
    this.worker = new Worker(new URL('./piper-worker.js', import.meta.url), { type: 'module' });
    this.worker.onmessage = ({ data }) => {
      const p = this.pending.get(data.id);
      if (!p) return;
      this.pending.delete(data.id);
      if (data.error) p.reject(new Error(data.error));
      else p.resolve(data.wav);
    };
    this.worker.onerror = (e) => {
      for (const p of this.pending.values()) p.reject(new Error(e.message || 'Piper worker error'));
      this.pending.clear();
    };
  }

  // voice: { modelUrl, configUrl, rate, speaker }. Devuelve el WAV (ArrayBuffer).
  synth(text, voice, runtimeUrl) {
    this.ensure();
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, text, voice, runtimeUrl });
    });
  }
}
