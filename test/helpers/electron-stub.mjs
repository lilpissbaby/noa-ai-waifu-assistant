// Sustituto mínimo de la API de Electron para los tests unitarios.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'waifu-desk-test-'));
const state = { locales: ['es-ES', 'en-US'] };

export const __test = {
  userData,
  setSystemLocales: (list) => (state.locales = list),
  notifications: [],
  clipboard: '',
  dialogResponses: [],
  dialogs: [],
};

export const app = {
  getPath: (name) => (name === 'userData' ? userData : os.tmpdir()),
  getLocale: () => state.locales[0] || 'en-US',
  getPreferredSystemLanguages: () => state.locales,
  getVersion: () => '0.0.0-test',
};

export const safeStorage = {
  isEncryptionAvailable: () => false,
  encryptString: (s) => Buffer.from(s, 'utf8'),
  decryptString: (b) => Buffer.from(b).toString('utf8'),
};

// net.fetch de Electron se comporta como fetch estándar.
export const net = { fetch: (...args) => globalThis.fetch(...args) };

export const shell = { openExternal: async () => {}, openPath: async () => '' };

// Como en Electron 44: el portapapeles del proceso principal es asíncrono.
export const clipboard = {
  readText: async () => __test.clipboard,
  writeText: async (s) => {
    __test.clipboard = s;
  },
};

export class Notification {
  constructor(opts) {
    this.opts = opts;
  }
  show() {
    __test.notifications.push(this.opts);
  }
}

export const dialog = {
  showMessageBox: async (...args) => {
    const opts = args.length > 1 ? args[1] : args[0];
    __test.dialogs.push(opts);
    return { response: __test.dialogResponses.length ? __test.dialogResponses.shift() : 0 };
  },
};

export default { app, safeStorage, net, shell, clipboard, Notification, dialog };
