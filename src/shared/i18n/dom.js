// Traduce el HTML estático de las páginas mediante atributos:
//   data-i18n="clave"              -> textContent
//   data-i18n-html="clave"         -> innerHTML (la traducción puede llevar <b>, <kbd>…)
//   data-i18n-title / -placeholder / -aria-label="clave" -> ese atributo
import { t, getLocale, localeTag } from './index.js';

const ATTRS = [
  ['i18nTitle', 'title'],
  ['i18nPlaceholder', 'placeholder'],
  ['i18nAriaLabel', 'aria-label'],
];

export function applyDom(root = document) {
  document.documentElement.lang = localeTag(getLocale());
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
  for (const [ds, attr] of ATTRS) {
    for (const el of root.querySelectorAll(`[data-${ds.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}]`)) el.setAttribute(attr, t(el.dataset[ds]));
  }
}
