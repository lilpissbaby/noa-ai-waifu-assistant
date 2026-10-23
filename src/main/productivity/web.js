// Web: leer una página (solo el contenido principal, con Readability sobre linkedom) y buscar con
// el buscador que elija el usuario (SearXNG propio, Brave Search API o Tavily).
import { net } from 'electron';
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import { extractPdfText } from './docs.js';

const fail = (code, message) => Object.assign(new Error(message), { code });
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 WaifuDesk';
const BLOCKS = 'p,div,section,article,header,footer,h1,h2,h3,h4,h5,h6,li,tr,pre,blockquote,figcaption,table,ul,ol,dl,dt,dd';

export function checkHttpUrl(url) {
  let u;
  try {
    u = new URL(String(url).trim());
  } catch {
    throw fail('badUrl', 'Only http(s) URLs can be read');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw fail('badUrl', 'Only http(s) URLs can be read');
  return u;
}

// Direcciones de la red local o del propio equipo (para pedir permiso antes de leerlas).
export function isPrivateHost(hostname) {
  const h = String(hostname).toLowerCase().replace(/^\[|\]$/g, '');
  if (h.includes(':')) {
    // IPv4 dentro de IPv6 (::ffff:a.b.c.d o ::a.b.c.d, que la URL escribe en hexadecimal): se mira la IPv4.
    const mapped = /^::(?:ffff:)?(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/.exec(h);
    if (mapped) {
      const v4 = mapped[1] || [parseInt(mapped[2], 16) >> 8, parseInt(mapped[2], 16) & 255, parseInt(mapped[3], 16) >> 8, parseInt(mapped[3], 16) & 255].join('.');
      return isPrivateHost(v4);
    }
    return h === '::1' || h === '::' || /^fe[89ab]/.test(h) || /^f[cd]/.test(h);
  }
  const v4 = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  return h === 'localhost' || !h.includes('.') || /\.(localhost|local|lan|internal|home|intranet)$/.test(h);
}

async function readBody(res, maxBytes) {
  const declared = Number(res.headers.get('content-length'));
  if (declared > maxBytes) throw fail('tooBig', `The page is larger than ${Math.round(maxBytes / 1048576)} MB`);
  const chunks = [];
  let size = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      reader.cancel().catch(() => {});
      throw fail('tooBig', `The page is larger than ${Math.round(maxBytes / 1048576)} MB`);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

function decode(buf, ctype) {
  let charset = /charset=["']?([\w-]+)/i.exec(ctype)?.[1];
  if (!charset) charset = /<meta[^>]+charset=["']?([\w-]+)/i.exec(buf.subarray(0, 4096).toString('latin1'))?.[1];
  try {
    return new TextDecoder(charset || 'utf-8').decode(buf);
  } catch {
    return new TextDecoder('utf-8').decode(buf);
  }
}

// HTML → texto con un salto de línea por bloque.
function htmlToText(html) {
  const { document } = parseHTML(`<!doctype html><html><body><div id="root">${html}</div></body></html>`);
  const root = document.getElementById('root');
  for (const el of root.querySelectorAll('script,style,noscript,template')) el.remove();
  for (const el of root.querySelectorAll('br')) el.replaceWith(document.createTextNode('\n'));
  for (const el of root.querySelectorAll(BLOCKS)) el.append(document.createTextNode('\n'));
  return tidy(root.textContent);
}

const tidy = (s) =>
  String(s)
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export async function fetchReadable(url, { maxBytes = 10 * 1024 * 1024, maxChars = 20000 } = {}) {
  const u = checkHttpUrl(url);
  const res = await net.fetch(u.href, { headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,application/pdf,text/plain;q=0.9,*/*;q=0.5' } });
  if (!res.ok) throw fail('http', `HTTP ${res.status} reading ${u.href}`);
  const buf = await readBody(res, maxBytes);
  const ctype = (res.headers.get('content-type') || '').toLowerCase();
  const finalUrl = res.url || u.href;
  let title = '';
  let text;
  if (ctype.includes('application/pdf') || buf.subarray(0, 5).toString('latin1') === '%PDF-') {
    text = await extractPdfText(buf);
    title = decodeURIComponent(new URL(finalUrl).pathname.split('/').pop() || '');
  } else if (ctype.includes('html') || ctype.includes('xml') || (!ctype && /^\s*</.test(buf.subarray(0, 200).toString('latin1')))) {
    const html = decode(buf, ctype);
    const { document } = parseHTML(html);
    title = (document.title || '').trim();
    let article = null;
    try {
      article = new Readability(document, { charThreshold: 200 }).parse();
    } catch {
      /* página rara: se usa el cuerpo */
    }
    if (article?.content) {
      text = htmlToText(article.content);
      title = article.title?.trim() || title;
    } else {
      const { document: doc2 } = parseHTML(html);
      for (const el of doc2.querySelectorAll('script,style,noscript,nav,header,footer,aside,form')) el.remove();
      text = htmlToText(doc2.body?.innerHTML || '');
    }
  } else if (ctype.startsWith('text/') || ctype.includes('json') || !ctype) {
    text = tidy(decode(buf, ctype));
  } else throw fail('unsupported', `Cannot read content of type ${ctype}`);
  const truncated = text.length > maxChars;
  return { url: finalUrl, title, text: truncated ? text.slice(0, maxChars) : text, truncated };
}

const stripTags = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

export const SEARCH_DEFAULTS = { brave: 'https://api.search.brave.com/res/v1/web', tavily: 'https://api.tavily.com' };

export async function searchWeb(search, key, query, count = 5) {
  const n = Math.max(1, Math.min(10, Number(count) || 5));
  const provider = search?.provider || 'none';
  const base = (search?.baseUrl?.trim() || SEARCH_DEFAULTS[provider] || '').replace(/\/+$/, '');
  if (provider === 'none' || !base) throw new Error('No web search provider is configured (Settings → Productivity → Web).');
  const q = String(query || '').trim();
  if (!q) throw new Error('Empty query');
  let res;
  if (provider === 'searxng') {
    res = await net.fetch(`${base}/search?${new URLSearchParams({ q, format: 'json' })}`, { headers: { accept: 'application/json', 'user-agent': UA } });
  } else if (provider === 'brave') {
    res = await net.fetch(`${base}/search?${new URLSearchParams({ q, count: String(n) })}`, { headers: { accept: 'application/json', 'X-Subscription-Token': key || '' } });
  } else if (provider === 'tavily') {
    res = await net.fetch(`${base}/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key || ''}` },
      body: JSON.stringify({ api_key: key || '', query: q, max_results: n }),
    });
  } else throw new Error(`Unknown search provider: ${provider}`);
  if (!res.ok) throw new Error(`${provider}: HTTP ${res.status}`);
  const data = await res.json();
  const raw = provider === 'brave' ? data.web?.results : data.results;
  return (raw || []).slice(0, n).map((r) => ({ title: stripTags(r.title), url: r.url, snippet: stripTags(r.content ?? r.description ?? r.snippet ?? '') }));
}
