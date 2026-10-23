// Qué partes de la app sirve el protocolo app://local/bundle/… (rutas relativas a la raíz).
import { VENDOR_FILES } from '../shared/vendor.js';

export const BUNDLE_ALLOWED = ['src/renderer/', 'src/shared/', 'assets/', 'node_modules/onnxruntime-web/dist/', ...VENDOR_FILES];

export const isBundleAllowed = (rel) => BUNDLE_ALLOWED.some((p) => (p.endsWith('/') ? rel.startsWith(p) : rel === p));

// Carpetas de userData que sirve app://local/user/… (nunca config, claves ni conversaciones).
export const USER_AREAS = ['skins', 'tmp', 'models', 'motions', 'personas', 'runtime', 'voices', 'attachments', 'live2d'];

export const isUserAllowed = (rel) => {
  const parts = String(rel || '').split(/[\\/]+/);
  return parts.length > 1 && USER_AREAS.includes(parts[0]) && !parts.includes('..') && parts.at(-1) !== '';
};
