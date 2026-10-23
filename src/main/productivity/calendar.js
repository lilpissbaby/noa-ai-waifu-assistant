// Agenda: calendarios .ics (archivo local o URL http/https/webcal, p. ej. el enlace privado de
// Google Calendar u Outlook). ical.js expande las repeticiones; las zonas horarias se resuelven con
// los VTIMEZONE del archivo o, si no los trae (Outlook), con Intl y una tabla de nombres de Windows.
import { net } from 'electron';
import fs from 'node:fs';
import ICAL from 'ical.js';

// Nombres de zona de Windows (Outlook / Exchange) → IANA.
export const WINDOWS_TZ = {
  UTC: 'Etc/UTC',
  'Coordinated Universal Time': 'Etc/UTC',
  'GMT Standard Time': 'Europe/London',
  'Greenwich Standard Time': 'Atlantic/Reykjavik',
  'W. Europe Standard Time': 'Europe/Berlin',
  'Central Europe Standard Time': 'Europe/Budapest',
  'Central European Standard Time': 'Europe/Warsaw',
  'Romance Standard Time': 'Europe/Paris',
  'E. Europe Standard Time': 'Europe/Chisinau',
  'FLE Standard Time': 'Europe/Kiev',
  'GTB Standard Time': 'Europe/Bucharest',
  'Kaliningrad Standard Time': 'Europe/Kaliningrad',
  'Russian Standard Time': 'Europe/Moscow',
  'Belarus Standard Time': 'Europe/Minsk',
  'Turkey Standard Time': 'Europe/Istanbul',
  'Russia Time Zone 3': 'Europe/Samara',
  'Morocco Standard Time': 'Africa/Casablanca',
  'W. Central Africa Standard Time': 'Africa/Lagos',
  'South Africa Standard Time': 'Africa/Johannesburg',
  'Egypt Standard Time': 'Africa/Cairo',
  'Israel Standard Time': 'Asia/Jerusalem',
  'Arabian Standard Time': 'Asia/Dubai',
  'India Standard Time': 'Asia/Calcutta',
  'China Standard Time': 'Asia/Shanghai',
  'Singapore Standard Time': 'Asia/Singapore',
  'Tokyo Standard Time': 'Asia/Tokyo',
  'Korea Standard Time': 'Asia/Seoul',
  'AUS Eastern Standard Time': 'Australia/Sydney',
  'Eastern Standard Time': 'America/New_York',
  'Central Standard Time': 'America/Chicago',
  'Mountain Standard Time': 'America/Denver',
  'US Mountain Standard Time': 'America/Phoenix',
  'Pacific Standard Time': 'America/Los_Angeles',
  'Alaskan Standard Time': 'America/Anchorage',
  'Hawaiian Standard Time': 'Pacific/Honolulu',
  'Atlantic Standard Time': 'America/Halifax',
  'Newfoundland Standard Time': 'America/St_Johns',
  'Canada Central Standard Time': 'America/Regina',
  'Central America Standard Time': 'America/Guatemala',
  'Central Standard Time (Mexico)': 'America/Mexico_City',
  'Mountain Standard Time (Mexico)': 'America/Mazatlan',
  'Pacific Standard Time (Mexico)': 'America/Tijuana',
  'Eastern Standard Time (Mexico)': 'America/Cancun',
  'Cuba Standard Time': 'America/Havana',
  'SA Pacific Standard Time': 'America/Bogota',
  'SA Western Standard Time': 'America/La_Paz',
  'SA Eastern Standard Time': 'America/Cayenne',
  'Venezuela Standard Time': 'America/Caracas',
  'E. South America Standard Time': 'America/Sao_Paulo',
  'Argentina Standard Time': 'America/Buenos_Aires',
  'Pacific SA Standard Time': 'America/Santiago',
  'Paraguay Standard Time': 'America/Asuncion',
  'Montevideo Standard Time': 'America/Montevideo',
};

const validZone = (tz) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

// TZID → zona IANA (o null = hora local del equipo).
export function ianaZone(tzid) {
  if (!tzid) return null;
  const clean = String(tzid).replace(/^"|"$/g, '').trim();
  if (WINDOWS_TZ[clean]) return WINDOWS_TZ[clean];
  if (validZone(clean)) return clean;
  const tail = clean.match(/[A-Za-z]+\/[A-Za-z_+-]+(?:\/[A-Za-z_+-]+)?$/)?.[0]; // «/mozilla.org/…/Europe/Madrid»
  return tail && validZone(tail) ? tail : null;
}

