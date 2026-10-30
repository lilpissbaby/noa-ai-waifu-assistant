// Modelos para las imágenes de la documentación: los de la galería de la app (src/shared/gallery.js)
// y, solo para la imagen del README, otros modelos gratuitos que no se pueden redistribuir y por
// eso no están en la galería (se ven, pero la app no los ofrece).
import { GALLERY } from '../src/shared/gallery.js';

const gh = (repo, sha, file) => `https://raw.githubusercontent.com/${repo}/${sha}/${file}`;
const WEBAVERSE = ['webaverse/avatar-models', '7516201eb94199d805e2394f43e01b3c79782fcd'];

export const EXTRA = [
  { id: 'noa-3d', name: 'Noa 3D (de serie)', kind: 'vrm', author: 'pixiv Inc.', license: 'VRM Public License 1.0 · ya viene con la app', source: 'https://github.com/pixiv/three-vrm', url: gh('vrm-c/vrm-specification', '94e82dd346fa6cf0337c4421728640e5252dd38e', 'samples/VRM1_Constraint_Twist_Sample/vrm/VRM1_Constraint_Twist_Sample.vrm') },
  { id: 'aituber-miko', name: 'Miko (AITuber OnAir)', kind: 'vrm', author: 'AITuber OnAir', license: 'Uso libre, sin redistribuir ni uso sexual', source: 'https://github.com/shinshin86/aituber-onair', url: gh('shinshin86/aituber-onair', 'HEAD', 'packages/core/examples/react-vrm-app/public/avatar/miko.vrm') },
  { id: 'scillia', name: 'Scillia', kind: 'vrm', author: 'GloriaTheAnimator', license: 'Uso personal no comercial, sin redistribuir', source: 'https://github.com/webaverse/app', url: gh('webaverse/app', 'HEAD', 'public/avatars/Scillia_Drophunter_V19.vrm') },
  ...[
    [14, 'Pelo azul', 'VRoid Hub: comercial, sin modificar'],
    [15, 'Monja pagana', 'VRoid Hub: no comercial, sin modificar'],
    [36, 'Capucha gris', 'VRoid Hub: no comercial, con crédito'],
    [37, 'Pelo castaño', 'VRoid Hub: no comercial, con crédito, sin modificar'],
    [40, 'Pelirroja', 'VRoid Hub: no comercial, con crédito, sin modificar'],
    [42, 'Yagami Yato', 'VRoid Hub: con crédito, sin modificar'],
    [43, 'Pelo negro', 'VRoid Hub: no comercial, con crédito'],
    [46, 'Coleta', 'VRoid Hub: comercial'],
    [49, 'Miku azul', 'VRoid Hub: no comercial'],
    [50, 'Pelo rosa', 'VRoid Hub: no comercial, con crédito'],
  ].map(([n, name, license]) => ({ id: `vroidhub-${n}`, name, kind: 'vrm', author: 'VRoid Hub', license: `${license} · no redistribuible`, source: 'https://github.com/webaverse/avatar-models', url: gh(...WEBAVERSE, `model${n}.vrm`) })),
];

export const ALL_MODELS = [...GALLERY.map((g) => ({ ...g, inGallery: true })), ...EXTRA.map((e) => ({ ...e, inGallery: false }))];
