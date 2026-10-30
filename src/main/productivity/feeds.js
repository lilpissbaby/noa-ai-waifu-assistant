// Noticias: fuentes RSS 2.0, RSS 1.0 (RDF) y Atom. Se leen al pedirlas (no hay sondeo).
import { net } from 'electron';
import { DOMParser } from 'linkedom';

const MAX_BYTES = 3 * 1024 * 1024;

const text = (el) => (el?.textContent || '').trim();
const firstOf = (node, names) => {
  for (const n of names) {
    const el = node.getElementsByTagName(n)[0];
    if (el) return el;
  }
  return null;
};

// Quita etiquetas y entidades sencillas de los resúmenes en HTML.
export function stripHtml(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function toIso(s) {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function parseFeed(xml) {
  const doc = new DOMParser().parseFromString(String(xml), 'text/xml');
  const root = doc.documentElement;
  if (!root) throw new Error('Not an RSS or Atom feed.');
  const tag = root.tagName.toLowerCase().replace(/^.*:/, '');
  const items = [];
  if (tag === 'feed') {
    for (const e of [...root.getElementsByTagName('entry')]) {
      const links = [...e.getElementsByTagName('link')];
      const link = (links.find((l) => !l.getAttribute('rel') || l.getAttribute('rel') === 'alternate') || links[0])?.getAttribute('href') || '';
      items.push({
        title: stripHtml(text(firstOf(e, ['title']))),
        link,
        date: toIso(text(firstOf(e, ['published', 'updated']))),
        summary: stripHtml(text(firstOf(e, ['summary', 'content']))).slice(0, 400),
      });
    }
    return { title: stripHtml(text(firstOf(root, ['title']))), items };
  }
  if (tag === 'rss' || tag === 'rdf') {
    const channel = firstOf(root, ['channel']);
    for (const e of [...root.getElementsByTagName('item')]) {
      items.push({
        title: stripHtml(text(firstOf(e, ['title']))),
        link: text(firstOf(e, ['link'])) || firstOf(e, ['guid'])?.textContent?.trim() || '',
        date: toIso(text(firstOf(e, ['pubDate', 'dc:date', 'date']))),
        summary: stripHtml(text(firstOf(e, ['description', 'content:encoded', 'summary']))).slice(0, 400),
      });
    }
    return { title: stripHtml(text(firstOf(channel || root, ['title']))), items };
  }
  throw new Error('Not an RSS or Atom feed.');
}

export async function fetchFeed(url, { fetchImpl = net.fetch, timeoutMs = 15000 } = {}) {
  if (!/^https?:\/\//i.test(String(url))) throw new Error('Feeds must be http(s) URLs.');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { headers: { accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5', 'user-agent': 'Mozilla/5.0 WaifuDesk' }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.text();
    if (body.length > MAX_BYTES) throw new Error('Feed too large.');
    return parseFeed(body);
  } finally {
    clearTimeout(timer);
  }
}

// Últimas noticias de varias fuentes, mezcladas por fecha.
export async function latestNews(feeds, { limit = 10, query = '', fetchImpl } = {}) {
  const q = String(query || '').toLowerCase();
  const results = await Promise.all(
    feeds.map(async (f) => {
      try {
        const feed = await fetchFeed(f.url, fetchImpl ? { fetchImpl } : {});
        return { feed: f.name || feed.title, items: feed.items.map((i) => ({ ...i, source: f.name || feed.title })) };
      } catch (e) {
        return { feed: f.name || f.url, error: e.message, items: [] };
      }
    }),
  );
  const all = results
    .flatMap((r) => r.items)
    .filter((i) => !q || `${i.title} ${i.summary}`.toLowerCase().includes(q))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const errors = results.filter((r) => r.error).map((r) => `${r.feed}: ${r.error}`);
  return { items: all.slice(0, Math.max(1, Math.min(50, Number(limit) || 10))), ...(errors.length ? { errors } : {}) };
}
