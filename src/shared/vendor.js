// Librerías de terceros que usan las páginas con 3D. No hay bundler: se sirven tal cual desde
// node_modules por app://local/bundle/… y solo estos archivos se empaquetan (ver package.json).
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
