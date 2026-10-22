// Pose base del avatar VRM y utilidades de rotación (grados). Los VRM normalizados vienen en pose T,
// mirando a +Z; +X es la izquierda del personaje (la derecha de la pantalla).
import { Euler, Quaternion } from 'three';

const DEG = Math.PI / 180;

// Brazos bajados a una pose A relajada, codos un poco flexionados.
export const BASE_POSE = {
  leftUpperArm: [0, 0, -68],
  rightUpperArm: [0, 0, 68],
  leftLowerArm: [0, -12, 0],
  rightLowerArm: [0, 12, 0],
};

const _e = new Euler();
export const quatFromDeg = ([x, y, z], out = new Quaternion()) => out.setFromEuler(_e.set(x * DEG, y * DEG, z * DEG));

const BASE_Q = Object.fromEntries(Object.entries(BASE_POSE).map(([b, r]) => [b, quatFromDeg(r)]));
const IDENTITY = new Quaternion();

// Rotación local de un hueso en la pose base (identidad si la pose base no lo toca).
export const baseQuat = (bone) => BASE_Q[bone] || IDENTITY;
