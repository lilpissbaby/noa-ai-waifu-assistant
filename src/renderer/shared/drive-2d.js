// Traduce las señales de Behaviour a los parámetros de la malla 2D (las mismas cuentas de la v0.2,
// más el movimiento de cabeza de gestos y emociones). H = alto de la imagen de la skin, en píxeles.
export function drive2d(s, H) {
  const h = s.head || {};
  const blink = s.blink;
  return {
    breath: s.breath,
    blink,
    blinkL: s.blinkL ?? blink,
    blinkR: s.blinkR ?? blink,
    mouth: Math.max(s.mouth, s.mouthHold || 0),
    headAngle: s.sway + s.look.x * 0.07 + s.tilt + (h.roll || 0),
    headX: s.look.x * H * 0.012 + (h.yaw || 0) * H * 0.03 + (h.x || 0) * H,
    headY: s.look.y * H * 0.006 - s.lift * H * 0.004 + (h.pitch || 0) * H * 0.05,
    bounce: (s.hop > 0 ? -Math.abs(Math.sin(s.hop * Math.PI * 1.5)) * H * 0.025 * s.hop : s.mouth * -H * 0.002) - (h.y || 0) * H,
  };
}
