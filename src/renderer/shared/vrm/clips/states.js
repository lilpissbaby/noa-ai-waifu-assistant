// Poses en bucle de los estados de trabajo. Mismas convenciones que idle.js.
// Mano derecha en la barbilla, la izquierda sujetando el codo, cabeza ladeada mirando arriba.
export const thinking = {
  name: 'thinking',
  duration: 4,
  loop: true,
  bones: {
    spine: [[0, 2, -3, -1], [2, 2.5, -4, -1.5], [4, 2, -3, -1]],
    rightUpperArm: [[0, 30, 32, 14], [2, 30, 33, 14], [4, 30, 32, 14]],
    rightLowerArm: [[0, 0, 118, 0], [2, 0, 116, 0], [4, 0, 118, 0]],
    rightHand: [[0, 0, 0, 20], [4, 0, 0, 20]],
    leftUpperArm: [[0, 60, -10, -8], [4, 60, -10, -8]],
    leftLowerArm: [[0, 0, -90, 0], [4, 0, -90, 0]],
    head: [[0, -6, 0, 6], [2, -7, 0, 7], [4, -6, 0, 6]],
  },
};

export const listening = {
  name: 'listening',
  duration: 3,
  loop: true,
  bones: {
    spine: [[0, 5, 0, 0], [1.5, 6, 0, 1], [3, 5, 0, 0]],
    leftUpperArm: [[0, 0, -15, -4], [3, 0, -15, -4]],
    rightUpperArm: [[0, 0, 15, 4], [3, 0, 15, 4]],
    leftLowerArm: [[0, 0, -30, 0], [3, 0, -30, 0]],
    rightLowerArm: [[0, 0, 30, 0], [3, 0, 30, 0]],
  },
};

// Tecleando: antebrazos al frente con un leve vaivén.
export const working = {
  name: 'working',
  duration: 1.2,
  loop: true,
  bones: {
    spine: [[0, 6, 0, 0], [1.2, 6, 0, 0]],
    leftUpperArm: [[0, 0, -32, 6], [0.6, 0, -33, 6], [1.2, 0, -32, 6]],
    rightUpperArm: [[0, 0, 32, -6], [0.6, 0, 33, -6], [1.2, 0, 32, -6]],
    leftLowerArm: [[0, 0, -78, 0], [0.3, 0, -82, 0], [0.6, 0, -78, 0], [1.2, 0, -78, 0]],
    rightLowerArm: [[0, 0, 78, 0], [0.6, 0, 78, 0], [0.9, 0, 82, 0], [1.2, 0, 78, 0]],
    leftHand: [[0, 0, 0, -10], [0.3, 0, 0, -16], [0.6, 0, 0, -10], [1.2, 0, 0, -10]],
    rightHand: [[0, 0, 0, 10], [0.6, 0, 0, 10], [0.9, 0, 0, 16], [1.2, 0, 0, 10]],
  },
};

// Hablando: manos relajadas por delante, a la altura de la cintura (los gestos van encima).
export const talking = {
  name: 'talking',
  duration: 3,
  loop: true,
  bones: {
    spine: [[0, 2, 0, 0], [1.5, 2, 2, 0.5], [3, 2, 0, 0]],
    leftUpperArm: [[0, 25, -10, -6], [1.5, 25, -12, -5], [3, 25, -10, -6]],
    rightUpperArm: [[0, 25, 10, 6], [1.5, 25, 12, 5], [3, 25, 10, 6]],
    leftLowerArm: [[0, 0, -50, 0], [1.5, 0, -55, 0], [3, 0, -50, 0]],
    rightLowerArm: [[0, 0, 50, 0], [1.5, 0, 55, 0], [3, 0, 50, 0]],
  },
};
