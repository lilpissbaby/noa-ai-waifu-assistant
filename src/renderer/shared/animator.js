// Da vida a la skin: respiración, parpadeo, balanceo, mirar al cursor y boca sincronizada con el audio.
export class Animator {
  constructor(renderer) {
    this.r = renderer;
    this.t0 = performance.now();
    this.nextBlink = 1500;
    this.blinkStart = -1;
    this.doubleBlink = false;
    this.mouthTarget = 0;
    this.mouth = 0;
    this.speaking = false;
    this.levelFn = null; // () => 0..1 nivel de audio
    this.cursor = null; // {x,y} relativo al canvas (px CSS)
    this.look = { a: 0, x: 0, y: 0 };
    this.state = 'idle';
    this.hop = 0;
    this.running = false;
    this.fakeTalkUntil = 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = (now) => {
      if (!this.running) return;
      this.tick(now);
      this.r.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  stop() {
    this.running = false;
  }

  blink() {
    this.nextBlink = performance.now() - this.t0;
  }
  bounce() {
    this.hop = 1;
  }

  tick(now) {
    const t = (now - this.t0) / 1000;
    const ms = now - this.t0;
    const P = this.r.params;
    const sk = this.r.skin;
    if (!sk) return;
    const H = sk.height;

    // respiración (más rápida si "piensa")
    const breathSpeed = this.state === 'thinking' || this.state === 'working' ? 1.6 : 1;
    P.breath = Math.sin(t * Math.PI * 2 * 0.26 * breathSpeed);

    // parpadeo con tiempos aleatorios, a veces doble
    if (this.blinkStart < 0 && ms >= this.nextBlink) {
      this.blinkStart = ms;
      this.doubleBlink = Math.random() < 0.18;
    }
    if (this.blinkStart >= 0) {
      const d = ms - this.blinkStart;
      const dur = 150;
      if (d < dur) P.blink = Math.sin((d / dur) * Math.PI);
      else if (this.doubleBlink && d < dur * 2.3) P.blink = d < dur * 1.3 ? 0 : Math.sin(((d - dur * 1.3) / dur) * Math.PI);
      else {
        P.blink = 0;
        this.blinkStart = -1;
        this.nextBlink = ms + 2200 + Math.random() * 4200;
      }
    }
    if (this.state === 'listening') P.blink = Math.min(P.blink, 0.0);

    // mirar al cursor + balanceo suave
    let ta = Math.sin(t * 0.55) * 0.025 + Math.sin(t * 1.3) * 0.008;
    let tx = 0;
    let ty = 0;
    if (this.cursor && this.r.view) {
      const [hx, hy] = this.r.imageToCss(sk.rig.neck.x, sk.rig.neck.y * 0.6);
      const dx = this.cursor.x - hx;
      const dy = this.cursor.y - hy;
      const nx = Math.max(-1, Math.min(1, dx / 700));
      const ny = Math.max(-1, Math.min(1, dy / 500));
      ta += nx * 0.07;
      tx = nx * H * 0.012;
      ty = ny * H * 0.006;
    }
    if (this.state === 'thinking') {
      ta += 0.06 + Math.sin(t * 2) * 0.01;
      ty -= H * 0.004;
    }
    if (this.state === 'listening') ta += Math.sin(t * 3) * 0.012 - 0.04;
    const k = 0.08;
    this.look.a += (ta - this.look.a) * k;
    this.look.x += (tx - this.look.x) * k;
    this.look.y += (ty - this.look.y) * k;
    P.headAngle = this.look.a;
    P.headX = this.look.x;
    P.headY = this.look.y;

    // boca: nivel de audio real, o charla simulada para voces del sistema
    let target = 0;
    if (this.levelFn) target = this.levelFn();
    if (now < this.fakeTalkUntil) target = Math.max(target, 0.25 + 0.55 * Math.abs(Math.sin(t * 13.0) * Math.sin(t * 4.7 + 1)));
    this.mouthTarget = target;
    const rate = target > this.mouth ? 0.55 : 0.3;
    this.mouth += (target - this.mouth) * rate;
    P.mouth = this.mouth < 0.03 ? 0 : Math.min(1, this.mouth);

    // saltito (al abrir chat, al terminar...)
    if (this.hop > 0.001) {
      this.hop *= 0.9;
      P.bounce = -Math.abs(Math.sin(this.hop * Math.PI * 1.5)) * H * 0.025 * this.hop;
    } else P.bounce = P.mouth * -H * 0.002;
  }
}
