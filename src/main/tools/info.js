// Herramientas de información: el tiempo, noticias (RSS), estado del PC, historial del
// portapapeles y el monitor de servicios.
import { geocode, forecast, summarize } from '../productivity/weather.js';
import { latestNews } from '../productivity/feeds.js';
import { systemStatus } from '../productivity/system.js';
import { languageFromName, getLocale } from '../../shared/i18n/index.js';

export function weatherTools(cfg, services = {}) {
  const w = cfg.productivity?.weather || {};
  const fetchImpl = services.fetchImpl;
  return [
    {
      name: 'weather',
      group: 'weather forecast',
      description:
        "Current weather and forecast (up to 7 days) from Open-Meteo. Without location it uses the user's city from settings" +
        (w.label ? ` (${w.label})` : ' (not set yet: ask for a city)') +
        '. location: a city name, optionally with country ("Valencia, ES").',
      schema: { type: 'object', properties: { location: { type: 'string' }, days: { type: 'number', description: '1-7, default 3' } } },
      run: async ({ location, days } = {}) => {
        let place = w.lat != null && w.lon != null ? { label: w.label, lat: w.lat, lon: w.lon } : null;
        if (location) {
          place = await geocode(location, { language: languageFromName(cfg.assistant?.language) || getLocale(), ...(fetchImpl ? { fetchImpl } : {}) });
          if (!place) throw new Error(`Place not found: ${location}`);
        }
        if (!place) throw new Error('No city configured. Ask the user for one, or pass location.');
        const raw = await forecast(place, { days, units: w.units, ...(fetchImpl ? { fetchImpl } : {}) });
        return summarize(raw, place.label);
      },
    },
  ];
}

export function newsTools(cfg, services = {}) {
  const feeds = cfg.productivity?.feeds || [];
  if (!feeds.length) return [];
  return [
    {
      name: 'news_read',
      group: 'news from RSS feeds',
      description: `Latest headlines from the user's RSS/Atom feeds (${feeds
        .map((f) => f.name)
        .slice(0, 12)
        .join(', ')}). Optional feed (one of those names), query (text filter) and limit (default 10). Read a full article with web_fetch if the user wants details.`,
      schema: { type: 'object', properties: { feed: { type: 'string' }, query: { type: 'string' }, limit: { type: 'number' } } },
      run: async ({ feed, query, limit } = {}) => {
        let list = feeds;
        if (feed) {
          const f = String(feed).toLowerCase();
          list = feeds.filter((x) => x.name.toLowerCase().includes(f));
          if (!list.length) throw new Error(`No feed called "${feed}". Feeds: ${feeds.map((x) => x.name).join(', ')}`);
        }
        return latestNews(list, { limit, query, ...(services.fetchImpl ? { fetchImpl: services.fetchImpl } : {}) });
      },
    },
  ];
}

export function systemTools(services = {}) {
  return [
    {
      name: 'system_status',
      group: "check this computer's status",
      description: 'Status of this computer: CPU usage, memory, disks (free space), network addresses, uptime and power. processes=true also lists the processes using the most CPU or memory.',
      schema: { type: 'object', properties: { processes: { type: 'boolean' } } },
      run: async ({ processes = false } = {}) => systemStatus({ processes, onBattery: services.onBattery?.() ?? null }),
    },
  ];
}

export function clipboardHistoryTools(cfg, services = {}) {
  if (!cfg.productivity?.clipboardHistory?.enabled || !services.clipHistory) return [];
  return [
    {
      name: 'clipboard_history',
      group: 'clipboard history',
      description: 'Texts the user copied recently in this session (newest first). Optional query (text filter) and limit (default 10). Use it for "what did I copy before?" or to recover something they copied.',
      schema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } } },
      run: async ({ query, limit = 10 } = {}) => services.clipHistory.list({ query, limit }).map((x) => ({ at: x.at, text: x.text.length > 2000 ? `${x.text.slice(0, 2000)}…` : x.text })),
    },
  ];
}

export function monitorTools(cfg, services = {}) {
  const m = cfg.productivity?.monitors;
  if (!m?.list?.length || !services.monitors) return [];
  const view = (x) => ({ name: x.name, url: x.url, up: x.up, since: x.since, lastCheck: x.lastCheck, status: x.status || undefined, ms: x.ms, error: x.error || undefined });
  return [
    {
      name: 'monitor_status',
      group: 'service monitor',
      description: `State of the websites and services the user monitors (${m.list
        .map((x) => x.name)
        .slice(0, 12)
        .join(', ')}): up or down, since when, response time. check=true checks them all again now.`,
      schema: { type: 'object', properties: { check: { type: 'boolean' } } },
      run: async ({ check = false } = {}) => (check ? (await services.monitors.runOnce()).map(view) : services.monitors.states().map(view)),
    },
  ];
}
