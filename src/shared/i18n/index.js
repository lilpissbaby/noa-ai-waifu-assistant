// Traducciones de la interfaz. Se usa igual desde el proceso principal (Node) y desde las
// páginas (se sirven por app://local/bundle/src/shared/…), así que no depende de Electron.
import es from './locales/es.js';
import en from './locales/en.js';
import ru from './locales/ru.js';
import uk from './locales/uk.js';
import zh from './locales/zh.js';

export const SUPPORTED = ['es', 'en', 'ru', 'uk', 'zh'];
export const FALLBACK = 'en';

// Nombre de cada idioma en su propia lengua (selector) y en inglés (prompt del modelo).
export const LANGUAGES = {
  es: { native: 'Español', english: 'Spanish', tag: 'es-ES' },
  en: { native: 'English', english: 'English', tag: 'en-US' },
  ru: { native: 'Русский', english: 'Russian', tag: 'ru-RU' },
  uk: { native: 'Українська', english: 'Ukrainian', tag: 'uk-UA' },
  zh: { native: '中文（简体）', english: 'Simplified Chinese', tag: 'zh-CN' },
};

// Nombres con los que se puede escribir un idioma en «Idioma de respuesta» -> código.
const LANGUAGE_ALIASES = {
  es: ['español', 'espanol', 'castellano', 'spanish', 'испанский', 'іспанська', '西班牙语'],
  en: ['english', 'inglés', 'ingles', 'английский', 'англійська', '英语', '英文'],
  ru: ['русский', 'russian', 'ruso', 'російська', '俄语'],
  uk: ['українська', 'ukrainian', 'ucraniano', 'украинский', '乌克兰语'],
  zh: ['中文', '汉语', '简体中文', 'chinese', 'chino', 'китайский', 'китайська'],
};

/** «español», «English (English)», «ru»… -> código soportado, o null si no se reconoce. */
export function languageFromName(name) {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return null;
  const direct = normalizeLocale(n);
  if (direct) return direct;
  for (const [code, names] of Object.entries(LANGUAGE_ALIASES)) if (names.some((x) => n.startsWith(x))) return code;
  return null;
}

const PLURAL_KEYS = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);
const isPlural = (v) => v && typeof v === 'object' && 'other' in v && Object.keys(v).every((k) => PLURAL_KEYS.has(k));

// { a: { b: 'x' } } -> { 'a.b': 'x' }. Los objetos de plural ({ one, few, many, other }) se dejan tal cual.
export function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !isPlural(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

export const CATALOGS = { es: flatten(es), en: flatten(en), ru: flatten(ru), uk: flatten(uk), zh: flatten(zh) };

let current = FALLBACK;
const listeners = new Set();

// «es-ES», «es_419», «zh-Hans-CN», «ua»… -> código soportado, o null.
export function normalizeLocale(code) {
  if (!code) return null;
  const c = String(code).toLowerCase().replace('_', '-');
  if (SUPPORTED.includes(c)) return c;
  const base = c.split('-')[0];
  if (base === 'ua') return 'uk';
  return SUPPORTED.includes(base) ? base : null;
}

// Preferencia del usuario («auto» o un código) + idiomas del sistema por orden -> idioma de la interfaz.
export function resolveLocale(pref, systemLocales = []) {
  const chosen = pref && pref !== 'auto' ? normalizeLocale(pref) : null;
  if (chosen) return chosen;
  for (const s of [].concat(systemLocales || [])) {
    const n = normalizeLocale(s);
    if (n) return n;
  }
  return FALLBACK;
}

export function setLocale(code) {
  const next = normalizeLocale(code) || FALLBACK;
  if (next === current) return current;
  current = next;
  for (const fn of listeners) fn(current);
  return current;
}

export const getLocale = () => current;
export const localeTag = (code = current) => LANGUAGES[code]?.tag || 'en-US';
export const onLocaleChange = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const pluralRules = {};
function pluralForm(value, count, locale) {
  const rules = (pluralRules[locale] ||= new Intl.PluralRules(localeTag(locale)));
  const form = rules.select(Number(count) || 0);
  return value[form] ?? value.other;
}

function lookup(key, locale) {
  for (const l of [locale, FALLBACK, 'es']) {
    const v = CATALOGS[l]?.[key];
    if (v != null) return { value: v, locale: l };
  }
  return null;
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

function format(locale, key, vars, escapeVars) {
  const hit = lookup(key, locale);
  if (!hit) return key;
  let s = isPlural(hit.value) ? pluralForm(hit.value, vars?.count, hit.locale) : hit.value;
  if (vars) {
    s = s.replace(/\{(\w+)\}/g, (m, name) => {
      if (!(name in vars)) return m;
      const v = name === 'count' && typeof vars.count === 'number' ? vars.count.toLocaleString(localeTag(locale)) : vars[name];
      return escapeVars ? escapeHtml(v) : String(v ?? '');
    });
  }
  return s;
}

/** Texto traducido. `{nombre}` se sustituye por vars.nombre; si existe vars.count se elige el plural. */
export const t = (key, vars) => format(current, key, vars, false);
/** Igual que t(), pero escapa las variables: para traducciones que llevan HTML (<b>, <code>…). */
export const tHtml = (key, vars) => format(current, key, vars, true);
/** t() en un idioma concreto, sin cambiar el de la interfaz. */
export const tIn = (locale, key, vars) => format(normalizeLocale(locale) || FALLBACK, key, vars, false);

// Placeholders {x} de una cadena o de todas las formas de un plural.
export function placeholders(value) {
  const forms = isPlural(value) ? Object.values(value) : [value];
  const out = new Set();
  for (const f of forms) for (const m of String(f).matchAll(/\{(\w+)\}/g)) out.add(m[1]);
  return out;
}
