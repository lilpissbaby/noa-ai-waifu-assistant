// Gestos de una vez (no en bucle): se mezclan encima del estado solo en los huesos que definen.
export const talk1 = {
  name: 'talk-1',
  duration: 2.2,
  loop: false,
  bones: {
    rightUpperArm: [[0, 0, 10, -4], [0.6, 20, 35, -12], [1.6, 20, 33, -10], [2.2, 0, 10, -4]],
    rightLowerArm: [[0, 0, 35, 0], [0.6, -50, 75, 0], [1.1, -35, 65, 0], [1.6, -50, 75, 0], [2.2, 0, 35, 0]],
    rightHand: [[0, 0, 0, 0], [0.6, 0, 0, -15], [1.6, 0, 0, -10], [2.2, 0, 0, 0]],
  },
};

export const talk2 = {
  name: 'talk-2',
  duration: 2.4,
  loop: false,
  bones: {
    leftUpperArm: [[0, 0, -10, 4], [0.7, 0, -28, 14], [1.7, 0, -26, 12], [2.4, 0, -10, 4]],
    rightUpperArm: [[0, 0, 10, -4], [0.7, 0, 28, -14], [1.7, 0, 26, -12], [2.4, 0, 10, -4]],
    leftLowerArm: [[0, 0, -35, 0], [0.7, -50, -60, 0], [1.7, -45, -58, 0], [2.4, 0, -35, 0]],
    rightLowerArm: [[0, 0, 35, 0], [0.7, -50, 60, 0], [1.7, -45, 58, 0], [2.4, 0, 35, 0]],
  },
};

export const talk3 = {
  name: 'talk-3',
  duration: 2.2,
  loop: false,
  bones: {
    leftUpperArm: [[0, 0, -10, 4], [0.6, 20, -35, 12], [1.6, 20, -33, 10], [2.2, 0, -10, 4]],
    leftLowerArm: [[0, 0, -35, 0], [0.6, -50, -75, 0], [1.1, -35, -65, 0], [1.6, -50, -75, 0], [2.2, 0, -35, 0]],
    leftHand: [[0, 0, 0, 0], [0.6, 0, 0, 15], [1.6, 0, 0, 10], [2.2, 0, 0, 0]],
    spine: [[0, 2, 0, 0], [0.8, 2, -3, 0], [2.2, 2, 0, 0]],
  },
};

// Saludo con la mano derecha: brazo arriba y antebrazo de lado a lado.
export const greet = {
  name: 'greet',
  duration: 2.4,
  loop: false,
  bones: {
    rightUpperArm: [[0, 0, 0, 0], [0.45, 0, 0, -80], [2.0, 0, 0, -80], [2.4, 0, 0, 0]],
    rightLowerArm: [[0, 0, 0, 0], [0.45, 0, 0, -90], [0.75, 0, 0, -72], [1.05, 0, 0, -105], [1.35, 0, 0, -72], [1.65, 0, 0, -105], [2.0, 0, 0, -90], [2.4, 0, 0, 0]],
    head: [[0, 0, 0, 0], [0.5, 0, 0, -6], [2.0, 0, 0, -6], [2.4, 0, 0, 0]],
  },
};

// Alegría: brazos arriba y saltito.
export const happy = {
  name: 'happy',
  duration: 1.6,
  loop: false,
  bones: {
    leftUpperArm: [[0, 0, 0, 0], [0.35, 0, -10, 115], [1.1, 0, -10, 115], [1.6, 0, 0, 0]],
    rightUpperArm: [[0, 0, 0, 0], [0.35, 0, 10, -115], [1.1, 0, 10, -115], [1.6, 0, 0, 0]],
    leftLowerArm: [[0, 0, 0, 0], [0.35, 0, -25, 0], [1.1, 0, -25, 0], [1.6, 0, 0, 0]],
    rightLowerArm: [[0, 0, 0, 0], [0.35, 0, 25, 0], [1.1, 0, 25, 0], [1.6, 0, 0, 0]],
  },
  hipsY: [[0, 0], [0.3, 0.035], [0.55, 0], [0.8, 0.02], [1.0, 0], [1.6, 0]],
};
