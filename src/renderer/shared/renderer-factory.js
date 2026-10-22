// Elige el renderizador según el tipo de skin. El 3D se importa solo cuando hace falta, para que
// quien usa skins 2D no cargue three.js.
import { SkinRenderer } from './skin-renderer.js';

export const kindOf = (skin) => (skin?.type === 'vrm' ? 'vrm' : '2d');

export async function createRenderer(canvas, kind) {
  if (kind === 'vrm') {
    const { VrmRenderer } = await import('./vrm/vrm-renderer.js');
    return new VrmRenderer(canvas);
  }
  return new SkinRenderer(canvas);
}

// ensure(kind) -> renderizador de ese tipo (nuevo o el actual). Si la skin no carga se avisa con
// onError(e) y se carga la de respaldo; si tampoco carga, el error se propaga.
export async function loadSkinWithFallback({ skin, fallback, ensure, onError }) {
  try {
    const renderer = await ensure(kindOf(skin));
    return { renderer, skin: await renderer.load(skin), failed: false };
  } catch (e) {
    onError?.(e);
    const renderer = await ensure(kindOf(fallback));
    return { renderer, skin: await renderer.load(fallback), failed: true };
  }
}
