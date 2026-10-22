// Bucle de animación único: en cada fotograma pide señales a Behaviour, se las pasa al renderizador
// y dibuja. El renderizador puede cambiar en caliente (stage.renderer = otro) sin crear otro bucle.
export class Stage {
  constructor(renderer, behaviour) {
    this.renderer = renderer;
    this.behaviour = behaviour;
    this.running = false;
    this.loopId = 0;
    this.last = 0;
    this.lastSignals = null;
    this.wantRunning = false;
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.pause();
        else if (this.wantRunning) this.resume();
      });
    }
  }

  start() {
    this.wantRunning = true;
    this.resume();
  }

  stop() {
    this.wantRunning = false;
    this.pause();
  }

  pause() {
    this.running = false;
  }

  resume() {
    if (this.running) return;
    this.running = true;
    const id = ++this.loopId;
    const loop = (now) => {
      if (!this.running || id !== this.loopId) return;
      this.frame(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  frame(now) {
    const r = this.renderer;
    if (!r) return;
    const interval = this.lastSignals ? r.frameInterval(this.lastSignals) : 0;
    // margen de 2 ms para no saltarse fotogramas por el redondeo de los tiempos de rAF
    if (interval && now - this.last < interval - 2) return;
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 1 / 60;
    this.last = now;
    const signals = this.behaviour.tick(now, r.headAnchorCss());
    this.lastSignals = signals;
    r.apply(signals);
    r.render(dt);
  }
}
