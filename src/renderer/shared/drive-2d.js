// Traduce las señales de Behaviour a los parámetros de la malla 2D (las mismas cuentas de la v0.2).
// H = alto de la imagen de la skin, en píxeles.
export function drive2d(s, H) {
  return {
    breath: s.breath,
    blink: s.blink,
    mouth: s.mouth,
    headAngle: s.sway + s.look.x * 0.07 + s.tilt,
    headX: s.look.x * H * 0.012,
    headY: s.look.y * H * 0.006 - s.lift * H * 0.004,
    bounce: s.hop > 0 ? -Math.abs(Math.sin(s.hop * Math.PI * 1.5)) * H * 0.025 * s.hop : s.mouth * -H * 0.002,
  };
}
