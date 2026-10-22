// Se carga con `node --import ./test/setup.mjs --test`: hace que `import … from 'electron'`
// resuelva a un stub, para poder probar el proceso principal sin arrancar Electron.
import { register } from 'node:module';

register('./helpers/electron-loader.mjs', import.meta.url);
