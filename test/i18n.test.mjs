import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CATALOGS,
  SUPPORTED,
  LANGUAGES,
  t,
  tHtml,
  tIn,
  setLocale,
  getLocale,
  resolveLocale,
  normalizeLocale,
  languageFromName,
  placeholders,
} from '../src/shared/i18n/index.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const BASE = CATALOGS.es;

test('los cinco idiomas están registrados', () => {
  assert.deepEqual(SUPPORTED, ['es', 'en', 'ru', 'uk', 'zh']);
  for (const code of SUPPORTED) {
    assert.ok(LANGUAGES[code]?.native, `${code} sin nombre nativo`);
    assert.ok(Object.keys(CATALOGS[code]).length > 0, `${code} vacío`);
  }
});

for (const code of SUPPORTED.filter((c) => c !== 'es')) {
  test(`${code}: tiene exactamente las mismas claves que es`, () => {
    const keys = Object.keys(CATALOGS[code]);
    const missing = Object.keys(BASE).filter((k) => !(k in CATALOGS[code]));
    const extra = keys.filter((k) => !(k in BASE));
    assert.deepEqual(missing, [], `faltan en ${code}`);
    assert.deepEqual(extra, [], `sobran en ${code}`);
  });

  test(`${code}: usa las mismas variables {x} que es`, () => {
    const wrong = [];
    for (const [key, value] of Object.entries(CATALOGS[code])) {
      const want = [...placeholders(BASE[key])].sort().join(',');
      const got = [...placeholders(value)].sort().join(',');
      if (want !== got) wrong.push(`${key}: es={${want}} ${code}={${got}}`);
    }
    assert.deepEqual(wrong, []);
  });

  test(`${code}: conserva las etiquetas HTML de es`, () => {
    const tags = (v) =>
      [...String(typeof v === 'object' ? v.other : v).matchAll(/<\/?([a-z]+)/g)]
        .map((m) => m[0])
        .sort()
        .join(' ');
    const wrong = Object.keys(BASE).filter((k) => tags(BASE[k]) !== tags(CATALOGS[code][k]));
    assert.deepEqual(wrong, []);
  });
}

test('ningún texto está vacío', () => {
  const empty = [];
  for (const code of SUPPORTED)
    for (const [k, v] of Object.entries(CATALOGS[code])) {
      const forms = typeof v === 'object' ? Object.values(v) : [v];
      if (forms.some((f) => !String(f).trim())) empty.push(`${code}:${k}`);
    }
  assert.deepEqual(empty, []);
});

test('t() traduce, interpola y cae al inglés o a la clave', () => {
  setLocale('es');
  assert.equal(getLocale(), 'es');
  assert.equal(t('menu.quit'), 'Salir');
  assert.equal(t('tray.toggle', { name: 'Noa' }), 'Mostrar/ocultar a Noa');
  assert.equal(t('clave.que.no.existe'), 'clave.que.no.existe');
  setLocale('zh');
  assert.equal(t('menu.quit'), '退出');
  setLocale('xx');
  assert.equal(getLocale(), 'en');
  assert.equal(t('menu.quit'), 'Quit');
});

test('plurales: ruso y ucraniano eligen one/few/many', () => {
  setLocale('ru');
  assert.equal(t('settings.auto.toolCount', { count: 1 }), '1 инструмент');
  assert.equal(t('settings.auto.toolCount', { count: 3 }), '3 инструмента');
  assert.equal(t('settings.auto.toolCount', { count: 5 }), '5 инструментов');
  assert.equal(t('settings.auto.toolCount', { count: 21 }), '21 инструмент');
  setLocale('uk');
  assert.equal(t('settings.auto.toolCount', { count: 2 }), '2 інструменти');
  assert.equal(t('settings.auto.toolCount', { count: 11 }), '11 інструментів');
  setLocale('es');
  assert.equal(t('settings.auto.toolCount', { count: 1 }), '1 herramienta');
  assert.equal(t('settings.auto.toolCount', { count: 4 }), '4 herramientas');
  setLocale('zh');
  assert.equal(t('settings.auto.toolCount', { count: 4 }), '4 个工具');
});

test('tHtml() escapa las variables y respeta el HTML de la traducción', () => {
  setLocale('es');
  assert.equal(tHtml('chat.hello', { name: '<b>x</b>' }), 'Hola. Soy <em>&lt;b&gt;x&lt;/b&gt;</em>.');
});

test('tIn() traduce en otro idioma sin cambiar el actual', () => {
  setLocale('en');
  assert.match(tIn('ru', 'defaults.personality'), /остроумная/);
  assert.equal(getLocale(), 'en');
});

test('resolveLocale(): preferencia, idioma del sistema y respaldo', () => {
  assert.equal(resolveLocale('ru', ['es-ES']), 'ru');
  assert.equal(resolveLocale('auto', ['uk-UA', 'en-US']), 'uk');
  assert.equal(resolveLocale('auto', ['zh-Hans-CN']), 'zh');
  assert.equal(resolveLocale('auto', ['es-419']), 'es');
  assert.equal(resolveLocale('auto', ['fr-FR', 'de-DE']), 'en');
  assert.equal(resolveLocale(undefined, []), 'en');
  assert.equal(normalizeLocale('ua'), 'uk');
  assert.equal(normalizeLocale('pt-BR'), null);
});

test('languageFromName(): reconoce nombres de idioma escritos a mano', () => {
  assert.equal(languageFromName('español'), 'es');
  assert.equal(languageFromName('English (English)'), 'en');
  assert.equal(languageFromName('Русский'), 'ru');
  assert.equal(languageFromName('українська'), 'uk');
  assert.equal(languageFromName('中文'), 'zh');
  assert.equal(languageFromName('klingon'), null);
  assert.equal(languageFromName(''), null);
});

test('todas las claves data-i18n del HTML existen', () => {
  const dir = path.join(ROOT, 'src', 'renderer');
  const missing = [];
  for (const sub of fs.readdirSync(dir)) {
    const p = path.join(dir, sub, `${sub}.html`);
    if (!fs.existsSync(p)) continue;
    const html = fs.readFileSync(p, 'utf8');
    for (const m of html.matchAll(/data-i18n(?:-[a-z-]+)?="([\w.]+)"/g)) if (!(m[1] in BASE)) missing.push(`${sub}: ${m[1]}`);
  }
  assert.deepEqual(missing, []);
});

test('todas las claves t(\'…\') del código existen', () => {
  const missing = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name !== 'locales') walk(p);
      } else if (e.name.endsWith('.js')) {
        const src = fs.readFileSync(p, 'utf8');
        for (const m of src.matchAll(/\bt(?:Html)?\(\s*'([a-z][\w]*(?:\.[\w]+)+)'/g)) if (!(m[1] in BASE)) missing.push(`${path.relative(ROOT, p)}: ${m[1]}`);
      }
    }
  };
  walk(path.join(ROOT, 'src'));
  assert.deepEqual(missing, []);
});
