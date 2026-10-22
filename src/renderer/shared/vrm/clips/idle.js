// Reposo: dos variantes que se alternan. Rotaciones en grados [t, x, y, z] relativas a la pose base.
// Ejes (VRM normalizado, mirando a +Z): x+ inclina hacia delante, z+ inclina hacia la derecha del
// personaje. Brazo izquierdo: y- adelante, z+ arriba; brazo derecho: y+ adelante, z- arriba; en los
// dos, x+ gira el brazo hacia dentro (el codo dobla hacia el centro). Codo: y dobla hacia delante
// (izquierdo y-, derecho y+); z dobla hacia arriba con el brazo levantado (izquierdo z+, derecho z-).
// Para reflejar un movimiento de un lado al otro: x igual, y y z cambiados de signo.
export const idleA = {
  name: 'idle-a',
  duration: 6,
  loop: true,
  bones: {
    hips: [[0, 0, 0, 0], [3, 0, 2, -1.5], [6, 0, 0, 0]],
    spine: [[0, 1, 0, 0], [3, 1.5, -1.5, 1.5], [6, 1, 0, 0]],
    leftUpperArm: [[0, 0, -4, 0], [3, 0, -6, 1.5], [6, 0, -4, 0]],
    rightUpperArm: [[0, 0, 4, 0], [3, 0, 6, -1], [6, 0, 4, 0]],
    leftLowerArm: [[0, 0, -6, 0], [3, 0, -10, 0], [6, 0, -6, 0]],
    rightLowerArm: [[0, 0, 6, 0], [3, 0, 9, 0], [6, 0, 6, 0]],
  },
};

// Manos juntas por delante, peso en la otra pierna.
export const idleB = {
  name: 'idle-b',
  duration: 5,
  loop: true,
  bones: {
    hips: [[0, 0, -2, 1.5], [2.5, 0, -3, 2], [5, 0, -2, 1.5]],
    spine: [[0, 2, 1.5, -1.5], [2.5, 2.5, 2, -2], [5, 2, 1.5, -1.5]],
    leftUpperArm: [[0, 45, -15, -10], [2.5, 45, -17, -10], [5, 45, -15, -10]],
    rightUpperArm: [[0, 45, 15, 10], [2.5, 45, 17, 10], [5, 45, 15, 10]],
    leftLowerArm: [[0, 0, -80, 0], [2.5, 0, -82, 0], [5, 0, -80, 0]],
    rightLowerArm: [[0, 0, 80, 0], [2.5, 0, 82, 0], [5, 0, 80, 0]],
    head: [[0, 2, 0, -3], [2.5, 2, 0, -4], [5, 2, 0, -3]],
  },
};
