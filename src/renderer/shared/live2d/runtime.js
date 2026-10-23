// Carga, una sola vez y en orden, los scripts de Live2D: pixi.js (UMD), su parche sin eval, el
// Cubism Core del usuario y el motor. Expone { PIXI, live2d } de las variables globales.
import { LIVE2D_SCRIPTS } from '../../../shared/vendor.js';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    document.head.append(s);
  });
}

let ready = null;
export function loadLive2dRuntime(coreUrl) {
  ready ||= (async () => {
    const [pixi, unsafeEval, engine] = LIVE2D_SCRIPTS;
    await loadScript(pixi);
    await loadScript(unsafeEval);
    if (!globalThis.Live2DCubismCore) await loadScript(coreUrl);
    await loadScript(engine);
    const PIXI = globalThis.PIXI;
    if (!PIXI?.live2d?.Live2DModel) throw new Error('Live2D engine not available');
    // pixi decodifica imágenes en workers creados desde blob:, que la CSP no permite: en el hilo principal.
    if (PIXI.loadTextures?.config) PIXI.loadTextures.config.preferWorkers = false;
    return { PIXI, live2d: PIXI.live2d };
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}
