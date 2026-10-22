// Qué partes de la app sirve el protocolo app://local/bundle/… (rutas relativas a la raíz).
import { VENDOR_FILES } from '../shared/vendor.js';

export const BUNDLE_ALLOWED = ['src/renderer/', 'src/shared/', 'assets/', 'node_modules/onnxruntime-web/dist/', ...VENDOR_FILES];

export const isBundleAllowed = (rel) => BUNDLE_ALLOWED.some((p) => (p.endsWith('/') ? rel.startsWith(p) : rel === p));
