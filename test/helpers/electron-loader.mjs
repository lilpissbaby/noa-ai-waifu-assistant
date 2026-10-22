// Hook de resolución de módulos: 'electron' -> stub de pruebas.
const STUB = new URL('./electron-stub.mjs', import.meta.url).href;

export async function resolve(specifier, context, next) {
  if (specifier === 'electron') return { url: STUB, shortCircuit: true };
  return next(specifier, context);
}
