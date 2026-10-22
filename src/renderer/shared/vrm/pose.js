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

// Los VRM 0.x miran a −Z en su espacio local (rotateVRM0 gira la escena 180°): una rotación pensada para
// VRM 1.0 se pasa a su espacio negando x y z del cuaternión (lo mismo que hace three-vrm-animation).
export const toVrm0 = (q) => q.set(-q.x, q.y, -q.z, q.w);

const BASE_Q = Object.fromEntries(Object.entries(BASE_POSE).map(([b, r]) => [b, quatFromDeg(r)]));
const BASE_Q0 = Object.fromEntries(Object.entries(BASE_Q).map(([b, q]) => [b, toVrm0(q.clone())]));
const IDENTITY = new Quaternion();

// Rotación local de un hueso en la pose base (identidad si la pose base no lo toca).
export const baseQuat = (bone, vrm0 = false) => (vrm0 ? BASE_Q0 : BASE_Q)[bone] || IDENTITY;
