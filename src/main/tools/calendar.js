// Herramienta de agenda: eventos de los calendarios configurados (Ajustes → Productividad).
import { eventsBetween, fetchCalendars } from '../productivity/calendar.js';
import { getLocale, localeTag } from '../../shared/i18n/index.js';

const DAY = 86400000;

function parseDay(s, fallback) {
  if (!s) return fallback;
  const str = String(s).trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(str) ? new Date(`${str}T00:00`) : new Date(str);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date "${str}". Use YYYY-MM-DD or a local ISO date-time.`);
  return d;
}

export function calendarTools(cfg, services = {}) {
  const calendars = cfg.productivity?.calendars || [];
  if (!calendars.length) return [];
  const now = () => (services.now ? services.now() : new Date());
  return [
    {
      name: 'calendar_events',
      group: "check the user's calendar",
      description:
        "Lists events from the user's calendars. Without arguments: today. from/to are local dates (YYYY-MM-DD, to is exclusive) or date-times; up to 92 days. query filters by text in title, place or description.",
      schema: {
        type: 'object',
        properties: { from: { type: 'string' }, to: { type: 'string' }, query: { type: 'string' } },
      },
      run: async ({ from, to, query } = {}) => {
        const n = now();
        const start = parseDay(from, new Date(n.getFullYear(), n.getMonth(), n.getDate()));
        let end = parseDay(to, new Date(start.getTime() + DAY));
        if (end <= start) end = new Date(start.getTime() + DAY);
        if (end - start > 92 * DAY) end = new Date(start.getTime() + 92 * DAY);
        const texts = await fetchCalendars(calendars, { now: n });
        const tag = localeTag(getLocale());
        const fmt = (e) =>
          e.allDay
            ? e.start.toLocaleDateString(tag, { weekday: 'long', day: 'numeric', month: 'long' })
            : `${e.start.toLocaleString(tag, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}–${e.end.toLocaleTimeString(tag, { hour: 'numeric', minute: '2-digit' })}`;
        return {
          range: { from: start.toISOString(), to: end.toISOString() },
          events: eventsBetween(texts, start, end, query).map((e) => ({ title: e.title, when: fmt(e), allDay: e.allDay, location: e.location || undefined, calendar: e.calendar })),
          ...(texts.some((c) => c.error) ? { errors: texts.filter((c) => c.error).map((c) => `${c.name}: ${c.error}`) } : {}),
        };
      },
    },
  ];
}
