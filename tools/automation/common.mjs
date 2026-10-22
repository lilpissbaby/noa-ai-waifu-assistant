// Utilidades compartidas por los scripts de automatización (se ejecutan dentro del proceso principal).
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Espera a que una ventana termine de cargar y a que `ready` (JS evaluado en la página) sea verdadero.
export async function waitForWindow(win, ready = 'document.readyState === "complete"', timeoutMs = 15000) {
  const wc = win.webContents;
  if (wc.isLoading()) await new Promise((r) => wc.once('did-finish-load', r));
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      if (await wc.executeJavaScript(`Boolean(${ready})`)) return;
    } catch {
      /* la página aún no está lista */
    }
    await sleep(100);
  }
  throw new Error(`timeout esperando: ${ready}`);
}

// Espera a que el chat emita un evento que cumpla `pred`.
export function waitForChat(api, pred, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout esperando al chat')), timeoutMs);
    api.onChatEvent((e) => {
      if (pred(e)) {
        clearTimeout(timer);
        resolve(e);
      }
    });
  });
}

// Cambia el idioma igual que el selector de Ajustes.
export async function setLanguage(api, code) {
  api.patchConfig({ ui: { language: code } });
  api.applyUiConfig();
  api.broadcast('cfg:changed', api.publicConfig());
  await sleep(250);
}