function offsetMs(utcMs, tz) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
      .formatToParts(new Date(utcMs))
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, Number(p.value)]),
  );
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - utcMs;
}

// Hora de pared [año, mes(1-12), día, h, min, s] en la zona tz → instante.
export function zonedToDate([y, mo, d, h = 0, mi = 0, s = 0], tz) {
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  let t = wall - offsetMs(wall, tz);
  t = wall - offsetMs(t, tz);
  return new Date(t);
}

function toDate(time, tzid) {
  if (time.isDate) return new Date(time.year, time.month - 1, time.day);
  const tzName = time.zone?.tzid;
  if (tzName === 'UTC' || (tzName && tzName !== 'floating')) return time.toJSDate();
  const zone = ianaZone(tzid);
  const wall = [time.year, time.month, time.day, time.hour, time.minute, time.second];
  return zone ? zonedToDate(wall, zone) : new Date(wall[0], wall[1] - 1, wall[2], wall[3], wall[4], wall[5]);
}

const MAX_OCCURRENCES = 2000;

export function eventsBetween(icsTexts, from, to, query) {
  const q = String(query || '').trim().toLowerCase();
  const out = [];
  for (const cal of icsTexts) {
    if (!cal?.text) continue;
    let root;
    try {
      root = new ICAL.Component(ICAL.parse(cal.text));
    } catch {
      continue;
    }
    for (const vtz of root.getAllSubcomponents('vtimezone')) {
      try {
        ICAL.TimezoneService.register(vtz);
      } catch {
        /* zona mal formada: se resolverá por nombre */
      }
    }
    const vevents = root.getAllSubcomponents('vevent');
    // Las excepciones (RECURRENCE-ID) se aplican a su evento repetitivo.
    const masters = new Map();
    for (const ve of vevents) if (!ve.hasProperty('recurrence-id')) masters.set(ve.getFirstPropertyValue('uid'), new ICAL.Event(ve));
    for (const ve of vevents) if (ve.hasProperty('recurrence-id')) masters.get(ve.getFirstPropertyValue('uid'))?.relateException(ve);

    for (const ev of masters.values()) {
      const text = [ev.summary, ev.location, ev.description].filter(Boolean).join(' ').toLowerCase();
      if (q && !text.includes(q)) continue;
      const tzid = ev.startDate?.timezone || ev.component.getFirstProperty('dtstart')?.getParameter('tzid');
      const push = (start, end, title = ev.summary, location = ev.location) => {
        const s = toDate(start, tzid);
        const e = end ? toDate(end, tzid) : new Date(s.getTime() + (start.isDate ? 86400000 : 0));
        if (e > from && s < to) out.push({ title: title || '(sin título)', start: s, end: e, allDay: !!start.isDate, location: location || '', calendar: cal.name });
      };
      if (!ev.startDate) continue;
      if (!ev.isRecurring()) {
        push(ev.startDate, ev.endDate);
        continue;
      }
      const it = ev.iterator();
      for (let i = 0, next = it.next(); next && i < MAX_OCCURRENCES; i++, next = it.next()) {
        const det = ev.getOccurrenceDetails(next);
        const s = toDate(det.startDate, tzid);
        if (s >= to) break;
        push(det.startDate, det.endDate, det.item.summary, det.item.location);
      }
    }
  }
  return out.sort((a, b) => a.start - b.start || Number(b.allDay) - Number(a.allDay));
}

// Descarga o lee cada calendario (las URL se guardan 15 min en memoria).
const CACHE_MS = 15 * 60000;
const cache = new Map();
export async function fetchCalendars(calendars, { now = new Date() } = {}) {
  const out = [];
  for (const c of calendars || []) {
    const name = c.name || c.url || c.file || 'calendar';
    try {
      if (c.file) {
        out.push({ name, text: fs.readFileSync(c.file, 'utf8') });
        continue;
      }
      const url = String(c.url || '').replace(/^webcal:/i, 'https:');
      if (!/^https?:\/\//i.test(url)) throw new Error('The calendar URL must be http(s) or webcal');
      const hit = cache.get(url);
      if (hit && now - hit.at < CACHE_MS) {
        out.push({ name, text: hit.text });
        continue;
      }
      const res = await net.fetch(url, { headers: { accept: 'text/calendar, */*' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (text.length > 20 * 1024 * 1024) throw new Error('Calendar too large');
      cache.set(url, { at: now.getTime(), text });
      out.push({ name, text });
    } catch (e) {
      out.push({ name, text: '', error: e.message });
    }
  }
  return out;
}
