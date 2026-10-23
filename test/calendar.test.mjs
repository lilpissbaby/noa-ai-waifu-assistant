process.env.TZ = 'Europe/Madrid';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { eventsBetween, fetchCalendars, WINDOWS_TZ, zonedToDate } from '../src/main/productivity/calendar.js';
import { briefingDue } from '../src/main/productivity/briefing.js';
import { calendarTools } from '../src/main/tools/calendar.js';
import { serve } from './helpers/http.mjs';

const fx = (name) => ({ name, text: fs.readFileSync(new URL(`./fixtures/calendar/${name}.ics`, import.meta.url), 'utf8') });
const local = (y, m, d, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi);

test('evento semanal con RRULE y EXDATE: ocurrencias de dos semanas', () => {
  const ev = eventsBetween([fx('personal')], local(2026, 10, 26), local(2026, 11, 9), 'daily');
  assert.deepEqual(
    ev.map((e) => [e.start.getDate(), e.start.getHours(), e.start.getMinutes()]),
    [
      [26, 9, 30],
      [2, 9, 30],
      [4, 9, 30],
    ],
  );
  assert.equal(ev[0].title, 'Daily del equipo');
  assert.equal(ev[0].location, 'Sala Kanban');
  assert.equal(ev[0].calendar, 'personal');
  assert.equal(ev[0].end - ev[0].start, 15 * 60000);
});

test('evento de día completo y orden cronológico', () => {
  const ev = eventsBetween([fx('personal')], local(2026, 10, 31), local(2026, 11, 3));
  const santos = ev.find((e) => e.title === 'Todos los Santos');
  assert.equal(santos.allDay, true);
  assert.deepEqual([santos.start.getDate(), santos.start.getHours()], [1, 0]);
  assert.deepEqual(
    ev.map((e) => e.title),
    ['Todos los Santos', 'Daily del equipo'],
  );
});

test('TZID Europe/Madrid y "Romance Standard Time" dan la misma hora UTC', () => {
  const ev = eventsBetween([fx('outlook')], local(2026, 10, 27), local(2026, 10, 28));
  assert.equal(ev.length, 2);
  assert.equal(ev[0].start.toISOString(), '2026-10-27T17:00:00.000Z');
  assert.equal(ev[1].start.toISOString(), '2026-10-27T17:00:00.000Z');
  assert.equal(WINDOWS_TZ['Romance Standard Time'], 'Europe/Paris');
  assert.ok(WINDOWS_TZ['Pacific Standard Time'] && WINDOWS_TZ['Argentina Standard Time']);
  // Cambio de hora: la misma hora de pared antes y después del 25 de octubre.
  assert.equal(zonedToDate([2026, 10, 24, 9, 0, 0], 'Europe/Madrid').toISOString(), '2026-10-24T07:00:00.000Z');
  assert.equal(zonedToDate([2026, 10, 26, 9, 0, 0], 'America/New_York').toISOString(), '2026-10-26T13:00:00.000Z');
});

test('búsqueda por texto en título, lugar y descripción', () => {
  const all = [fx('personal'), fx('outlook')];
  assert.deepEqual(
    eventsBetween(all, local(2026, 10, 26), local(2026, 10, 30), 'revisión').map((e) => e.title),
    ['Dentista'],
  );
  assert.equal(eventsBetween(all, local(2026, 10, 26), local(2026, 10, 30), 'KANBAN').length, 1);
});

test('fetchCalendars: archivo y URL (webcal → https) con caché', async () => {
  let hits = 0;
  const srv = await serve((req, res) => {
    hits++;
    res.writeHead(200, { 'content-type': 'text/calendar' }).end(fx('outlook').text);
  });
  try {
    const cals = [
      { id: 'a', name: 'Personal', file: fileURLToPath(new URL('./fixtures/calendar/personal.ics', import.meta.url)) },
      { id: 'b', name: 'Trabajo', url: `${srv.url}/cal.ics` },
    ];
    const now = new Date();
    const r = await fetchCalendars(cals, { now });
    assert.deepEqual(
      r.map((c) => c.name),
      ['Personal', 'Trabajo'],
    );
    assert.match(r[0].text, /BEGIN:VCALENDAR/);
    assert.match(r[1].text, /Romance Standard Time/);
    await fetchCalendars(cals, { now: new Date(now.getTime() + 5 * 60000) });
    assert.equal(hits, 1);
    await fetchCalendars(cals, { now: new Date(now.getTime() + 16 * 60000) });
    assert.equal(hits, 2);
    const bad = await fetchCalendars([{ id: 'c', name: 'Roto', url: `${srv.url.replace('http', 'ftp')}/x` }], { now });
    assert.match(bad[0].error, /http/);
  } finally {
    await srv.close();
  }
});

test('briefingDue', () => {
  const b = { enabled: true, time: '08:30', days: [1, 2, 3, 4, 5] };
  const fri = (h, m = 0) => local(2026, 10, 23, h, m);
  assert.equal(briefingDue(fri(8, 30), b, null), true);
  assert.equal(briefingDue(fri(8, 29), b, null), false);
  assert.equal(briefingDue(fri(12), b, '2026-10-22'), true);
  assert.equal(briefingDue(fri(15), b, null), false);
  assert.equal(briefingDue(fri(9), b, '2026-10-23'), false);
  assert.equal(briefingDue(local(2026, 10, 24, 9), b, null), false); // sábado
  assert.equal(briefingDue(fri(9), { ...b, enabled: false }, null), false);
  // Hora de tarde: a su hora sí, aunque sea después de las 14:00.
  assert.equal(briefingDue(fri(16, 5), { ...b, time: '16:00' }, null), true);
});

test('herramienta calendar_events: hoy por defecto, rango y búsqueda', async () => {
  const cfg = { productivity: { calendars: [{ id: 'a', name: 'Personal', file: fileURLToPath(new URL('./fixtures/calendar/personal.ics', import.meta.url)) }] } };
  const [tool] = calendarTools(cfg, { now: () => local(2026, 10, 26, 8) });
  const today = await tool.run({});
  assert.deepEqual(
    today.events.map((e) => e.title),
    ['Daily del equipo'],
  );
  assert.match(today.events[0].when, /9:30/);
  const week = await tool.run({ from: '2026-10-26', to: '2026-11-02' });
  assert.deepEqual(
    week.events.map((e) => e.title),
    ['Daily del equipo', 'Dentista', 'Todos los Santos'],
  );
  assert.equal(calendarTools({ productivity: { calendars: [] } }, {}).length, 0);
});
