// Librerías de terceros que usan las páginas con 3D. No hay bundler: se sirven tal cual desde
// node_modules por app://local/bundle/… y solo estos archivos se empaquetan (ver package.json).
// Orden de carga de Live2D (el Cubism Core va entre unsafe-eval y el motor; ver live2d/runtime.js).
export const LIVE2D_SCRIPTS = ['/bundle/node_modules/pixi.js/dist/pixi.min.js', '/bundle/node_modules/pixi.js/dist/packages/unsafe-eval.min.js', '/bundle/node_modules/untitled-pixi-live2d-engine/dist/cubism.min.js'];

export const VENDOR_FILES = [
  'node_modules/three/build/three.module.js',
  'node_modules/three/build/three.core.js',
  'node_modules/three/examples/jsm/loaders/GLTFLoader.js',
  'node_modules/three/examples/jsm/loaders/FBXLoader.js',
  'node_modules/three/examples/jsm/utils/BufferGeometryUtils.js',
  'node_modules/three/examples/jsm/utils/SkeletonUtils.js',
  'node_modules/three/examples/jsm/libs/fflate.module.js',
  'node_modules/three/examples/jsm/curves/NURBSCurve.js',
  'node_modules/three/examples/jsm/curves/NURBSUtils.js',
  'node_modules/@pixiv/three-vrm/lib/three-vrm.module.min.js',
  'node_modules/@pixiv/three-vrm-animation/lib/three-vrm-animation.module.min.js',
  // Live2D: versiones UMD (scripts clásicos). La ESM de pixi necesita 'unsafe-eval' o su módulo
  // pixi.js/unsafe-eval, que sin bundler no se puede servir; la UMD trae ese parche aparte.
  ...LIVE2D_SCRIPTS.map((u) => u.replace(/^\/bundle\//, '')),
];

// Debe coincidir con el <script type="importmap"> de cada página (lo comprueba test/vendor.test.mjs).
export const IMPORT_MAP = {
  imports: {
    three: '/bundle/node_modules/three/build/three.module.js',
    'three/addons/': '/bundle/node_modules/three/examples/jsm/',
    '@pixiv/three-vrm': '/bundle/node_modules/@pixiv/three-vrm/lib/three-vrm.module.min.js',
    '@pixiv/three-vrm-animation': '/bundle/node_modules/@pixiv/three-vrm-animation/lib/three-vrm-animation.module.min.js',
  },
};
