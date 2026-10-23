// Puente seguro entre las páginas y el proceso principal.
const { contextBridge, ipcRenderer } = require('electron');

const ALLOWED = ['cfg:', 'chat:', 'voice:', 'skin:', 'win:', 'avatar:', 'tts:', 'models:', 'test:', 'mcp:', 'tools:', 'app:', 'persona:', 'productivity:'];
const ok = (ch) => typeof ch === 'string' && ALLOWED.some((p) => ch.startsWith(p));

contextBridge.exposeInMainWorld('wd', {
  platform: process.platform,
  invoke: (ch, ...args) => (ok(ch) ? ipcRenderer.invoke(ch, ...args) : Promise.reject(new Error(`Canal no permitido: ${ch}`))),
  send: (ch, ...args) => {
    if (ok(ch)) ipcRenderer.send(ch, ...args);
  },
  on: (ch, cb) => {
    if (!ok(ch)) return () => {};
    const h = (_e, ...a) => cb(...a);
    ipcRenderer.on(ch, h);
    return () => ipcRenderer.removeListener(ch, h);
  },
});
